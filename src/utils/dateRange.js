const MS_IN_DAY = 24 * 60 * 60 * 1000;

/** "Bugun" / "Hafta" / "Oy" — tanlangan davrning boshlanish vaqtini (ms) qaytaradi. */
export const getRangeStart = (timeframe) => {
  const now = new Date();
  if (timeframe === "Bugun") {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  }
  if (timeframe === "Hafta") {
    return now.getTime() - 7 * MS_IN_DAY;
  }
  return now.getTime() - 30 * MS_IN_DAY;
};
