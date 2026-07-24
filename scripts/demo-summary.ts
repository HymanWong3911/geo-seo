// 投资人 demo 用:打印关键数字,口头参考。
// 跑法: pnpm tsx --env-file=.env scripts/demo-summary.ts
import { prisma } from "../src/lib/db";

async function main() {
  console.log("\n=== 🎯 geo-seo 投资人 demo 数字概览 ===\n");

  // 1) 项目
  const projectCount = await prisma.project.count({ where: { status: "ACTIVE" } });
  console.log(`📁 项目:    ${projectCount} 个 active\n`);

  // 2) GEO 监测
  const allRuns = await prisma.geoRun.count();
  const last24hRuns = await prisma.geoRun.count({ where: { createdAt: { gte: new Date(Date.now() - 24 * 3600 * 1000) } } });
  const successRuns = await prisma.geoRun.count({ where: { status: "SUCCESS" } });
  const failedRuns = await prisma.geoRun.count({ where: { status: "FAILED" } });
  console.log(`🤖 GEO 监测:`);
  console.log(`   总 run:     ${allRuns} (成功 ${successRuns} / 失败 ${failedRuns})`);
  console.log(`   24h 内:    ${last24hRuns} 次\n`);

  // 3) mention rate
  const results = await prisma.geoRunResult.findMany({ select: { primaryBrandMentioned: true } });
  const mentioned = results.filter((r) => r.primaryBrandMentioned).length;
  const mentionRatePct = results.length > 0 ? Math.round((mentioned / results.length) * 100) : 0;
  console.log(`🎯 AI 搜索可见度:`);
  console.log(`   累计 GeoRunResult:  ${results.length}`);
  console.log(`   主品牌被 AI 提及:  ${mentioned} (${mentionRatePct}%)\n`);

  // 4) 品牌监控
  const brandMentions = await prisma.brandMention.count();
  const sentPos = await prisma.brandMention.count({ where: { sentiment: "positive" } });
  console.log(`📣 品牌监控:`);
  console.log(`   累计 brand mention: ${brandMentions} 条`);
  console.log(`   positive:            ${sentPos} 条\n`);

  // 5) LLM
  const llm = await prisma.llmCall.aggregate({
    _sum: { costCents: true, totalTokens: true },
    _count: { id: true },
  });
  const costCents = Number(llm._sum.costCents ?? 0);
  const costYuan = (costCents / 100).toFixed(2);
  const tokens = llm._sum.totalTokens ?? 0;
  const dailyAvg = (costCents / 7).toFixed(2);
  console.log(`🤖 LLM 调用:`);
  console.log(`   累计 calls:  ${llm._count.id}`);
  console.log(`   累计 tokens: ${tokens.toLocaleString()}`);
  console.log(`   累计 cost:   ¥${costYuan} (~¥${dailyAvg}/天)`);
  console.log(`   推算月度:    ¥${((costCents / 100) * 30 / 7).toFixed(2)}\n`);

  // 6) By model
  const byModel = await prisma.llmCall.groupBy({
    by: ["model", "provider"],
    _sum: { costCents: true },
    _count: { id: true },
  });
  console.log(`📊 By model:`);
  for (const m of byModel) {
    const c = Number(m._sum.costCents ?? 0);
    console.log(`   ${m.model ?? "<unknown>"} @${m.provider}: ${m._count.id} calls, ¥${(c / 100).toFixed(2)}`);
  }

  // 7) 审计
  const audits = await prisma.auditLog.count();
  const userLogins = await prisma.auditLog.count({ where: { action: "USER_LOGIN" } });
  console.log(`\n📜 Audit log: ${audits} 条(${userLogins} 次 USER_LOGIN)\n`);

  // 8) Tasks + ContentDrafts
  const tasks = await prisma.optimizationTask.count();
  const drafts = await prisma.contentDraft.count();
  console.log(`📝 Tasks: ${tasks}  ·  ContentDrafts: ${drafts}\n`);

  // 9) 端点健康
  console.log("🔌 关键端点(需 next-server 在 3010):");
  console.log("   GET  /api/health                 系统健康");
  console.log("   GET  /api/dashboard/summary      仪表盘聚合");
  console.log("   GET  /api/system/health          队列 + workers");
  console.log("   GET  /api/llm/usage?days=7        LLM cost by model");
  console.log("   GET  /api/dashboard/cost-forecast  月度预测");
  console.log("   GET  /api/dashboard/activity      事件流");
  console.log("   GET  /api/insights                跨项目 rollup");
  console.log("   GET  /api/projects/{p}/geo/history            30 天 GEO 时间序列");
  console.log("   GET  /api/projects/{p}/top-mentions           brand top + sentiment");
  console.log("   GET  /api/projects/{p}/llm/usage              单项目 LLM 拆分");
  console.log("   POST /api/geo/runs/bulk           跨项目批量");
  console.log("   POST /api/projects/{p}/geo/runs/bulk  单项目 N 个");
  console.log("");
  console.log("💡 准备:demo 前跑 `pnpm demo:seed` 一键触发 5 项目 + 抓 8 JSON 端点 dump\n");

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
