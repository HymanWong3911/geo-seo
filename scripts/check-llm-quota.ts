// 配额监控 + 自动暂停。
// 2026-07-25:用 LlmCall 表最近 1h 失败率判断 LLM API 配额状态。
//
// 退出码:
//   0 = 配额正常(< 30% 失败率)
//   1 = 配额告警(30-60% 失败率,可能 quota 即将耗尽)
//   2 = 配额耗尽(> 60% 失败率,或近 1h 全失败)
//
// 用法: pnpm tsx --env-file=.env scripts/check-llm-quota.ts
import { prisma } from "../src/lib/db";

async function main() {
  const since = new Date(Date.now() - 60 * 60 * 1000);

  const [total, failed, recent] = await Promise.all([
    prisma.llmCall.count({ where: { createdAt: { gte: since } } }),
    prisma.llmCall.count({ where: { createdAt: { gte: since }, success: false } }),
    prisma.llmCall.findMany({
      where: { createdAt: { gte: since }, success: false },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: { errorMessage: true, provider: true, model: true, createdAt: true },
    }),
  ]);

  const failRate = total > 0 ? (failed / total) * 100 : 0;

  console.log(`\n=== LLM 配额监控(过去 1h) ===`);
  console.log(`  总 calls:   ${total}`);
  console.log(`  失败:       ${failed}`);
  console.log(`  失败率:     ${failRate.toFixed(1)}%`);

  if (total === 0) {
    console.log(`\n状态:无数据`);
    process.exit(0);
  }

  if (failed > 0) {
    console.log(`\n最近 3 条失败:`);
    for (const r of recent) {
      console.log(`  - ${r.provider}/${r.model}: ${r.errorMessage?.slice(0, 100)}`);
    }
  }

  let status: "normal" | "warning" | "exhausted" = "normal";
  let exitCode = 0;
  if (failRate > 60) {
    status = "exhausted";
    exitCode = 2;
  } else if (failRate > 30) {
    status = "warning";
    exitCode = 1;
  }

  const recommendations: Record<typeof status, string> = {
    normal: "✓ LLM API 配额正常,继续 autonomous iteration",
    warning: "⚠ LLM 失败率 > 30%,可能配额即将耗尽。降低 LLM 调用频率,或考虑切换 mock。",
    exhausted: "✗ LLM 配额可能耗尽(失败率 > 60% 或近 1h 全失败)。立即暂停非必要 LLM 操作,等配额恢复。",
  };

  console.log(`\n状态:${status.toUpperCase()}`);
  console.log(`建议:${recommendations[status]}\n`);

  await prisma.$disconnect();
  process.exit(exitCode);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
