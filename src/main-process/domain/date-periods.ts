function iso(date: Date) { return date.toISOString().slice(0, 10); }
function utc(input: string) { return new Date(`${input}T12:00:00.000Z`); }

export function getIsoWeekRange(input: string) {
  const date = utc(input);
  const day = date.getUTCDay() || 7;
  const start = new Date(date); start.setUTCDate(date.getUTCDate() - day + 1);
  const end = new Date(start); end.setUTCDate(start.getUTCDate() + 6);
  const thursday = new Date(start); thursday.setUTCDate(start.getUTCDate() + 3);
  const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((thursday.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return { start: iso(start), end: iso(end), key: `${thursday.getUTCFullYear()}-W${String(week).padStart(2, '0')}` };
}

export function getMonthRange(input: string) {
  const date = utc(input);
  const year = date.getUTCFullYear(); const month = date.getUTCMonth();
  return { start: iso(new Date(Date.UTC(year, month, 1))), end: iso(new Date(Date.UTC(year, month + 1, 0))), key: `${year}-${String(month + 1).padStart(2, '0')}` };
}
