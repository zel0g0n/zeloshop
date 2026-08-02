// Berilgan vaqtni "5 daqiqa avval", "2 soat avval" kabi nisbiy
// ko'rinishga o'tkazadi — buyurtma kartochkasida "qachon kelgani"ni
// tezkor ko'rsatish uchun.
export const formatRelativeTime = (dateValue) => {
  if (!dateValue) return "";
  const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "";

  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "hozirgina";
  if (diffMin < 60) return `${diffMin} daqiqa avval`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} soat avval`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay} kun avval`;
};
