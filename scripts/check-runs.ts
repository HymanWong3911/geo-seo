import { prisma } from "../src/lib/db";
(async () => {
  const runs = await prisma.geoRun.findMany({
    orderBy: { createdAt: "desc" },
    take: 8,
    select: {
      id: true, createdAt: true, status: true, finishedAt: true,
      projectId: true, totalQuestions: true, answeredQuestions: true,
      errorMessage: true, _count: { select: { results: true } },
    },
  });
  console.log("8 latest runs:");
  for (const r of runs) {
    const ms = r.finishedAt ? r.finishedAt.getTime() - r.createdAt.getTime() : -1;
    const dur = ms > 0 ? `${ms}ms` : "running";
    console.log(
      `  ${r.id.slice(-8)} proj=${r.projectId.slice(-8)} ${r.status} results=${r._count.results} Q=${r.totalQuestions ?? "-"}/${r.answeredQuestions ?? "-"} ${dur} err=${r.errorMessage?.slice(0, 50) ?? ""}`,
    );
  }
  await prisma.$disconnect();
})();
