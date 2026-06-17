// 审计 CLI 工具。
// 用法：
//   pnpm audit log [--user EMAIL] [--action ACTION] [--from DATE] [--to DATE] [--limit N]
//   pnpm audit export [--user EMAIL] [--action ACTION] [--from DATE] [--to DATE] [--format csv] [--output FILE]
//
// 见 dev doc v1.2 28.4 节。

import { PrismaClient } from "@prisma/client";
import { writeFileSync } from "fs";

const prisma = new PrismaClient();

interface ParsedArgs {
  user?: string;
  action?: string;
  from?: Date;
  to?: Date;
  limit: number;
  format: "table" | "csv" | "json";
  output?: string;
}

function parseArgs(args: string[]): ParsedArgs {
  const out: ParsedArgs = { limit: 50, format: "table" };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];
    switch (arg) {
      case "--user": out.user = next; i++; break;
      case "--action": out.action = next; i++; break;
      case "--from": out.from = new Date(next); i++; break;
      case "--to": out.to = new Date(next); i++; break;
      case "--limit": out.limit = parseInt(next); i++; break;
      case "--format": out.format = next as never; i++; break;
      case "--output": out.output = next; i++; break;
    }
  }
  return out;
}

function fmtDate(d: Date | null | undefined): string {
  if (!d) return "-";
  return d.toISOString().replace("T", " ").slice(0, 19);
}

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = typeof v === "string" ? v : JSON.stringify(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

async function listLogs(args: ParsedArgs) {
  const logs = await prisma.auditLog.findMany({
    where: {
      ...(args.user ? { user: { email: args.user } } : {}),
      ...(args.action ? { action: args.action as never } : {}),
      ...(args.from || args.to
        ? {
            createdAt: {
              ...(args.from ? { gte: args.from } : {}),
              ...(args.to ? { lte: args.to } : {}),
            },
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: args.limit,
    include: { user: { select: { email: true, name: true } } },
  });

  if (args.format === "json") {
    console.log(JSON.stringify(logs, null, 2));
    return;
  }

  if (args.format === "csv") {
    const header = "id,user,action,targetType,targetId,ip,userAgent,createdAt";
    const rows = logs.map((l) =>
      [l.id, l.user?.email ?? "", l.action, l.targetType ?? "", l.targetId ?? "", l.ip ?? "", l.userAgent ?? "", l.createdAt.toISOString()].map(csvEscape).join(","),
    );
    const csv = [header, ...rows].join("\n");
    if (args.output) {
      writeFileSync(args.output, csv);
      console.error(`已导出 ${logs.length} 条到 ${args.output}`);
    } else {
      console.log(csv);
    }
    return;
  }

  // 表格输出
  console.log(`共 ${logs.length} 条审计记录`);
  console.log("");
  console.log("时间".padEnd(20) + "用户".padEnd(30) + "操作".padEnd(35) + "目标");
  console.log("-".repeat(100));
  for (const l of logs) {
    const u = l.user?.email ?? "(系统)";
    const t = l.targetType ? `${l.targetType}:${l.targetId?.slice(0, 8) ?? "?"}` : "-";
    console.log(
      fmtDate(l.createdAt).padEnd(20) + u.padEnd(30) + l.action.padEnd(35) + t,
    );
  }
}

async function main() {
  const args = process.argv.slice(2);
  const sub = args[0];

  if (!sub || sub === "--help" || sub === "-h") {
    console.log(`
审计 CLI 工具

用法:
  pnpm audit log [--user EMAIL] [--action ACTION] [--from DATE] [--to DATE] [--limit N]
  pnpm audit export [--user EMAIL] [--action ACTION] [--from DATE] [--to DATE] [--format csv|json] [--output FILE]

示例:
  pnpm audit log --user admin@example.com --limit 20
  pnpm audit log --action USER_LOGIN_FAILED --from 2026-06-01
  pnpm audit export --from 2026-05-01 --to 2026-05-31 --output audit-2026-05.csv
  pnpm audit log --format json | jq '.'
`);
    return;
  }

  if (sub === "log" || sub === "export") {
    const parsed = parseArgs(args.slice(1));
    if (sub === "export") {
      parsed.format = parsed.format === "table" ? "csv" : parsed.format;
      if (!parsed.output) {
        console.error("--output FILE 必填");
        process.exit(1);
      }
    }
    await listLogs(parsed);
  } else {
    console.error(`未知子命令: ${sub}`);
    process.exit(1);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
