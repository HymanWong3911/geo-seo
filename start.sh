#!/bin/bash
# GEO-SEO 项目快速启动脚本

set -e

echo "=========================================="
echo "  GEO-SEO 项目快速启动"
echo "=========================================="
echo ""

# 检查依赖
echo "🔍 检查依赖..."

if ! command -v docker &> /dev/null; then
    echo "❌ Docker 未安装，请先安装 Docker"
    exit 1
fi

if ! command -v node &> /dev/null; then
    echo "❌ Node.js 未安装，请先安装 Node.js 20+"
    exit 1
fi

if ! command -v pnpm &> /dev/null; then
    echo "❌ pnpm 未安装，请运行: npm install -g pnpm"
    exit 1
fi

echo "✅ 依赖检查通过"
echo ""

# 启动数据库服务
echo "🚀 启动 PostgreSQL + Redis..."
docker compose up -d postgres redis

echo "⏳ 等待数据库启动（10秒）..."
sleep 10

# 检查服务状态
echo "📊 检查服务状态..."
docker compose ps

echo ""

# 安装依赖
echo "📦 安装依赖..."
pnpm install

echo ""

# 初始化数据库
echo "🗄️ 初始化数据库..."
pnpm prisma:generate
pnpm prisma:migrate
pnpm prisma:seed

echo ""

echo "=========================================="
echo "  ✅ 初始化完成！"
echo "=========================================="
echo ""
echo "现在请打开两个终端："
echo ""
echo "终端 1 - 启动 Web 服务："
echo "  cd $(pwd)"
echo "  pnpm dev"
echo ""
echo "终端 2 - 启动 Worker 服务："
echo "  cd $(pwd)"
echo "  pnpm worker"
echo ""
echo "然后访问: http://localhost:3010"
echo ""
echo "登录信息："
echo "  邮箱: admin@example.com"
echo "  密码: Admin@2026"
echo ""
echo "⚠️ 首次登录后请立即修改密码"
echo ""
