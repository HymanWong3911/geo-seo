// CMS 集成列表 + 创建。
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin, requireSession, resolveAccessibleProjectIds } from "@/lib/api/auth";
import { audit } from "@/lib/audit/logger";
import { Errors, handleError, success, created } from "@/lib/api/response";
import { Prisma } from "@prisma/client";
import { encryptSecret, fingerprintSecret } from "@/lib/security/secrets";
import { publicCmsIntegration } from "@/lib/cms/integration";

const createSchema = z.object({
  projectId: z.string(),
  name: z.string().min(1).max(100),
  type: z.enum(["self-hosted", "mock"]).default("self-hosted"),
  baseUrl: z.string().url(),
  apiKey: z.string().min(8, "API Key 至少 8 位"),
  config: z.record(z.string(), z.unknown()).default({}),
  active: z.boolean().default(true),
});

export async function GET(req: NextRequest) {
  try {
    const session = await requireSession();
    const requestedProjectId = new URL(req.url).searchParams.get("projectId") ?? undefined;
    const projectIds = await resolveAccessibleProjectIds(
      session.user.id,
      session.user.role,
      requestedProjectId,
    );
    const integrations = await prisma.cmsIntegration.findMany({
      where: { projectId: { in: projectIds } },
      orderBy: { createdAt: "desc" },
      include: { project: { select: { id: true, name: true } } },
    });
    return success(integrations.map(publicCmsIntegration));
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin();
    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      throw Errors.badRequest("参数错误", parsed.error.flatten());
    }

    const project = await prisma.project.findUnique({
      where: { id: parsed.data.projectId },
      select: { id: true },
    });
    if (!project) throw Errors.notFound("项目");

    const secret = encryptSecret(parsed.data.apiKey);

    const integration = await prisma.cmsIntegration.create({
      data: {
        projectId: parsed.data.projectId,
        name: parsed.data.name,
        type: parsed.data.type,
        baseUrl: parsed.data.baseUrl,
        apiKeyHash: fingerprintSecret(parsed.data.apiKey),
        apiKeyEncrypted: secret.encrypted,
        apiKeyIv: secret.iv,
        apiKeyTag: secret.tag,
        config: parsed.data.config as Prisma.InputJsonValue,
        active: parsed.data.active,
      },
    });

    await audit("SETTINGS_UPDATE", {
      userId: session.user.id,
      targetType: "CmsIntegration",
      targetId: integration.id,
      metadata: { action: "create", name: integration.name, type: integration.type },
    });

    return created(publicCmsIntegration(integration));
  } catch (err) {
    return handleError(err);
  }
}
