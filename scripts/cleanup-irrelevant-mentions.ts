// 清理 BrandMention 中与项目 brand/keyword 不沾的"噪音"
// 2026-07-23:用户 demo 反馈"扫描回来的内容和关键词没有关联性"。
// 原因:之前 brand monitor 用 brand name 单关键词搜,搜索引擎把同名/同音词拉进来了。
// 修法:对每个项目,删掉 title+content 不沾 brand(主+别名+竞品)和 keyword 的 mention。
import { prisma } from "../src/lib/db";

async function main() {
  const projects = await prisma.project.findMany({
    include: { brands: true, keywords: true },
  });
  let totalDeleted = 0;
  for (const p of projects) {
    if (p.brands.length === 0 && p.keywords.length === 0) {
      console.log(`[${p.name}] 无 brand/keyword,跳过`);
      continue;
    }
    const tokens = [
      ...p.brands.flatMap((b) => [b.name, ...b.aliases]),
      ...p.keywords.map((k) => k.text),
    ]
      .filter((t) => t && t.length >= 2) // 太短(单字)会误伤
      .map((t) => t.toLowerCase());

    if (tokens.length === 0) continue;

    // 拉所有 mention
    const allMentions = await prisma.brandMention.findMany({
      where: { projectId: p.id },
      select: { id: true, title: true, content: true, brandName: true },
    });
    const toDelete: string[] = [];
    for (const m of allMentions) {
      // 2026-07-23 第二轮清理:只检查 title+content,**不**用 brandName 字段
      // (因为 brandName 总是等于 search 时用的 brand,会必然匹配 → 假阳性)
      // 要求沾完整 brand 名称(主品牌或别名)或 project keyword
      const text = `${m.title ?? ""} ${m.content ?? ""}`.toLowerCase();
      if (!tokens.some((t) => text.includes(t))) toDelete.push(m.id);
    }
    if (toDelete.length > 0) {
      // 分批删,避免单条 SQL 太长
      const BATCH = 500;
      for (let i = 0; i < toDelete.length; i += BATCH) {
        const slice = toDelete.slice(i, i + BATCH);
        const r = await prisma.brandMention.deleteMany({
          where: { id: { in: slice } },
        });
        totalDeleted += r.count;
      }
      console.log(
        `[${p.name}] 删 ${toDelete.length} / ${allMentions.length} (${((toDelete.length / allMentions.length) * 100).toFixed(1)}%) — tokens: ${tokens.length}`,
      );
    } else {
      console.log(`[${p.name}] 全部 ${allMentions.length} 都相关,无需删`);
    }
  }
  console.log(`\n[总] 删 ${totalDeleted} 条不相关 BrandMention`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
