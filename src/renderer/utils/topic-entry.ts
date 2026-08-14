/** 从日反馈或复盘正文里提炼一句可作为主题讨论起点的短句，供"就这个深入探讨"预填。 */
export function deriveTopicQuestion(body: string): string {
  const line = body
    .split(/\r?\n/)
    .map((item) => item.trim())
    .find((item) => item && !/^[-|>*]/.test(item)) ?? '';
  return line.replace(/^(#{1,6}\s+|>\s+|\d+[.、)]\s*|[-*]\s+)/, '').trim().slice(0, 120);
}
