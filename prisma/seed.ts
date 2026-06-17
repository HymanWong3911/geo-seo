// 数据库 seed 脚本。
// 创建 ADMIN 账号 + 示例项目 + 关键词 + GEO 问题 + 竞品。
// 用法: pnpm prisma:seed
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@example.com";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "Admin@2026";

  console.log("==> Seeding database...");

  // ADMIN 账号
  const passwordHash = await bcrypt.hash(adminPassword, 10);
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      name: "系统管理员",
      role: "ADMIN",
      passwordHash,
      mustChangePassword: false,
      lastPasswordChangeAt: new Date(),
    },
  });
  console.log(`==> ADMIN user: ${admin.email} / ${adminPassword}`);

  // 示例项目
  const project = await prisma.project.upsert({
    where: { id: "seed-project-1" },
    update: {},
    create: {
      id: "seed-project-1",
      name: "示例项目（公司主站）",
      domain: "example.com",
      primaryBrand: "Acme",
      language: "zh-CN",
      region: "CN",
      sitemapUrl: "https://example.com/sitemap.xml",
    },
  });

  // 创建者成为 OWNER
  await prisma.userProject.upsert({
    where: { userId_projectId: { userId: admin.id, projectId: project.id } },
    update: {},
    create: { userId: admin.id, projectId: project.id, role: "OWNER" },
  });

  // 示例品牌
  await prisma.brand.upsert({
    where: { id: "seed-brand-1" },
    update: {},
    create: {
      id: "seed-brand-1",
      projectId: project.id,
      name: "Acme",
      aliases: ["Acme Inc", "Acme 工具"],
      products: ["Acme SEO", "Acme GEO"],
      description: "一家提供搜索可见度优化服务的公司",
      isPrimary: true,
    },
  });

  // 示例竞品
  await prisma.competitor.upsert({
    where: { id: "seed-competitor-1" },
    update: {},
    create: {
      id: "seed-competitor-1",
      projectId: project.id,
      name: "竞品A",
      domain: "competitor-a.com",
      aliases: ["Competitor A"],
    },
  });

  // 5 个关键词
  const seedKeywords = [
    "企业 SEO 工具",
    "GEO 优化",
    "AI 搜索排名",
    "搜索可见度",
    "品牌监测",
  ];
  for (let i = 0; i < seedKeywords.length; i++) {
    await prisma.keyword.upsert({
      where: { id: `seed-kw-${i + 1}` },
      update: {},
      create: {
        id: `seed-kw-${i + 1}`,
        projectId: project.id,
        text: seedKeywords[i],
        intent: "INFORMATIONAL",
        priority: 3,
      },
    });
  }

  // 5 个 GEO 问题
  const seedQuestions = [
    "最好的企业 SEO 工具有哪些？",
    "如何做 GEO 优化？",
    "AI 搜索时代怎么提升品牌曝光？",
    "Acme 和其他竞品哪个更适合中小企业？",
    "中国市场有哪些值得推荐的搜索优化服务商？",
  ];
  for (let i = 0; i < seedQuestions.length; i++) {
    await prisma.geoQuestion.upsert({
      where: { id: `seed-q-${i + 1}` },
      update: {},
      create: {
        id: `seed-q-${i + 1}`,
        projectId: project.id,
        question: seedQuestions[i],
        intent: "INFORMATIONAL",
        priority: 3,
      },
    });
  }

  console.log("==> Seed completed!");
  console.log("");
  console.log("  ADMIN 账号:");
  console.log(`    email:    ${adminEmail}`);
  console.log(`    password: ${adminPassword}`);
  console.log("");
  console.log("  示例项目:");
  console.log(`    name:     ${project.name}`);
  console.log(`    domain:   ${project.domain}`);
  console.log("");
  console.log("  ⚠️  生产环境请立刻修改 ADMIN 密码！");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
