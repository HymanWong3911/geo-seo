// scripts/inspect-geo-run.ts
// 调试:检查一条 GEO run 为何 0.7s FAILED 且 0 个问题
// 用法: pnpm tsx --env-file=.env scripts/inspect-geo-run.ts <runId>
import { prisma } from "../src/lib/db";

async function main() {
  const runId = process.argv[2];
  if (!runId) {
    console.error("usage: pnpm tsx --env-file=.env scripts/inspect-geo-run.ts <runId>");
    process.exit(2);
  }

  const run = await prisma.geoRun.findUnique({
    where: { id: runId },
    include: {
      project: { select: { id: true, name: true } },
      _count: { select: { results: true } },
    },
  });
  if (!run) { console.error("run not found"); process.exit(1); }

  console.log("=== GeoRun ===");
  console.log({
    id: run.id,
    projectId: run.projectId,
    projectName: run.project.name,
    status: run.status,
    triggerSource: run.triggerSource,
    createdAt: run.createdAt,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    durationMs: run.finishedAt && run.createdAt
      ? run.finishedAt.getTime() - run.createdAt.getTime()
      : null,
    totalQuestions: run.totalQuestions,
    answeredQuestions: run.answeredQuestions,
    errorMessage: run.errorMessage,
  });

  const questions = await prisma.geoQuestion.findMany({
    where: { projectId: run.projectId },
    select: { id: true, question: true, active: true, keywordIds: true },
  });
  console.log(`\n=== GeoQuestion (project has ${questions.length}) ===`);
  for (const q of questions.slice(0, 10)) {
    console.log({
      id: q.id,
      active: q.active,
      keywords: q.keywordIds.length,
      question: q.question.slice(0, 60),
    });
  }

  // GeoRunQuestion 模型不存在：GeoRun 用 denormalized `questionIds` 数组保存。
  const questionsForRun = run.questionIds ?? [];
  console.log(`\n=== GeoRun.questionIds (${questionsForRun.length}) ===`);
  console.log(questionsForRun.slice(0, 5));

  const results = await prisma.geoRunResult.findMany({
    where: { geoRunId: runId },
    select: { id: true, providerSource: true, primaryBrandMentioned: true },
  });
  console.log(`\n=== GeoRunResult (${results.length}) ===`);
  console.log(results.slice(0, 5));

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });