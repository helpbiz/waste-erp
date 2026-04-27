# CleanERP 운영 배포 가이드

## 1. 빠른 시작 (Docker Compose)

```bash
# 1) 환경변수 설정
cp .env.example .env
openssl rand -base64 48 | sed 's/$/  # JWT_SECRET/'
openssl rand -base64 32 | sed 's/$/  # KMS_LOCAL_KEY/'
openssl rand -hex 32     | sed 's/$/  # CRON_SECRET/'
# .env 편집 — 위 값들 + POSTGRES_PASSWORD 채우기

# 2) 빌드 + 기동
docker compose -f docker-compose.prod.yml up -d

# 3) DB 스키마 + 시드
docker compose -f docker-compose.prod.yml exec app npx prisma db push
docker compose -f docker-compose.prod.yml exec app npx tsx prisma/seed.ts
docker compose -f docker-compose.prod.yml exec app npx tsx prisma/seeds/positions.ts
docker compose -f docker-compose.prod.yml exec app npx tsx prisma/seeds/departments.ts
docker compose -f docker-compose.prod.yml exec app npx tsx prisma/seeds/approval-policies.ts

# 4) 헬스체크
curl http://localhost:3000/api/health

# 5) ORS 자체호스팅 (선택)
docker compose -f docker-compose.prod.yml --profile with-ors up -d ors
# 첫 실행 시 OSM 그래프 빌드에 5~15분 소요
```

## 2. 외부 cron 등록 (매일 자동)

### Vercel Cron (vercel.json)
```json
{
  "crons": [
    { "path": "/api/cron/bulky-waste-import", "schedule": "0 18 * * *" },
    { "path": "/api/cron/bulky-waste-resolve", "schedule": "0 8 * * *" },
    { "path": "/api/cron/grant-leave", "schedule": "0 0 1 * *" }
  ]
}
```
> 시각은 UTC 기준. `0 18 UTC` = `03:00 KST`.

### Kubernetes CronJob
```yaml
apiVersion: batch/v1
kind: CronJob
metadata: { name: bulky-waste-import }
spec:
  schedule: "0 18 * * *"  # 03:00 KST
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: curl
            image: curlimages/curl:latest
            args: ["-X", "POST", "-H", "Authorization: Bearer $(CRON_SECRET)", "https://your.app/api/cron/bulky-waste-import"]
          restartPolicy: OnFailure
```

### Linux crontab
```bash
# /etc/cron.d/cleanerp
SHELL=/bin/bash
# 매일 03시 KST 빼기 import
0 3 * * * curl -X POST -H "Authorization: Bearer ${CRON_SECRET}" https://your.app/api/cron/bulky-waste-import
# 매일 17시 KST resolve
0 17 * * * curl -X POST -H "Authorization: Bearer ${CRON_SECRET}" https://your.app/api/cron/bulky-waste-resolve
# 매월 1일 00시 연차 부여
0 0 1 * * curl -X POST -H "Authorization: Bearer ${CRON_SECRET}" -H 'content-type: application/json' -d '{"useRecommend":true}' https://your.app/api/cron/grant-leave
```

## 3. 리버스 프록시 + HTTPS (Nginx 예시)

```nginx
server {
  listen 443 ssl http2;
  server_name cleanerp.your-domain.com;

  ssl_certificate /etc/letsencrypt/live/cleanerp.your-domain.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/cleanerp.your-domain.com/privkey.pem;

  location / {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

## 4. 보안 체크리스트

- [ ] JWT_SECRET 48바이트 이상
- [ ] KMS_PROVIDER=aws|vault (운영) — local은 개발만
- [ ] PostgreSQL `?sslmode=require`
- [ ] HTTPS 강제 (HTTP→HTTPS 리다이렉트)
- [ ] 시드 계정 (super/muni/company/manager/worker) 비밀번호 즉시 변경
- [ ] test/test 계정 제거 (prisma/seed.ts 라인 95~107)
- [ ] PostgreSQL 자동 백업 (pg_dump → S3)
- [ ] audit_logs 보존 정책 수립 (산업안전보건법 5년)
- [ ] Sentry 등 에러 추적 통합
- [ ] PWA 아이콘 실제 디자인 교체 (public/icons/)

## 5. 운영 모니터링

| 항목 | 위치 | 빈도 |
|---|---|---|
| 헬스체크 | `GET /api/health` | 30초 |
| audit_logs 검토 | DB 또는 슈퍼관리자 페이지 | 일일 |
| 휴가 잔여 0 알림 | `/users` 연월차관리 탭 | 월초 |
| 빼기 cron 결과 | `/bulky-waste` 실행 이력 | 일일 |
| ORS 메트릭 | `lib/ors.ts` source='ors' 비율 | 주간 |
| 차량 운행일지 미제출 | `/dashboard` 차량 카드 | 일일 |

## 6. 백업/복구

```bash
# 매일 백업 (cron)
docker compose exec postgres pg_dump -U cleanerp cleanerp_prod | gzip > backup-$(date +%Y%m%d).sql.gz
aws s3 cp backup-$(date +%Y%m%d).sql.gz s3://cleanerp-backup/

# 복구
gunzip < backup-20260425.sql.gz | docker compose exec -T postgres psql -U cleanerp cleanerp_prod
```

## 7. 기능 빌드 결과 (Next.js)

총 80개 페이지 + 미들웨어 32.7kB
- ƒ Dynamic (server-rendered): 대부분의 admin 페이지
- ○ Static: /, /login (PWA 캐싱)
- App Shell First Load JS: 87.5 kB
- 페이지별 평균 First Load JS: 90~108 kB
