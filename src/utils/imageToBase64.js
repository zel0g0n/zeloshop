/**
 * Berilgan rasmni (yangi tanlangan `File` yoki mavjud `url`) AI'ga
 * yuborish uchun kerakli ko'rinishga — base64 matn + mimeType —
 * aylantiradi.
 */
export const imageToBase64Payload = async (image) => {
  if (!image) return null;

  const readBlobAsBase64 = (blob) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        // reader.result shakli: "data:image/jpeg;base64,AAAA..."
        const base64 = reader.result.split(",")[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

  if (image.file) {
    const base64 = await readBlobAsBase64(image.file);
    return { base64, mimeType: image.file.type || "image/jpeg" };
  }

  if (image.url) {
    const response = await fetch(image.url);
    const blob = await response.blob();
    const base64 = await readBlobAsBase64(blob);
    return { base64, mimeType: blob.type || "image/jpeg" };
  }

  return null;
};
