import { describe, test, expect } from "vitest";
import { haversineDistanceKm, estimateEtaMinutes } from "./deliveryEta";

describe("haversineDistanceKm", () => {
  test("bir xil nuqta uchun 0 qaytaradi", () => {
    const point = { lat: 41.3111, lng: 69.2401 };
    expect(haversineDistanceKm(point, point)).toBeCloseTo(0, 5);
  });

  test("Toshkentdagi ikkita ma'lum nuqta orasidagi masofani taxminan to'g'ri hisoblaydi", () => {
    const a = { lat: 41.3111, lng: 69.2401 };
    const b = { lat: 41.2995, lng: 69.2401 };
    // ~1.29 km taxminan (faqat kenglik farqi, ~0.0116 gradus)
    expect(haversineDistanceKm(a, b)).toBeGreaterThan(1);
    expect(haversineDistanceKm(a, b)).toBeLessThan(1.5);
  });

  test("noto'g'ri/yetishmayotgan qiymatlar uchun null qaytaradi", () => {
    expect(haversineDistanceKm(null, { lat: 1, lng: 1 })).toBeNull();
    expect(haversineDistanceKm({ lat: 1 }, { lat: 1, lng: 1 })).toBeNull();
    expect(haversineDistanceKm(undefined, undefined)).toBeNull();
  });
});

describe("estimateEtaMinutes", () => {
  test("masofa mavjud bo'lsa musbat butun daqiqa qaytaradi", () => {
    const courier = { lat: 41.3111, lng: 69.2401 };
    const destination = { lat: 41.2995, lng: 69.2401 };
    const eta = estimateEtaMinutes(courier, destination);
    expect(Number.isInteger(eta)).toBe(true);
    expect(eta).toBeGreaterThanOrEqual(1);
  });

  test("koordinatalar bo'lmasa null qaytaradi", () => {
    expect(estimateEtaMinutes(null, { lat: 1, lng: 1 })).toBeNull();
    expect(estimateEtaMinutes({ lat: 1, lng: 1 }, null)).toBeNull();
  });

  test("juda qisqa masofa uchun ham kamida 1 daqiqa qaytaradi", () => {
    const point = { lat: 41.3111, lng: 69.2401 };
    expect(estimateEtaMinutes(point, point)).toBe(1);
  });
});
