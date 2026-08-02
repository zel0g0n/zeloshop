/**
 * Berilgan qator (rows) massividan haqiqiy CSV fayl yaratib,
 * foydalanuvchi qurilmasiga yuklab beradi. Bu — simulyatsiya emas,
 * haqiqatan ishlaydigan eksport.
 */
export const exportToCsv = (filename, rows) => {
  const csvContent = rows
    .map((row) =>
      row
        .map((cell) => {
          const value = String(cell ?? "");
          // Vergul yoki qo'shtirnoq bo'lsa, qatorni qo'shtirnoqqa oladi.
          if (value.includes(",") || value.includes('"') || value.includes("\n")) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        })
        .join(",")
    )
    .join("\n");

  // Excel'da o'zbekcha harflar to'g'ri ko'rinishi uchun BOM qo'shiladi.
  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
