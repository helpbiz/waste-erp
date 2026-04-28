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
# 빌드 단계 stub envvars — Next.js의 'Collecting page data' 단계에서
# lib/auth.ts 등 module-level env 검증 통과용. Runtime엔 .env.prod 값 사용.
ARG JWT_SECRET=build-time-stub-secret-32chars-padding-x
ARG KMS_LOCAL_KEY=build-time-stub-kms-key-32chars-padding-x
ARG DATABASE_URL=postgresql://stub:stub@localhost:5432/stub
ENV JWT_SECRET=$JWT_SECRET
ENV KMS_LOCAL_KEY=$KMS_LOCAL_KEY
ENV DATABASE_URL=$DATABASE_URL
RUN npx prisma generate
RUN npm run build

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
