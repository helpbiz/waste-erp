# 💾 CleanERP 백업·복원 가이드 (192.168.1.25 wci-worm)

> 일일 자동 + 주간 풀백업, SSH/rsync 기반 — 외부 클라우드 의존 없음.
> 마지막 갱신: 2026-05-02

---

## 🎯 백업 정책

| 종류 | 주기 | 시간(KST) | 보관 | 포함 |
|---|---|---|---|---|
| **daily** | 매일 | 03:30 | 30일 | DB dump + 코드 git bundle |
| **weekly** | 매주 일요일 | 04:30 | 12주 | + .env / .env.prod / uploads |

**저장 위치**: `192.168.1.25:/home/user/cleanerp-backup/{daily,weekly}/`

---

## 🔧 1회 셋업 (lab3 → wci-worm 키 인증)

```bash
# 1) lab3 에서 ssh 키 생성 (이미 있으면 스킵)
ssh-keygen -t ed25519 -C "cleanerp-backup" -f ~/.ssh/id_ed25519_backup

# 2) wci-worm 으로 공개키 복사
ssh-copy-id -i ~/.ssh/id_ed25519_backup.pub user@192.168.1.25

# 3) 비밀번호 없이 접속 확인
ssh -i ~/.ssh/id_ed25519_backup user@192.168.1.25 "mkdir -p /home/user/cleanerp-backup/{daily,weekly}"

# 4) lab3 에서 ~/.ssh/config 추가 (선택 — 명시 키 지정)
cat >> ~/.ssh/config <<EOF

Host wci-worm
  HostName 192.168.1.25
  User user
  IdentityFile ~/.ssh/id_ed25519_backup
  StrictHostKeyChecking accept-new
EOF
```

---

## 🚀 수동 실행

```bash
cd /home/user/my-pjt/wci-mvp/waste-erp

# 일반 백업 (DB + code, 30일 retention)
bash scripts/backup-to-wci-worm.sh

# 풀 백업 (+ .env + uploads, 12주 retention)
bash scripts/backup-to-wci-worm.sh full

# DRY RUN — 압축만 하고 전송 안 함 (검증용)
bash scripts/backup-to-wci-worm.sh --dry
```

출력 예시:
```
[2026-05-02 03:30:01] ▶ DB dump (cleanerp_prod)
  ✓ /tmp/.../cleanerp-db-20260502-0330.sql.gz (12M)
[2026-05-02 03:30:14] ▶ Code git bundle
  ✓ /tmp/.../cleanerp-code-20260502-0330.bundle (45M)
[2026-05-02 03:30:18] ▶ rsync → user@192.168.1.25:/home/user/cleanerp-backup/daily
  ✓ 원격 전송 완료
[2026-05-02 03:30:25] ▶ Retention 정리 (daily 30 일, weekly 12 주)
[2026-05-02 03:30:26] ✅ 백업 완료 (mode=daily, tag=20260502-0330)
```

---

## ⏰ Cron 등록 (lab3 user crontab)

```bash
crontab -e
```

다음 추가:
```cron
# CleanERP 백업
30 3 * * *   bash /home/user/my-pjt/wci-mvp/waste-erp/scripts/backup-to-wci-worm.sh         >> /var/log/cleanerp-backup.log 2>&1
30 4 * * 0   bash /home/user/my-pjt/wci-mvp/waste-erp/scripts/backup-to-wci-worm.sh full    >> /var/log/cleanerp-backup.log 2>&1
```

로그 확인:
```bash
tail -f /var/log/cleanerp-backup.log
# 또는
journalctl _COMM=cron -f
```

---

## 🔄 복원 절차

### 1) 백업 목록 확인
```bash
bash scripts/restore-from-wci-worm.sh list
```

### 2) DB 복원 (현재 DB 를 덮어씀!)
```bash
# 사전 안전 백업 자동 생성 → /tmp/cleanerp-pre-restore-*.sql.gz
bash scripts/restore-from-wci-worm.sh db 20260502-0330
```

