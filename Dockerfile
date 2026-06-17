# ══════════════════════════════════════════════════════════════
# InkOS Dockerfile - 多阶段构建
# ══════════════════════════════════════════════════════════════

# ── 阶段1: 依赖安装 ──
FROM node:20-alpine AS deps
WORKDIR /app

# 安装pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# 复制依赖文件
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/core/package.json ./packages/core/
COPY packages/studio/package.json ./packages/studio/
COPY packages/cli/package.json ./packages/cli/

# 安装依赖
RUN pnpm install --frozen-lockfile

# ── 阶段2: 构建 ──
FROM node:20-alpine AS builder
WORKDIR /app

# 复制依赖
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/core/node_modules ./packages/core/node_modules
COPY --from=deps /app/packages/studio/node_modules ./packages/studio/node_modules
COPY --from=deps /app/packages/cli/node_modules ./packages/cli/node_modules

# 复制源代码
COPY . .

# 生成Prisma客户端
RUN cd packages/core && npx prisma generate

# 构建项目
RUN pnpm run build

# ── 阶段3: 生产镜像 ──
FROM node:20-alpine AS production
WORKDIR /app

# 安装pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# 复制依赖
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/core/node_modules ./packages/core/node_modules
COPY --from=deps /app/packages/studio/node_modules ./packages/studio/node_modules
COPY --from=deps /app/packages/cli/node_modules ./packages/cli/node_modules

# 复制构建产物
COPY --from=builder /app/packages/core/dist ./packages/core/dist
COPY --from=builder /app/packages/studio/dist ./packages/studio/dist
COPY --from=builder /app/packages/cli/dist ./packages/cli/dist
COPY --from=builder /app/packages/core/prisma ./packages/core/prisma

# 复制配置文件
COPY package.json pnpm-workspace.yaml ./
COPY packages/core/package.json ./packages/core/
COPY packages/studio/package.json ./packages/studio/
COPY packages/cli/package.json ./packages/cli/

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=3000

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# 启动命令
CMD ["pnpm", "start"]