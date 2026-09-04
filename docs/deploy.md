# GEO + SEO 部署指南

本文档介绍如何部署 GEO + SEO 全栈运营系统。

## 目录

1. [前置条件](#1-前置条件)
2. [Docker Compose 一键部署（推荐）](#2-docker-compose-一键部署推荐)
3. [手动部署](#3-手动部署)
4. [内网部署（无公网）](#4-内网部署无公网)
5. [备份与恢复](#5-备份与恢复)
6. [升级](#6-升级)
7. [监控与日志](#7-监控与日志)
8. [故障排查](#8-故障排查)

---

## 1. 前置条件

### 1.1 硬件最低配置

| 项 | 最低 | 推荐 |
|---|---|---|
| CPU | 2 核 | 4 核 |
| 内存 | 4 GB | 8 GB |
| 磁盘 | 50 GB | 100 GB SSD |
| 带宽 | 10 Mbps | 100 Mbps |

### 1.2 软件

- Node.js 22.13+（pnpm 11.25 的最低运行要求）
- pnpm 11.25+
- Docker 24+ 和 Docker Compose v2
- PostgreSQL 15+（如不用 Docker）
- Redis 7+（如不用 Docker）

### 1.3 必需环境变量

参见 `.env.example`，至少配置：

```env
DATABASE_URL=postgresql://geo_seo:STRONG_PASSWORD@postgres:5432/geo_seo
REDIS_URL=redis://redis:6379
AUTH_SECRET=<32 字节随机字符串，可用 `openssl rand -hex 32`>
AUTH_TRUST_HOST=true
CMS_SECRET_ENCRYPTION_KEY=<32 字节密钥，可用 `openssl rand -base64 32`>
APP_BASE_URL=https://your-domain.com
POSTGRES_USER=geo_seo
POSTGRES_PASSWORD=<数据库强密码>
POSTGRES_DB=geo_seo
```

`AUTH_TRUST_HOST=true` 仅应在反向代理已校验并重写可信 `Host`/`X-Forwarded-Host` 的生产边界后开启；否则 Auth.js 会主动拒绝未知 host。

推荐配置（生产环境）：

```env
# LLM（至少配 1 家）
LLM_BASE_URL=https://api.deepseek.com/v1
LLM_API_KEY=sk-xxx
LLM_MODELS=deepseek-chat

# GEO 真实渠道（至少配 1 家）
PERPLEXITY_API_KEY=pplx-xxx
KIMI_API_KEY=sk-xxx
DOUBAO_API_KEY=xxx

# 告警
ALERT_FEISHU_WEBHOOK_URL=https://open.feishu.cn/open-apis/bot/v2/hook/xxx
ALERT_SMTP_HOST=smtp.exmail.qq.com
ALERT_SMTP_PORT=465
ALERT_SMTP_USER=alert@your-domain.com
ALERT_SMTP_PASS=xxx
ALERT_SMTP_FROM=alert@your-domain.com
ALERT_SMTP_TO=ops@your-domain.com

# 出站 allowlist（逗号分隔；空值只放行任意公网 host，不放行内网）
ALERT_WEBHOOK_ALLOWLIST=open.feishu.cn,qyapi.weixin.qq.com,hooks.slack.com
DISTRIBUTION_WEBHOOK_ALLOWLIST=hooks.example.com
CMS_EGRESS_ALLOWLIST=cms.example.com
CRAWLER_EGRESS_ALLOWLIST=www.example.com,*.example.com
```

所有动态出站 URL 默认要求 HTTPS，并拒绝 loopback、RFC1918、link-local、云 metadata 与保留地址。若自建 CMS 或测试站确实位于内网，需按通道显式设置 `*_ALLOW_PRIVATE_HOSTS=true`；自建 CMS、Webhook 或告警通道使用 HTTP 时还需设置对应的 `*_ALLOW_HTTP=true`。不要在公网部署中使用这些放宽开关。

生产 GEO 指标会排除 `llm_simulation` 结果；内容生成的 mock 和模板兜底也会作为 synthetic provenance 显示，不能绕过人工审核直接发布。

---

## 2. Docker Compose 一键部署（推荐）

### 2.1 启动

```bash
# 1. 克隆代码
git clone <repo>
cd geo-seo

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env，至少填 AUTH_SECRET / CMS_SECRET_ENCRYPTION_KEY /
# POSTGRES_* / SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD

# 3. 构建并启动。migrate 一次性服务会先执行 migration，成功后再启动 web/worker
docker compose up -d

# 4. 首次部署才执行 seed（凭据必须已显式写入 .env）
docker compose run --rm worker ./node_modules/.bin/tsx src/prisma/seed.ts
```

### 2.2 服务清单

启动后会有以下服务：

| 服务 | 端口 | 说明 |
|---|---|---|
| `web` | 3010 | Next.js 主应用 |
| `worker` | - | BullMQ worker（无端口） |
| `postgres` | 5434 | PostgreSQL（host 端口，可用 `POSTGRES_PORT` 覆盖） |
| `redis` | 6380 | Redis（host 端口，可用 `REDIS_PORT` 覆盖） |
| `migrate` | - | 每次部署先执行的 Prisma migration one-shot |
| `mailhog` | 8025 (UI) / 1025 (SMTP) | 邮件测试（`--profile dev`） |
| `pgadmin` | 5050 | 数据库管理（profile=tools 时启动） |

### 2.3 验证

```bash
# 查看 web 日志
docker compose logs -f web

# 健康检查
curl http://localhost:3010/api/health
```

### 2.4 启动 pgadmin（可选）

```bash
docker compose --profile tools up -d pgadmin
# 访问 http://localhost:5050；生产环境请覆盖 PGADMIN_DEFAULT_* 变量
```

---

## 3. 手动部署

> GitHub Actions 部署使用不可变 `sha-<完整提交 SHA>` 镜像标签。CI 在 `main` 构建并推送 web/worker；手动触发 Deploy workflow 时必须填写该标签。远端会先运行 migration，再只替换 web/worker，并通过容器内 `/api/health` 验证，不再依赖可漂移的 `latest`。

### 3.1 启动 PostgreSQL

```bash
# Ubuntu
sudo apt install postgresql-15
sudo -u postgres createuser -s geo_seo
sudo -u postgres createdb geo_seo -O geo_seo
sudo -u postgres psql -c "ALTER USER geo_seo WITH PASSWORD 'STRONG_PASSWORD';"
```

### 3.2 启动 Redis

```bash
# Ubuntu
sudo apt install redis-server
sudo systemctl enable --now redis-server
```

### 3.3 构建和启动

```bash
# 1. 装依赖 + 构建
pnpm install --frozen-lockfile
pnpm build
pnpm prisma:generate
pnpm prisma migrate deploy

# 2. 启动 web（用 systemd 或 pm2）
pnpm start

# 3. 启动 worker（另开一个进程）
pnpm worker
```

### 3.4 systemd 单元示例

`/etc/systemd/system/geo-seo-web.service`：

```ini
[Unit]
Description=GEO+SEO Web
After=network.target postgresql.service redis-server.service

[Service]
Type=simple
User=geoseo
WorkingDirectory=/opt/geo-seo
EnvironmentFile=/opt/geo-seo/.env
ExecStart=/usr/bin/pnpm start
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

`/etc/systemd/system/geo-seo-worker.service`：

```ini
[Unit]
Description=GEO+SEO Worker
After=network.target postgresql.service redis-server.service

[Service]
Type=simple
User=geoseo
WorkingDirectory=/opt/geo-seo
EnvironmentFile=/opt/geo-seo/.env
ExecStart=/usr/bin/pnpm worker
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now geo-seo-web geo-seo-worker
```

### 3.5 反向代理（Nginx 示例）

```nginx
server {
  listen 443 ssl http2;
  server_name geo.example.com;

  ssl_certificate     /etc/letsencrypt/live/geo.example.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/geo.example.com/privkey.pem;

  client_max_body_size 20M;

  location / {
    proxy_pass http://127.0.0.1:3010;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

---

## 4. 内网部署（无公网）

公司内网、无公网镜像仓库时的简化部署。

### 4.1 流程

```bash
# 1. 在有公网的机器上构建镜像
docker build -f Dockerfile.web -t geo-seo-web:1.0.0 .
docker build -f Dockerfile.worker -t geo-seo-worker:1.0.0 .

# 2. 导出镜像
docker save geo-seo-web:1.0.0 | gzip > geo-seo-web.tar.gz
docker save geo-seo-worker:1.0.0 | gzip > geo-seo-worker.tar.gz

# 3. 拷贝到内网目标机器（scp / U 盘）
scp geo-seo-*.tar.gz user@internal-server:/tmp/

# 4. 在内网目标机器上加载
docker load < /tmp/geo-seo-web.tar.gz
docker load < /tmp/geo-seo-worker.tar.gz

# 5. 启动
docker compose up -d
```

### 4.2 Playwright 浏览器

`Dockerfile.worker` 已安装 Alpine Chromium，并通过 `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` 交给 Playwright 使用；无需容器启动后联网下载浏览器。

---

## 5. 备份与恢复

### 5.1 数据库备份

```bash
# 手动备份
./scripts/backup.sh /path/to/backups

# 自动备份（cron 每日 02:00）
# 加入 crontab：
0 2 * * * /opt/geo-seo/scripts/backup.sh /opt/geo-seo/backups >> /var/log/geo-seo-backup.log 2>&1
```

备份文件：`/opt/geo-seo/backups/geo_seo_YYYYMMDD_HHMMSS.sql.gz`

保留 30 天（脚本内置），更老的自动删除。

### 5.2 恢复

```bash
./scripts/restore.sh /opt/geo-seo/backups/geo_seo_20260605_120000.sql.gz
```

会要求确认（输入 `yes`），然后覆盖当前数据库。

### 5.3 数据归档

retention worker 每月 1 日 03:00 自动：

- 删除 12 个月前的 PageAudit / GeoRun / LlmCall
- 导出 6 个月前的 AuditLog 到 `backups/retention/audit-log-YYYYMM.csv`，然后删除
- 项目归档超 12 个月 → 仅打印警告（不硬删业务数据）

如需手动触发：

```bash
docker compose exec worker pnpm exec tsx -e "import('./src/workers/retentionWorker.ts').then(m => m.runRetentionCleanup())"
```

---

## 6. 升级

### 6.1 标准流程

```bash
# 1. 拉新代码
cd /opt/geo-seo
git pull

# 2. 装新依赖
pnpm install --frozen-lockfile

# 3. 构建并滚动更新；migrate 必须成功，web/worker 才会启动
docker compose up -d --build
```

### 6.2 回滚

```bash
# 1. 切到上一个 git tag
git checkout v1.0.0

# 2. 重新装 + 构建
pnpm install --frozen-lockfile
pnpm build

# 3. 回滚数据库（如有破坏性 migration）
# 注意：prisma migrate 不支持自动 rollback
# 需要手动写反向 SQL 或从备份恢复
./scripts/restore.sh /path/to/backup-before-upgrade.sql.gz

# 4. 重启
docker compose restart
```

---

## 7. 监控与日志

### 7.1 日志位置

| 服务 | 位置 |
|---|---|
| web | `docker compose logs web` 或 `/var/log/geo-seo-web.log`（systemd） |
| worker | `docker compose logs worker` 或 `/var/log/geo-seo-worker.log` |
| PostgreSQL | `/var/log/postgresql/postgresql-15-main.log` |
| Redis | `/var/log/redis/redis-server.log` |
| Nginx | `/var/log/nginx/access.log` + `error.log` |

### 7.2 关键指标自检

```sql
-- 仪表盘 SQL
SELECT
  (SELECT COUNT(*) FROM "User" WHERE active = true) AS active_users,
  (SELECT COUNT(*) FROM "Project" WHERE status = 'ACTIVE') AS active_projects,
  (SELECT COUNT(*) FROM "GeoRun" WHERE created_at > now() - interval '1 day') AS runs_today,
  (SELECT COUNT(*) FROM "GeoRun" WHERE status = 'FAILED' AND created_at > now() - interval '7 days') AS failed_runs_7d,
  (SELECT COALESCE(SUM(cost_cents), 0) / 100 FROM "LlmCall" WHERE created_at > date_trunc('month', now())) AS month_cost_yuan;
```

### 7.3 异常告警

- GEO 监测失败 → 飞书 / 企微 / 邮件（已配）
- 月预算 80% → dashboard 红色提示（v1.2 暂未设硬限）
- 备份失败 → cron 邮件（建议配系统级 cron 监控）

---

## 8. 故障排查

### 8.1 启动失败

| 现象 | 排查 |
|---|---|
| `pnpm install` 失败 | 切镜像源：`pnpm config set registry https://registry.npmmirror.com` |
| `prisma migrate` 失败 | `docker compose ps` 看 pg 健康；`DATABASE_URL` 正确？ |
| 业务队列报 ECONNREFUSED | Redis 没起或容器内 `REDIS_URL` 未指向 `redis:6379` |
| 登录页 404 | `src/app/login/page.tsx` 存在？NextAuth 路由挂载？ |

### 8.2 GEO 监测问题

| 现象 | 排查 |
|---|---|
| 自动跑没启动 | `docker compose logs worker \| grep scheduler`；`TZ=Asia/Shanghai` 配了？ |
| 渠道 401 | API key 错（`echo $PERPLEXITY_API_KEY`） |
| 渠道 429 | 限流，加 `requestInterval` 或减少项目数 |
| 全部 fallback 也失败 | 查 worker 日志的 LLM 报错 |
| 告警没收到 | `/settings/alerts` 加通道 → "测试"按钮；查 mailhog 8025 |

### 8.3 备份 / 恢复问题

| 现象 | 排查 |
|---|---|
| 备份文件大小 0 | docker exec 进 postgres 跑 `pg_dump` 测一下；权限？ |
| restore 卡住 | 大文件需要时间；`docker stats` 看 IO |
| 自动备份 cron 没跑 | `crontab -l` 看配置；`/var/log/cron.log` 看日志 |

### 8.4 性能问题

| 现象 | 排查 |
|---|---|
| 仪表盘慢 | 加 Prisma 索引；查慢 SQL |
| worker 队列积压 | 加 worker 进程数；看 LLM API 限流 |
| 内存爆 | Prisma pool size 调小；BullMQ concurrency 调小 |

---

## 9. 维护清单

### 每周

- [ ] 跑 `pnpm audit log --limit 50` 看异常登录
- [ ] 看 `docker compose logs --since 7d | grep -i error` 错误

### 每月

- [ ] retention worker 自动跑（无需操作）
- [ ] 备份成功验证（`ls -lh backups/geo_seo_*.sql.gz | tail -3`）
- [ ] LLM 成本（`pnpm audit log --action GEO_RUN TRIGGER --from ...`）

### 每季度

- [ ] `pnpm outdated` 看依赖升级
- [ ] 评估渠道价格变化（DeepSeek / Kimi / 豆包）
- [ ] 重新评估"主关键词 / GEO 问题"是否还准确

### 每年

- [ ] 升级 Next.js / Prisma / Node.js 大版本
- [ ] 评估 v1.2 路线图
- [ ] 重新审视 21.7 端点是否需要（CMS 集成前置）