### 3) 풀 복원 (코드 + DB)
```bash
# 가이드 출력 — 수동 단계 안내 (clone → DB 복원 → docker rebuild)
bash scripts/restore-from-wci-worm.sh full 20260502-0330
```

---

## ⚠️ 주의사항

### DB 복원 전
- 복원 스크립트가 **자동으로 사전 안전 백업** 을 `/tmp/cleanerp-pre-restore-*.sql.gz` 로 생성
- 그래도 운영 시간(평일 09-18시) 복원은 피하기 권장

### Append-Only 테이블
- `attendance_adjustments` 는 prod 에서 `REVOKE UPDATE/DELETE`
- 복원 시 권한 재설정 필요할 수 있음 — 마이그레이션 스크립트 확인

### 키 누출 방지
- `weekly` 모드에 `.env.prod` 포함 — 192.168.1.25 접근 권한 엄격 관리
- 외부 클라우드(S3 등) 추가 시 GPG 암호화 권장

### Retention 검증
- 매월 1일 로컬에서 `bash scripts/restore-from-wci-worm.sh list` 실행하여 daily/weekly 카운트 점검
- 30일 이상 백업이 보관되고 있으면 정리 로직 점검

---

## 🆘 장애 대응 시나리오

### "DB 가 깨졌어요"
```bash
# 1) 컨테이너 상태 확인
docker ps | grep cleanerp

# 2) 가장 최근 백업으로 복원
bash scripts/restore-from-wci-worm.sh list
bash scripts/restore-from-wci-worm.sh db <TAG>

# 3) 앱 재시작
docker compose --env-file .env.prod -f docker-compose.prod.yml restart app
```

### "lab3 머신이 망가졌어요"
```bash
# 새 머신에서:
git clone <빈 저장소> /tmp/init
cd /tmp/init
ssh-copy-id user@192.168.1.25  # 키 인증 셋업

# 풀 복원 가이드 따라가기
bash scripts/restore-from-wci-worm.sh full <TAG>
```

### "192.168.1.25 가 사라졌어요"
- 외부 클라우드 백업이 없으면 lab3 의 cron 로그(`/var/log/cleanerp-backup.log`) 와 git 원격(`origin`) 으로 부분 복구
- 권장: 월 1회 GPG 암호화 + 외부 S3/Backblaze 추가 백업

---

## 📊 모니터링

### 백업 성공률
```bash
# 최근 7일 백업 상태
ls -lh /home/user/cleanerp-backup/daily/ | tail -10
```

### 슬랙/알림 통합 (선택)
backup 스크립트 끝에 webhook 호출 추가 가능:
```bash
# scripts/backup-to-wci-worm.sh 마지막에 추가
curl -X POST -H 'Content-type: application/json' \
  --data "{\"text\":\"✅ CleanERP backup OK ($MODE, $DATE_TAG)\"}" \
  "$SLACK_WEBHOOK_URL"
```

### 백업 크기 추세
```bash
ssh user@192.168.1.25 "du -sh /home/user/cleanerp-backup/daily/"
```

---

## 🔧 환경변수 커스터마이징

스크립트 실행 시 override 가능:
```bash
BACKUP_HOST=192.168.1.25 \
BACKUP_USER=user \
BACKUP_BASE=/data/cleanerp-backup \
DB_CONTAINER=cleanerp-postgres \
DB_NAME=cleanerp_prod \
DB_USER=cleanerp \
RETENTION_DAILY=60 \
RETENTION_WEEKLY=24 \
bash scripts/backup-to-wci-worm.sh full
```

---

## 📚 관련 문서

- 운영 매뉴얼 §6 데이터베이스 관리 — `유지보수_메뉴얼.md`
- 운영 매뉴얼 §9 장애 대응 플레이북 — `유지보수_메뉴얼.md`
- 데이터 모델 — `docs/architecture/data-model.md`
- NOC 운영 — `docs/OPS-NOC-SETUP.md`
