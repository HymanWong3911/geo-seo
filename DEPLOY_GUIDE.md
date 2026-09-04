# GEO-SEO 生产环境部署指南

## 部署架构

```
┌─────────────────────────────────────────────────────────┐
│                    生产环境                              │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │  Nginx      │  │  Web App    │  │  Worker     │    │
│  │  (反向代理) │→ │  (Next.js)  │  │  (BullMQ)   │    │
│  └─────────────┘  └─────────────┘  └─────────────┘    │
│                          │                │             │
│                          ▼                ▼             │
│                    ┌─────────────┐  ┌─────────────┐    │
│                    │  PostgreSQL │  │  Redis      │    │
│                    │  (数据库)   │  │  (缓存/队列)│    │
│                    └─────────────┘  └─────────────┘    │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 方案 1：Docker Compose 部署（推荐）

### 1. 准备服务器

- Linux 服务器（Ubuntu 22.04+ 推荐）
- Docker 20.10+
- Docker Compose 2.0+
- 最低配置：2核 4GB 内存
- 推荐配置：4核 8GB 内存

### 2. 上传代码

```bash
# 在服务器上创建目录
mkdir -p /opt/geo-seo
cd /opt/geo-seo

# 上传代码（或 git clone）
# scp -r ./geo-seo user@server:/opt/geo-seo/
# 或
# git clone <your-repo-url> .
```

### 3. 配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑配置
nano .env
```

生产环境必须修改的配置：

```bash
# 1. 数据库（使用强密码）
DATABASE_URL="postgresql://geo_seo:YourStrongPassword123!@postgres:5432/geo_seo"
POSTGRES_PASSWORD=YourStrongPassword123!

# 2. Redis（使用强密码）
REDIS_URL="redis://:YourRedisPassword456!@redis:6379"

# 3. AUTH_SECRET（生成新的）
# 运行: openssl rand -hex 32
AUTH_SECRET="<生成的随机字符串>"

# 4. LLM API Key
LLM_API_KEY="your-real-api-key"
ARK_API_KEY="your-real-ark-key"

# 5. 应用 URL
APP_BASE_URL="https://seo.yourdomain.com"
```

### 4. 创建生产 docker-compose

```yaml
# docker-compose.prod.yml
version: "3.9"

services:
  postgres:
    image: postgres:15-alpine
    restart: always
    environment:
      POSTGRES_USER: geo_seo
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: geo_seo
    volumes:
      - pg_data:/var/lib/postgresql/data
    networks:
      - geo-seo-net
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U geo_seo"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    restart: always
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    networks:
      - geo-seo-net
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5

  web:
    build:
      context: .
      dockerfile: Dockerfile.web
    restart: always
    env_file: .env
    ports:
      - "3010:3000"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - geo-seo-net

  worker:
    build:
      context: .
      dockerfile: Dockerfile.worker
    restart: always
    env_file: .env
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - geo-seo-net

volumes:
  pg_data:
  redis_data:

networks:
  geo-seo-net:
    driver: bridge
```

### 5. 部署

```bash
# 构建并启动
docker compose -f docker-compose.prod.yml up -d --build

# 查看日志
docker compose -f docker-compose.prod.yml logs -f

# 检查状态
docker compose -f docker-compose.prod.yml ps
```

### 6. 配置 Nginx 反向代理

```nginx
# /etc/nginx/sites-available/geo-seo
server {
    listen 80;
    server_name seo.yourdomain.com;

    # 重定向到 HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name seo.yourdomain.com;

    # SSL 证书（使用 Let's Encrypt）
    ssl_certificate /etc/letsencrypt/live/seo.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/seo.yourdomain.com/privkey.pem;

    # 安全头
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # 代理配置
    location / {
        proxy_pass http://localhost:3010;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # 静态文件缓存
    location /_next/static {
        proxy_pass http://localhost:3010;
        expires 365d;
        add_header Cache-Control "public, immutable";
    }
}
```

```bash
# 启用站点
sudo ln -s /etc/nginx/sites-available/geo-seo /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 7. 申请 SSL 证书

```bash
# 安装 certbot
sudo apt install certbot python3-certbot-nginx

# 申请证书
sudo certbot --nginx -d seo.yourdomain.com

