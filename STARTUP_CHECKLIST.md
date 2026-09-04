# GEO-SEO 项目启动状态检查清单

## 当前状态

✅ **代码完成度**: 100%（11 个里程碑全部实现）
✅ **测试覆盖**: 75 个单测 + 9 个 E2E 全部通过
✅ **TypeScript**: 0 错误
⏳ **运行状态**: 未启动

---

## 启动前检查

### 必需软件

- [ ] Docker 已安装并运行
  ```bash
  docker --version
  docker compose version
  ```

- [ ] Node.js 20+ 已安装
  ```bash
  node --version
  ```

- [ ] pnpm 10+ 已安装
  ```bash
  pnpm --version
  ```

### 环境配置

- [ ] `.env` 文件已配置
  - [ ] `DATABASE_URL` 正确
  - [ ] `REDIS_URL` 正确
  - [ ] `AUTH_SECRET` 已设置
  - [ ] `LLM_API_KEY` 已配置（MiniMax 或 ARK）
  - [ ] `ARK_API_KEY` 已配置

---

## 启动步骤

### Step 1: 启动数据库服务

```bash
cd /Users/huanghaoming/Documents/项目开发/geo-seo
docker compose up -d postgres redis
```

**验证**:
```bash
docker compose ps
```

应该看到：
- postgres: Up
- redis: Up

### Step 2: 安装依赖

```bash
pnpm install
```

### Step 3: 初始化数据库

```bash
pnpm prisma:generate
pnpm prisma:migrate
pnpm prisma:seed
```

**验证**:
```bash
# 应该看到创建了管理员账号和示例项目
# ADMIN: admin@example.com
# 示例项目: 示例项目（公司主站）
```

### Step 4: 启动应用

**终端 1**:
```bash
pnpm dev
```

**终端 2**:
```bash
pnpm worker
```

**验证**:
- Web: 访问 http://localhost:3010
- Worker: 终端应显示 7 个 worker 启动成功

### Step 5: 登录测试

```
邮箱: admin@example.com
密码: Admin@2026
```

---

## 功能验证清单

登录后，按以下顺序验证：

### 基础功能

- [ ] 能正常登录
- [ ] 仪表盘显示正常
- [ ] 系统健康检查通过 (http://localhost:3010/system/health)

### 核心功能

- [ ] 查看示例项目
- [ ] 查看关键词列表
- [ ] 查看 GEO 问题列表
- [ ] 查看品牌/竞品列表

### 高级功能

- [ ] 运行页面诊断（输入一个 URL）
- [ ] 触发 GEO 监测（手动运行一次）
- [ ] 生成 AI 内容（使用示例项目）
- [ ] 查看监测结果

### 系统功能

- [ ] 查看审计日志
- [ ] 查看 LLM 调用统计
- [ ] 查看任务队列状态

---

## 常见问题

### 1. Docker 启动失败

```bash
# 检查 Docker 是否运行
docker ps

# 查看错误日志
docker compose logs postgres
docker compose logs redis
```

### 2. 数据库连接失败

```bash
# 检查 PostgreSQL
docker compose exec postgres psql -U geo_seo -c "SELECT 1"

# 检查端口是否被占用
lsof -i :5434
```

### 3. Redis 连接失败

```bash
# 检查 Redis
docker compose exec redis redis-cli ping

# 检查端口是否被占用
lsof -i :6380
```

### 4. LLM API 调用失败

```bash
# 测试 LLM 连接
pnpm llm:test
```

### 5. Worker 不处理任务

```bash
# 查看 Worker 日志
# 应该看到 7 个 worker 启动：
# - pageAudit
# - geoRun
# - contentAnalysis
# - report
# - scheduler
# - retention
# - cmsPublish
```

---

## 生产环境部署

如果要部署到生产环境，请参考：

- **Docker 部署**: `DEPLOY_GUIDE.md`
- **快速启动**: `./start.sh`

---

## 下一步

项目运行后，建议：

1. **修改默认密码**
   - 登录后立即修改 admin 密码

2. **配置真实数据**
   - 创建真实的项目
   - 添加真实的关键词和 GEO 问题

3. **设置自动化**
   - GEO 监测每日自动运行（已配置 00:30）
   - 品牌监控每 6 小时运行

4. **配置分发渠道**
   - 知乎、微信公众号、飞书等
   - 测试分发功能

5. **接入 CMS**
   - 配置自建网站 CMS
   - 测试内容发布流程

6. **设置告警**
   - 配置飞书/企微 Webhook
   - 测试告警通知

---

## 需要帮助？

如果遇到问题，请提供：

1. 错误信息截图
2. `docker compose ps` 输出
3. `pnpm dev` 终端输出
4. Worker 终端输出
5. 浏览器控制台错误（F12）
