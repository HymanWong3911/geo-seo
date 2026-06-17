// 审计日志写入。
// 详细说明见 dev doc v1.1 18.5 节。
import { AuditAction, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export interface AuditOptions {
  userId?: string | null;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
}

export async function audit(
  action: AuditAction,
  options: AuditOptions = {},
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: options.userId ?? null,
        action,
        targetType: options.targetType ?? null,
        targetId: options.targetId ?? null,
        ...(options.metadata
          ? { metadata: options.metadata as Prisma.InputJsonValue }
          : {}),
        ip: options.ip ?? null,
        userAgent: options.userAgent ?? null,
      },
    });
  } catch (err) {
    // 审计写入失败时记录到 stderr，但不阻塞主流程
    // eslint-disable-next-line no-console
    console.error("[audit] failed to write audit log:", err);
  }
}
