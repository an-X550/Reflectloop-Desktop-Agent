import type { z } from 'zod';

/** 模型即使被要求输出纯 JSON，也常包一层 ```json 围栏；剥离围栏后按 schema 解析。 */
export function parseFencedJson<T>(raw: string, schema: z.ZodType<T>): T {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return schema.parse(JSON.parse(fenced?.[1] ?? trimmed));
}
