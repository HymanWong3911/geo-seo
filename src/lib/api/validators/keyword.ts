// 关键词相关 zod 校验。
import { z } from "zod";
import { SearchIntent } from "@prisma/client";

export const createKeywordSchema = z.object({
  text: z.string().min(1, "关键词必填").max(200),
  language: z.string().default("zh-CN"),
  region: z.string().default("CN"),
  intent: z.nativeEnum(SearchIntent).default("INFORMATIONAL"),
  priority: z.number().int().min(1).max(5).default(3),
  targetUrl: z.string().url().optional().nullable(),
});

export const updateKeywordSchema = createKeywordSchema.partial();

// 批量导入：每行一个对象，或 CSV
export const importKeywordsSchema = z.union([
  z.object({
    format: z.literal("json"),
    items: z.array(createKeywordSchema).min(1).max(500),
  }),
  z.object({
    format: z.literal("csv"),
    csv: z.string().min(1),
  }),
]);
