import { useState, useCallback, useRef, useEffect } from 'react';
import { compressImage } from '@/utils/compress/compressImage';
import { uploadFileToStorage } from '@/services/storage/uploadStorage';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE_MB = 15;

export const useUploadImage = () => {
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [downloadUrl, setDownloadUrl] = useState(null);
  
  const activeUploadRef = useRef(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (activeUploadRef.current) activeUploadRef.current.cancel();
    };
  }, []);

  const cancelUpload = useCallback(() => {
    if (activeUploadRef.current) {
      activeUploadRef.current.cancel();
      activeUploadRef.current = null;
    }
    setLoading(false);
    setProgress(0);
    setError('Yuklash bekor qilindi.');
  }, []);

  const uploadImage = useCallback(async (file, folderPath = 'uploads') => {
    if (!file) {
      const errTxt = 'Fayl tanlanmagan!';
      setError(errTxt);
      throw new Error(errTxt);
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      const errTxt = 'Noto‘g‘ri rasm formati! Faqat JPEG, PNG va WEBP ruxsat etiladi.';
      setError(errTxt);
      throw new TypeError(errTxt);
    }
    if (file.size / 1024 / 1024 > MAX_FILE_SIZE_MB) {
      const errTxt = `Fayl hajmi juda katta! Maksimal cheklov: ${MAX_FILE_SIZE_MB}MB`;
      setError(errTxt);
      throw new Error(errTxt);
    }

    setLoading(true);
    setError(null);
    setProgress(0);
    setDownloadUrl(null);

    try {
      const compressedBlob = await compressImage(file, {
        maxWidth: 1000,
        maxHeight: 1000,
        quality: 0.75
      });

      if (file.name) {
        Object.defineProperty(compressedBlob, 'name', {
          value: file.name,
          writable: true,
          configurable: true
        });
      }

      return new Promise((resolve, reject) => {
        const uploadController = uploadFileToStorage(compressedBlob, {
          folder: folderPath,
          callbacks: {
            onProgress: (percent) => {
              if (isMountedRef.current) setProgress(percent);
            },
            onError: (err) => {
              if (!isMountedRef.current) return reject(err);
              setLoading(false);
              if (err.code === 'storage/canceled' || err.message?.includes('cancel')) {
                setError('Yuklash bekor qilindi.');
                reject(new Error('Yuklash bekor qilindi.'));
              } else {
                setError(err.message || 'Yuklashda xatolik yuz berdi.');
                reject(err);
              }
            },
            onSuccess: (url) => {
              if (isMountedRef.current) {
                setDownloadUrl(url);
                setLoading(false);
                resolve(url);
              } else {
                resolve(url);
              }
            }
          }
        });

        activeUploadRef.current = uploadController;
      });

    } catch (compressErr) {
      if (isMountedRef.current) {
        setError(compressErr.message || 'Rasmni qayta ishlashda xatolik.');
        setLoading(false);
      }
      throw compressErr;
    }
  }, []);

  return { uploadImage, cancelUpload, progress, loading, error, downloadUrl, setError };
};
