// 项目 / 成员相关 zod 校验。
import { z } from "zod";
import { ProjectRole, ProjectStatus } from "@prisma/client";

export const createProjectSchema = z.object({
  name: z.string().min(1, "项目名必填").max(100),
  domain: z
    .string()
    .min(1, "域名必填")
    .max(255)
    .regex(/^[a-zA-Z0-9.-]+$/, "域名格式不正确"),
  primaryBrand: z.string().min(1, "主品牌必填").max(100),
  language: z.string().default("zh-CN"),
  region: z.string().default("CN"),
  sitemapUrl: z.string().url().optional().nullable(),
  robotsUrl: z.string().url().optional().nullable(),
});

export const updateProjectSchema = createProjectSchema.partial().extend({
  status: z.nativeEnum(ProjectStatus).optional(),
  geoDailyEnabled: z.boolean().optional(),
  geoChannels: z.array(z.string()).optional(),
});

export const addMemberSchema = z.object({
  userId: z.string().min(1),
  role: z.nativeEnum(ProjectRole).default("VIEWER"),
});

export const updateMemberSchema = z.object({
  role: z.nativeEnum(ProjectRole),
});
