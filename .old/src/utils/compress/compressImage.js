/**
 * HTML5 Canvas yordamida rasmni xotirani tejab, maksimal tezlikda siqadi.
 * @param {File} file - Original rasm fayli
 * @param {Object} [options={}] - Maksimal o'lchamlar va siqish sifati
 * @param {number} [options.maxWidth=1000] - Maksimal eni
 * @param {number} [options.maxHeight=1000] - Maksimal bo'yi
 * @param {number} [options.quality=0.75] - Siqish sifati (0.0 dan 1.0 gacha)
 * @returns {Promise<Blob|File>} - Siqilgan rasm Blob obyekti yoki original fayl
 */
export const compressImage = (file, options = {}) => {
  const { maxWidth = 1000, maxHeight = 1000, quality = 0.75 } = options;

  return new Promise((resolve, reject) => {
    if (!file || !file.type || !file.type.startsWith('image/')) {
      return reject(new TypeError('Yaroqsiz fayl formati. Faqat rasm fayllarini siqish mumkin!'));
    }

    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.src = objectUrl;

    const cleanup = () => {
      URL.revokeObjectURL(objectUrl);
      img.onload = null;
      img.onerror = null;
    };

    img.onload = () => {
      let { width, height } = img;

      if (width <= maxWidth && height <= maxHeight && quality === 1) {
        cleanup();
        return resolve(file);
      }

      const ratio = Math.min(maxWidth / width, maxHeight / height, 1);
      const newWidth = Math.round(width * ratio);
      const newHeight = Math.round(height * ratio);

      const canvas = document.createElement('canvas');
      canvas.width = newWidth;
      canvas.height = newHeight;

      const ctx = canvas.getContext('2d', {
        alpha: file.type === 'image/png' || file.type === 'image/webp',
        willReadFrequently: false
      });

      if (!ctx) {
        cleanup();
        return reject(new Error('Canvas 2D kontekstini yuklab bo‘lmadi.'));
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, newWidth, newHeight);

      const outputType = file.type === 'image/png' && quality < 1 ? 'image/jpeg' : file.type;

      if (typeof canvas.toBlob === 'function') {
        canvas.toBlob(
          (blob) => {
            cleanup();
            blob ? resolve(blob) : reject(new Error('Canvas-ni Blob-ga o‘tkazishda xatolik.'));
          },
          outputType,
          quality
        );
      } else {
        try {
          const dataURL = canvas.toDataURL(outputType, quality);
          const binStr = atob(dataURL.split(',')[1]);
          const len = binStr.length;
          const arr = new Uint8Array(len);
          for (let i = 0; i < len; i++) arr[i] = binStr.charCodeAt(i);
          cleanup();
          resolve(new Blob([arr], { type: outputType }));
        } catch (err) {
          cleanup();
          reject(err);
        }
      }
    };

    img.onerror = (err) => {
      cleanup();
      reject(new Error('Rasm manbasini yuklashda xatolik: ' + (err.message || "Noma'lum xato")));
    };
  });
};
