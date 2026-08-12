const iso = (date: Date) => date.toISOString().slice(0, 10);
export function getDefaultReviewRange(type: 'weekly' | 'monthly' | 'project', input: string) {
  const date = new Date(`${input}T12:00:00.000Z`);
  if (type === 'weekly') { const day = date.getUTCDay() || 7; const start = new Date(date); start.setUTCDate(date.getUTCDate() - day + 1); const end = new Date(start); end.setUTCDate(start.getUTCDate() + 6); return { start: iso(start), end: iso(end) }; }
  if (type === 'monthly') return { start: `${input.slice(0, 7)}-01`, end: iso(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0))) };
  return { start: input, end: input };
}
