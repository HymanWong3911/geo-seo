-- 给 GeoRun 增加 totalQuestions / answeredQuestions 两个 Int? 列，
-- 让 worker 把 N 问题和命中数显式落库，前端 / 审计脚本能直接读而不用 join。
-- 2026-07-23: 由手工创建（环境无 tty，无法跑 prisma migrate dev --create-only）。
-- AlterTable
ALTER TABLE "GeoRun" ADD COLUMN "totalQuestions" INTEGER,
ADD COLUMN "answeredQuestions" INTEGER;