# 自动续期测试
sudo certbot renew --dry-run
```

---

## 方案 2：传统部署（不用 Docker）

### 1. 安装依赖

```bash
# Node.js 20+
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# pnpm
npm install -g pnpm

# PostgreSQL 15
sudo apt install postgresql-15

# Redis 7
sudo apt install redis-server
```

### 2. 配置 PostgreSQL

```bash
sudo -u postgres psql
```

```sql
CREATE USER geo_seo WITH PASSWORD 'YourStrongPassword';
CREATE DATABASE geo_seo OWNER geo_seo;
\q
```

### 3. 配置 Redis

```bash
sudo nano /etc/redis/redis.conf
```

```
requirepass YourRedisPassword
```

```bash
sudo systemctl restart redis
```

### 4. 部署应用

```bash
cd /opt/geo-seo

# 安装依赖
pnpm install

# 配置环境变量
cp .env.example .env
nano .env

# 初始化数据库
pnpm prisma:generate
pnpm prisma:migrate
pnpm prisma:seed

# 构建生产版本
pnpm build
```

### 5. 使用 PM2 管理进程

```bash
# 安装 PM2
npm install -g pm2

# 创建 PM2 配置
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'geo-seo-web',
      script: 'node_modules/.bin/next',
      args: 'start',
      env: {
        NODE_ENV: 'production',
        PORT: 3010
      }
    },
    {
      name: 'geo-seo-worker',
      script: 'tsx',
      args: 'src/workers/index.ts',
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
EOF

# 启动
pm2 start ecosystem.config.js

# 保存并设置开机自启
pm2 save
pm2 startup
```

---

## 监控与维护

### 1. 健康检查

```bash
# 检查 Web 服务
curl http://localhost:3010/api/health

# 检查数据库连接
docker compose exec postgres pg_isready -U geo_seo

# 检查 Redis 连接
docker compose exec redis redis-cli ping
```

### 2. 日志查看

```bash
# Docker 方式
docker compose logs -f web
docker compose logs -f worker

# PM2 方式
pm2 logs geo-seo-web
pm2 logs geo-seo-worker
```

### 3. 数据库备份

```bash
# 创建备份脚本
cat > /opt/geo-seo/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/opt/backups/geo-seo"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

# 备份数据库
docker compose exec -T postgres pg_dump -U geo_seo geo_seo | gzip > "$BACKUP_DIR/geo-seo-$DATE.sql.gz"

# 保留最近 30 天的备份
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete

echo "Backup completed: geo-seo-$DATE.sql.gz"
EOF

chmod +x /opt/geo-seo/backup.sh

# 添加定时任务（每天凌晨 2 点）
(crontab -l 2>/dev/null; echo "0 2 * * * /opt/geo-seo/backup.sh") | crontab -
```

### 4. 更新部署

```bash
# Docker 方式
cd /opt/geo-seo
git pull
docker compose -f docker-compose.prod.yml up -d --build

# PM2 方式
cd /opt/geo-seo
git pull
pnpm install
pnpm build
pm2 restart all
```

---

## 安全建议

1. **防火墙配置**
   ```bash
   # 只开放必要端口
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   sudo ufw enable
   ```

2. **数据库安全**
   - 不要将 PostgreSQL 暴露到公网
   - 使用强密码
   - 定期备份

3. **应用安全**
   - 使用 HTTPS
   - 定期更新依赖
   - 监控异常登录

4. **密钥管理**
   - 使用环境变量存储密钥
   - 不要将 `.env` 提交到 Git
   - 定期轮换 API Key

---

## 性能优化

1. **数据库优化**
   - 定期运行 `VACUUM ANALYZE`
   - 添加必要的索引
   - 配置连接池

2. **Redis 优化**
   - 配置最大内存
   - 使用持久化

3. **应用优化**
   - 启用 Gzip 压缩
   - 配置 CDN
   - 使用缓存

---

## 故障排查

| 问题 | 排查步骤 |
|------|----------|
| 无法访问 | 检查 Nginx 配置、防火墙、SSL 证书 |
| 数据库连接失败 | 检查 PostgreSQL 状态、密码、端口 |
| Worker 不处理任务 | 检查 Redis 连接、Worker 日志 |
| LLM API 调用失败 | 检查 API Key、网络、余额 |
| 内存不足 | 检查服务器资源、优化配置 |
