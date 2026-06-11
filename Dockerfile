# syntax=docker/dockerfile:1
# CleanERP 프로덕션 이미지 — Next.js 14 standalone build
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --legacy-peer-deps

FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# P2-8: BuildKit secret mount — 빌드타임 env 값을 레이어에 평문으로 굽지 않음.
# 'Collecting page data' 단계 lib/auth.ts module-level 검증 통과용 stub.
# Runtime 실제 값은 docker compose env_file(.env/.env.prod)로 주입됨.
RUN npx prisma generate
RUN --mount=type=secret,id=jwt_secret \
    --mount=type=secret,id=kms_local_key \
    JWT_SECRET=$(cat /run/secrets/jwt_secret 2>/dev/null || echo 'build-time-stub-secret-32chars-padding') \
    KMS_LOCAL_KEY=$(cat /run/secrets/kms_local_key 2>/dev/null || echo 'build-time-stub-kms-key-32chars-pad') \
    DATABASE_URL=postgresql://stub:stub@localhost:5432/stub \
    npm run build

FROM node:20-alpine AS runner
WORKDIR /app
# F-02 PDF 렌더링용 Chromium + 한글 폰트 (Design Ref: §2.3 puppeteer-core)
RUN apk add --no-cache \
  openssl ca-certificates \
  chromium nss freetype harfbuzz \
  font-noto-cjk \
  && update-ca-certificates
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Node fetch HTTPS 외부 호출용 CA 번들
ENV NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt
# Docker 컨테이너 IPv6 미지원 환경에서 fetch ENETUNREACH 방지
ENV NODE_OPTIONS=--dns-result-order=ipv4first
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s \
  CMD node -e "fetch('http://localhost:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
