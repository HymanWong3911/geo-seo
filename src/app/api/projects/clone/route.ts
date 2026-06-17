// 项目克隆：用模板项目快速创建新项目。
// POST /api/projects/clone
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/api/auth";
import { audit } from "@/lib/audit/logger";
import { Errors, handleError, created } from "@/lib/api/response";

const cloneSchema = z.object({
  sourceId: z.string(),
  newName: z.string().min(1).max(100),
  newDomain: z.string().min(1).max(200),
  copyKeywords: z.boolean().default(false),
  copyQuestions: z.boolean().default(false),
  copyBrands: z.boolean().default(false),
  copyCompetitors: z.boolean().default(false),
  copyCmsIntegrations: z.boolean().default(false),
  copyDistributionTargets: z.boolean().default(false),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();

    const body = await req.json();
    const parsed = cloneSchema.safeParse(body);
    if (!parsed.success) {
      throw Errors.badRequest("参数错误", parsed.error.flatten());
    }

    const { sourceId, newName, newDomain } = parsed.data;

    // 读取源项目
    const source = await prisma.project.findUnique({ where: { id: sourceId } });
    if (!source) throw Errors.notFound("源项目");

    // 创建新项目
    const newProject = await prisma.project.create({
      data: {
        name: newName,
        domain: newDomain,
        primaryBrand: source.primaryBrand,
        language: source.language,
        region: source.region,
        sitemapUrl: source.sitemapUrl?.replace(source.domain, newDomain) ?? null,
        robotsUrl: source.robotsUrl?.replace(source.domain, newDomain) ?? null,
        status: "ACTIVE",
        geoDailyEnabled: source.geoDailyEnabled,
        geoChannels: [...source.geoChannels],
      },
    });

    // 创建者成为 OWNER
    await prisma.userProject.create({
      data: {
        userId: session.user.id,
        projectId: newProject.id,
        role: "OWNER",
      },
    });

    // 可选：复制资源
    if (parsed.data.copyKeywords || parsed.data.copyQuestions ||
        parsed.data.copyBrands || parsed.data.copyCompetitors ||
        parsed.data.copyCmsIntegrations || parsed.data.copyDistributionTargets) {
      // 用事务保证一致性
      await prisma.$transaction(async (tx) => {
        if (parsed.data.copyKeywords) {
          const kws = await tx.keyword.findMany({ where: { projectId: sourceId } });
          for (const k of kws) {
            await tx.keyword.create({
              data: {
                projectId: newProject.id,
                text: k.text,
                language: k.language,
                region: k.region,
                intent: k.intent,
                priority: k.priority,
                targetUrl: k.targetUrl,
              },
            });
          }
        }
        if (parsed.data.copyQuestions) {
          const qs = await tx.geoQuestion.findMany({ where: { projectId: sourceId } });
          for (const q of qs) {
            await tx.geoQuestion.create({
              data: {
                projectId: newProject.id,
                question: q.question,
                language: q.language,
                region: q.region,
                intent: q.intent,
                priority: q.priority,
                keywordIds: q.keywordIds,
              },
            });
          }
        }
        if (parsed.data.copyBrands) {
          const bs = await tx.brand.findMany({ where: { projectId: sourceId } });
          for (const b of bs) {
            await tx.brand.create({
              data: {
                projectId: newProject.id,
                name: b.name,
                aliases: b.aliases,
                products: b.products,
                description: b.description,
                isPrimary: false,  // 主品牌需要用户手动切换
              },
            });
          }
        }
        if (parsed.data.copyCompetitors) {
          const cs = await tx.competitor.findMany({ where: { projectId: sourceId } });
          for (const c of cs) {
            await tx.competitor.create({
              data: {
                projectId: newProject.id,
                name: c.name,
                domain: c.domain,
                aliases: c.aliases,
                notes: c.notes,
              },
            });
          }
        }
        if (parsed.data.copyCmsIntegrations) {
          const cis = await tx.cmsIntegration.findMany({ where: { projectId: sourceId } });
          for (const ci of cis) {
            await tx.cmsIntegration.create({
              data: {
                projectId: newProject.id,
                name: `${ci.name} (副本)`,
                type: ci.type,
                baseUrl: ci.baseUrl.replace(source.domain, newDomain),
                apiKeyHash: ci.apiKeyHash,
                config: ci.config ?? {},
                active: false,  // 默认停用，需要用户重新配
              },
            });
          }
        }
        if (parsed.data.copyDistributionTargets) {
          const dts = await tx.distributionTarget.findMany({ where: { projectId: sourceId } });
          for (const d of dts) {
            await tx.distributionTarget.create({
              data: {
                projectId: newProject.id,
                name: d.name,
                platform: d.platform,
                config: d.config ?? {},
                active: false,
              },
            });
          }
        }
      });
    }

    await audit("PROJECT_CREATE", {
      userId: session.user.id,
      targetType: "Project",
      targetId: newProject.id,
      metadata: {
        name: newProject.name,
        domain: newProject.domain,
        clonedFrom: sourceId,
        copyOptions: parsed.data,
      },
      ip: req.headers.get("x-forwarded-for") ?? undefined,
    });

    return created(newProject);
  } catch (err) {
    return handleError(err);
  }
}