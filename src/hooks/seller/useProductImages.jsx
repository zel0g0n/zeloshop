import { useCallback, useEffect, useRef, useState } from "react";

const MAX_IMAGES = 4;
let nextId = 0;

/**
 * Mahsulot rasmlari (4 tagacha) holatini boshqaradi. Har bir rasm —
 * yangi tanlangan fayl (`file` bor) yoki tahrirlashda mavjud bo'lgan
 * (`url` bor, `file` yo'q) bo'lishi mumkin. Ro'yxatdagi BIRINCHI element
 * har doim "asosiy rasm" (thumbnail) hisoblanadi.
 */
export const useProductImages = () => {
  const [images, setImages] = useState([]);
  const blobUrlsRef = useRef(new Set());

  useEffect(() => {
    return () => {
      blobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const addFiles = useCallback((files) => {
    setImages((prev) => {
      const room = MAX_IMAGES - prev.length;
      if (room <= 0) return prev;
      const toAdd = files.slice(0, room).map((file) => {
        const previewUrl = URL.createObjectURL(file);
        blobUrlsRef.current.add(previewUrl);
        return { id: `img-${nextId++}`, file, previewUrl, url: null };
      });
      return [...prev, ...toAdd];
    });
  }, []);

  const removeImage = useCallback((id) => {
    setImages((prev) => {
      const target = prev.find((img) => img.id === id);
      if (target?.file && blobUrlsRef.current.has(target.previewUrl)) {
        URL.revokeObjectURL(target.previewUrl);
        blobUrlsRef.current.delete(target.previewUrl);
      }
      return prev.filter((img) => img.id !== id);
    });
  }, []);

  const setThumbnail = useCallback((id) => {
    setImages((prev) => {
      const index = prev.findIndex((img) => img.id === id);
      if (index <= 0) return prev;
      const next = [...prev];
      const [selected] = next.splice(index, 1);
      next.unshift(selected);
      return next;
    });
  }, []);

  // Tahrirlash sahifasi mavjud mahsulotning rasm URL'laridan boshlanishi uchun
  const initFromUrls = useCallback((urls) => {
    setImages(
      (urls || []).filter(Boolean).slice(0, MAX_IMAGES).map((url) => ({
        id: `img-${nextId++}`,
        file: null,
        previewUrl: url,
        url,
      }))
    );
  }, []);

  /**
   * Barcha YANGI (fayl sifatida tanlangan) rasmlarni PARALLEL
   * yuklaydi (mavjud, allaqachon URL'ga ega rasmlar tegilmaydi), va
   * natijada tartiblangan URL massivini qaytaradi (birinchisi —
   * asosiy).
   *
   * MUHIM TUZATISH: oldin bu yerda `for...await` orqali rasmlar
   * KETMA-KET (bittasi tugagach, keyingisi boshlanadi) yuklanardi —
   * 4 ta rasm bo'lsa, bu umumiy kutish vaqtini 4 baravargacha
   * cho'zishi mumkin edi. Endi `Promise.all` bilan barchasi BIR
   * VAQTDA yuklanadi — tartib (birinchi rasm = asosiy) baribir
   * saqlanadi, chunki `Promise.all` natijalarni KIRISH massivi bilan
   * BIR XIL tartibda qaytaradi (tugash tartibiga qarab EMAS).
   */
  const resolveUploadedUrls = useCallback(
    async (uploadImageFn, folder) => {
      const uploadPromises = images.map((img) =>
        img.url ? Promise.resolve(img.url) : uploadImageFn(img.file, folder)
      );
      return Promise.all(uploadPromises);
    },
    [images]
  );

  const reset = useCallback(() => {
    blobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    blobUrlsRef.current.clear();
    setImages([]);
  }, []);

  return { images, addFiles, removeImage, setThumbnail, initFromUrls, resolveUploadedUrls, reset };
};
