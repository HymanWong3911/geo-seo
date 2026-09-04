# GEO-SEO 项目启动指南

## 当前状态

项目代码已完成（11 个里程碑全部实现），但需要以下步骤才能真正运行起来：

### 前置条件检查

- [ ] Docker 已安装并运行
- [ ] Node.js 20+ 已安装
- [ ] pnpm 10+ 已安装

---

## 第 1 步：启动基础服务

在项目目录下运行：

```bash
cd /Users/huanghaoming/Documents/项目开发/geo-seo
docker compose up -d postgres redis
```

等待 PostgreSQL 和 Redis 启动完成（约 10-30 秒）。

检查服务状态：
```bash
docker compose ps
```

应该看到：
```
NAME                STATUS          PORTS
geo-seo-postgres    Up X seconds    0.0.0.0:5434->5432/tcp
geo-seo-redis       Up X seconds    0.0.0.0:6380->6379/tcp
```

---

## 第 2 步：安装依赖

```bash
pnpm install
```

---

## 第 3 步：初始化数据库

```bash
# 生成 Prisma Client
pnpm prisma:generate

# 运行数据库迁移
pnpm prisma:migrate

# 创建初始数据（管理员账号 + 示例项目）
pnpm prisma:seed
```

---

## 第 4 步：启动应用

**终端 1 - Web 服务：**
```bash
pnpm dev
```
访问 http://localhost:3010

**终端 2 - Worker 服务：**
```bash
pnpm worker
```

---

## 第 5 步：登录

打开 http://localhost:3010，使用：

```
邮箱: admin@example.com
密码: Admin@2026
```

⚠️ **首次登录后请立即修改密码**

---

## 第 6 步：验证功能

### 6.1 检查系统健康
访问: http://localhost:3010/system/health

### 6.2 创建第一个项目
1. 登录后进入"项目管理"
2. 点击"新建项目"
3. 填写：
   - 项目名称
   - 域名（如 example.com）
   - 主品牌名称
   - 语言/地区

### 6.3 添加关键词
1. 进入项目详情
2. 点击"关键词管理"
3. 添加 3-5 个目标关键词

### 6.4 添加 GEO 监测问题
1. 进入项目详情
2. 点击"GEO 问题"
3. 添加 AI 搜索相关的问题（如"XX品牌怎么样"）

### 6.5 运行首次 GEO 监测
1. 进入"GEO 监测"页面
2. 点击"手动触发"
3. 等待 Worker 处理完成（约 1-5 分钟）
4. 查看监测结果

### 6.6 运行页面诊断
1. 进入"页面诊断"
2. 输入要诊断的 URL
3. 查看 SEO 评分和建议

### 6.7 生成 AI 内容
1. 进入"内容管理" → "草稿"
2. 点击"AI 生成"
3. 输入主题和目标关键词
4. 查看生成的内容

---

## 常见问题排查

### 问题 1：数据库连接失败
```bash
# 检查 PostgreSQL 是否运行
docker compose ps postgres

# 查看日志
docker compose logs postgres
```

### 问题 2：Redis 连接失败
```bash
# 检查 Redis 是否运行
docker compose ps redis

# 测试连接
docker compose exec redis redis-cli ping
```

### 问题 3：LLM API 调用失败
检查 `.env` 中的 API Key：
```bash
# 测试 MiniMax
pnpm llm:test
```

### 问题 4：Worker 不处理任务
```bash
# 查看 Worker 日志
# 终端 2 应该显示：
# ✓ pageAudit worker started
# ✓ geoRun worker started
# ✓ contentAnalysis worker started
# ✓ report worker started
# ✓ scheduler worker started
# ✓ retention worker started
# ✓ cmsPublish worker started
```

---

## 生产环境部署

### 使用 Docker Compose 部署

```bash
# 构建镜像
docker compose build

# 启动所有服务
docker compose up -d
```

### 环境变量配置

生产环境需要修改 `.env`：

```bash
# 1. 修改数据库密码
DATABASE_URL="postgresql://user:strong_password@db-host:5432/geo_seo"

# 2. 修改 Redis 密码
REDIS_URL="redis://:strong_password@redis-host:6379"

# 3. 生成新的 AUTH_SECRET
openssl rand -hex 32

# 4. 配置真实的 LLM API Key
LLM_API_KEY="your-real-api-key"

# 5. 配置告警通道（飞书/企微/邮件）
ALERT_FEISHU_WEBHOOK_URL="https://..."
```

---

## 功能验证清单

运行以下命令验证项目是否正常：

```bash
# 1. 类型检查
pnpm typecheck

# 2. 运行测试
pnpm test

# 3. 检查数据库连接
pnpm prisma:studio

# 4. 检查 API
curl http://localhost:3010/api/health
```

---

## 下一步

项目运行后，建议：

1. **配置真实的品牌监控**
   - 添加 SearXNG 实例或使用 DuckDuckGo
   - 配置品牌和竞品

2. **设置自动化任务**
   - GEO 监测每日自动运行（已配置 00:30）
   - 品牌监控每 6 小时运行

3. **配置分发渠道**
   - 知乎、微信公众号、飞书等
   - 测试分发功能

4. **接入 CMS**
   - 配置自建网站 CMS
   - 测试内容发布流程

5. **设置告警**
   - 配置飞书/企微 Webhook
   - 测试告警通知

---

## 需要帮助？

如果遇到问题，请提供：
1. 错误信息
2. `docker compose ps` 输出
3. `pnpm dev` 终端输出
4. Worker 终端输出
