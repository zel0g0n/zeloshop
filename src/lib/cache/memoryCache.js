/**
 * UMUMIY, VERSIYALANGAN, TTL asosidagi xotira-keshi (in-memory cache)
 * + parallel so'rovlarni birlashtirish (request deduplication)
 * yordamchisi.
 *
 * MUHIM CHEKLOV (source of truth qoidasi): bu FAQAT arzon qayta
 * hisoblanadigan / sekin o'zgaradigan, KRITIK BO'LMAGAN data uchun —
 * masalan tashrif statistikasi, agregatsiya natijalari. Quyidagilar
 * uchun HECH QACHON ishlatilmasin: to'lov, buyurtma holati, ombor
 * qoldig'i, balans, ruxsatlar (permissions) — bular doim to'g'ridan-
 * to'g'ri serverdan (Firestore/Cloud Function) o'qilishi SHART.
 *
 * VERSIYALASH: har bir kesh kaliti `cache:{version}:{key}` shaklida
 * qurib beriladi. Agar biror data turining SHAKLI (schema) o'zgarsa,
 * shu keshni yaratuvchi joyda `version`ni oshiring (masalan "v1" ->
 * "v2") — eski formatdagi yozuvlar YANGI kalit bilan hech qachon mos
 * kelmaydi, shuning uchun eski-format ma'lumot bilan yangi kodni
 * albatta chalkashtirmaydi (ular TTL tugagach o'zi tozalanadi).
 *
 * O'LCHAM NAZORATI: har bir kesh (`namespace`) uchun `maxEntries`
 * chegarasi bor — undan oshsa, eng ESKI (birinchi qo'shilgan)
 * yozuvlar avtomatik chiqarib tashlanadi (FIFO eviction).
 */

// namespace -> Map(fullKey -> { value, expiresAt })
const namespaceStores = new Map();
// "namespace:fullKey" -> Promise (hozir bajarilayotgan fetchFn)
const inFlightRequests = new Map();

function getNamespaceStore(namespace) {
  let store = namespaceStores.get(namespace);
  if (!store) {
    store = new Map();
    namespaceStores.set(namespace, store);
  }
  return store;
}

function buildFullKey(version, key) {
  return `cache:${version}:${key}`;
}

/**
 * @param {object} options
 * @param {string} options.namespace - keshning nomi (masalan "visitorCount"). Har xil namespace'lar bir-biriga ta'sir qilmaydi.
 * @param {string} [options.version="v1"] - schema versiyasi, kalitga qo'shiladi.
 * @param {number} [options.defaultTtlMs=60000] - `set`/`getOrFetch` uchun standart TTL (millisoniya).
 * @param {number} [options.maxEntries=200] - shu namespace uchun maksimal yozuvlar soni.
 */
export function createCache({ namespace, version = "v1", defaultTtlMs = 60000, maxEntries = 200 }) {
  if (!namespace || typeof namespace !== "string") {
    throw new Error("createCache: 'namespace' majburiy (string).");
  }
  const store = getNamespaceStore(namespace);

  function evictExpired() {
    const now = Date.now();
    for (const [fullKey, entry] of store) {
      if (entry.expiresAt <= now) store.delete(fullKey);
    }
  }

  function evictOverflow() {
    if (store.size <= maxEntries) return;
    const overflowCount = store.size - maxEntries;
    let removed = 0;
    for (const fullKey of store.keys()) {
      if (removed >= overflowCount) break;
      store.delete(fullKey);
      removed += 1;
    }
  }

  function get(key) {
    const fullKey = buildFullKey(version, key);
    const entry = store.get(fullKey);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      store.delete(fullKey);
      return undefined;
    }
    return entry.value;
  }

  function set(key, value, ttlMs = defaultTtlMs) {
    const fullKey = buildFullKey(version, key);
    store.set(fullKey, { value, expiresAt: Date.now() + ttlMs });
    evictOverflow();
    return value;
  }

  function invalidate(key) {
    store.delete(buildFullKey(version, key));
  }

  /** Berilgan prefiksga mos KO'P kalitni bir yo'la bekor qiladi (masalan bitta mahsulot yangilansa, unga bog'liq barcha ro'yxat keshlarini tozalash uchun). */
  function invalidatePrefix(prefix) {
    const fullPrefix = buildFullKey(version, prefix);
    for (const fullKey of store.keys()) {
      if (fullKey.startsWith(fullPrefix)) store.delete(fullKey);
    }
  }

  function clear() {
    store.clear();
  }

  /**
   * CACHE HIT -> darhol (server so'rovisiz) qiymatni qaytaradi.
   * CACHE MISS yoki muddati o'tgan -> `fetchFn()` chaqiriladi, natija
   * keshlanadi va qaytariladi.
   *
   * REQUEST DEDUPLICATION: bir xil `key` uchun bir nechta chaqiruv BIR
   * VAQTDA sodir bo'lsa (masalan foydalanuvchi tabni tez-tez
   * almashtirsa), faqat BITTA haqiqiy `fetchFn()` ishga tushadi —
   * qolgan barcha chaqiruvlar shu bitta so'rovning natijasini kutib
   * oladi, alohida-alohida server so'rovi yubormaydi.
   */
  async function getOrFetch(key, fetchFn, ttlMs = defaultTtlMs) {
    evictExpired();
    const cached = get(key);
    if (cached !== undefined) return cached;

    const fullKey = buildFullKey(version, key);
    const inFlightKey = `${namespace}:${fullKey}`;
    const existing = inFlightRequests.get(inFlightKey);
    if (existing) return existing;

    const promise = (async () => {
      try {
        const value = await fetchFn();
        set(key, value, ttlMs);
        return value;
      } finally {
        inFlightRequests.delete(inFlightKey);
      }
    })();

    inFlightRequests.set(inFlightKey, promise);
    return promise;
  }

  return { get, set, invalidate, invalidatePrefix, clear, getOrFetch };
}

/**
 * FAQAT TESTLAR UCHUN: barcha namespace'lardagi barcha keshlarni va
 * kutilayotgan so'rovlarni tozalaydi. Production kodida chaqirilmasin.
 *
 * MUHIM: `namespaceStores.clear()` o'rniga har bir MAVJUD store'ning
 * O'ZINI (`store.clear()`) tozalaymiz — chunki `createCache()`
 * chaqirilganda qaytarilgan yopilish (closure)lar aynan shu Map
 * OBYEKTIGA to'g'ridan-to'g'ri ishora qiladi (modul darajasida BIR
 * MARTA yaratilgan `visitorCountCache` kabi). Agar shu yerda faqat
 * `namespaceStores`dan yozuvni o'chirsak, allaqachon yaratilgan kesh
 * obyekti eski Map'ni ishlatishda davom etadi va testlar orasida
 * ma'lumot "sizib" qolaveradi.
 */
export function __resetAllCachesForTests() {
  for (const store of namespaceStores.values()) {
    store.clear();
  }
  inFlightRequests.clear();
}
