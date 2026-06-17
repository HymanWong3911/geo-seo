// GEO 问题 / 品牌 / 竞品 相关 zod 校验。
import { z } from "zod";
import { SearchIntent } from "@prisma/client";

export const createGeoQuestionSchema = z.object({
  question: z.string().min(1, "问题必填").max(500),
  language: z.string().default("zh-CN"),
  region: z.string().default("CN"),
  intent: z.nativeEnum(SearchIntent).default("INFORMATIONAL"),
  priority: z.number().int().min(1).max(5).default(3),
  keywordIds: z.array(z.string()).default([]),
  active: z.boolean().default(true),
});

export const updateGeoQuestionSchema = createGeoQuestionSchema.partial();

export const createBrandSchema = z.object({
  name: z.string().min(1, "品牌名必填").max(100),
  aliases: z.array(z.string()).default([]),
  products: z.array(z.string()).default([]),
  description: z.string().max(2000).optional().nullable(),
  isPrimary: z.boolean().default(false),
});

export const updateBrandSchema = createBrandSchema.partial();

export const createCompetitorSchema = z.object({
  name: z.string().min(1, "竞品名必填").max(100),
  domain: z.string().max(255).optional().nullable(),
  aliases: z.array(z.string()).default([]),
  notes: z.string().max(2000).optional().nullable(),
});

export const updateCompetitorSchema = createCompetitorSchema.partial();
