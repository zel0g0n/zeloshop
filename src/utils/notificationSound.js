// Yangi buyurtma/topshiriq kelganda, ilova ochiq turgan paytda (sotuvchi
// Buyurtmalar sahifasi yoki kuryer ilovasi ekranda bo'lganda) avtomatik
// ijro etiladigan qisqa ovozli signal.
//
// Tashqi audio fayl o'rniga Web Audio API orqali ikkita ohangdan iborat
// qisqa "ding" to'g'ridan-to'g'ri sintez qilinadi — tashqi .mp3 fayl
// yuklashning (hajm, litsenziya, tarmoq so'rovi) hojati yo'q, signal
// darhol, hech narsa yuklanmasdan chalinadi.
//
// Platforma cheklovi (barcha brauzerlarning umumiy "autoplay" siyosati):
// ovoz faqat foydalanuvchi shu sahifa bilan kamida bir marta o'zaro
// aloqada bo'lgandan keyin (masalan uni ochgan, biror joyni bosgan)
// ishlay boshlaydi. Bundan tashqari, bu faqat sahifa/ilova ochiq
// (ekranda) turgan paytda ishlaydi — ilova yopiq yoki fonda bo'lsa,
// Telegram push-bildirishnomasi (foydalanuvchining o'zi sozlaydigan
// ovoz) ishlaydi, bu ular ekranga qarab, navbatda kutib turganda
// qo'shimcha signal beradi.
let sharedAudioContext = null;

const getAudioContext = () => {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return null;
  if (!sharedAudioContext) {
    sharedAudioContext = new Ctor();
  }
  return sharedAudioContext;
};

const playTone = (ctx, frequency, startTime, duration) => {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = "sine";
  oscillator.frequency.value = frequency;
  // Yumshoq kirish/chiqish (fade in/out) — qattiq "click" tovushisiz,
  // yoqimli, qisqa "ding" effekti uchun.
  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(0.22, startTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(startTime);
  oscillator.stop(startTime + duration);
};

/**
 * Yangi buyurtma (sotuvchi) / yangi topshiriq (kuryer) kelganda
 * chaqiriladi. Xato yuz bersa ham (masalan hali foydalanuvchi
 * ilovaga umuman tegmagan bo'lsa) jim tarzda hech narsa qilmaydi —
 * bu ikkinchi darajali qulaylik, asosiy funksionallikka (buyurtmalar
 * ro'yxati) hech qanday ta'sir qilmasligi kerak.
 */
export const playNewOrderChime = () => {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
    const now = ctx.currentTime;
    playTone(ctx, 880, now, 0.16); // A5
    playTone(ctx, 1318.5, now + 0.14, 0.24); // E6
  } catch {
    // ovoz — ikkinchi darajali qulaylik, xato jim yutiladi
  }
};
