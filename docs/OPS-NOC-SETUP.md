# 무인 NOC(관제센터) 셋업 절차서

> CleanERP `/noc` 풀스크린 관제 화면을 50인치 이상 디스플레이에 24/7 무인 운영하기 위한 표준 절차.
> 검증 환경: Ubuntu 24.04 LTS Desktop + GNOME + 노트북(HDMI) + 50" TV.

---

## 1. 사전 요구사항

### 1.1 하드웨어
| 항목 | 최소 사양 | 권장 |
|---|---|---|
| **PC/노트북** | 4GB RAM, HDMI 출력 | 8GB+ RAM, NVMe SSD |
| **디스플레이** | 1080p 지원 | 50인치 이상 4K (4K@30Hz도 가능) |
| **케이블** | HDMI 1.4 | HDMI 2.0 Premium Certified |
| **네트워크** | LAN 또는 Wi-Fi | LAN 유선 (안정성) |

### 1.2 소프트웨어
- Ubuntu 22.04+ Desktop (또는 GNOME 환경)
- Chromium 또는 Chrome (snap 패키지 가능)
- xorg, xrandr, xset (X11 스택)
- cron

### 1.3 계정
- 노트북 로컬 사용자 (sudo 권한)
- CleanERP **SUPER_ADMIN** 계정 1개 (NOC 첫 로그인용)

---

## 2. 1단계 — 디스플레이 연결 + 해상도 점검

### 2.1 HDMI 연결
1. 50" TV와 노트북 HDMI 케이블 연결
2. TV 리모컨 → INPUT/SOURCE → 해당 HDMI 입력 선택
3. 노트북 부팅

### 2.2 X 세션 + 디스플레이 단자 확인
SSH 또는 노트북 본체 터미널:
```bash
# 그래픽 세션 떠있나
echo $XDG_SESSION_TYPE   # x11 또는 wayland → tty면 GUI 미동작

# 모든 디스플레이 단자 + 지원 해상도
DISPLAY=:1 XAUTHORITY=/run/user/1000/gdm/Xauthority xrandr | head -40
```

`HDMI-1 connected` 확인. (단자명은 `HDMI-A-1`, `HDMI-A-0` 등 환경마다 다름 — 위 출력 기준 그대로 사용)

### 2.3 1080p@60Hz로 강제 (TV만 출력)
```bash
DISPLAY=:1 XAUTHORITY=/run/user/1000/gdm/Xauthority \
  xrandr --output HDMI-1 --mode 1920x1080 --rate 60 --primary --output eDP-1 --off
```

→ TV에 1080p 풀스크린, 노트북 LCD 꺼짐.

> **4K 지원 모니터의 경우**: `--mode 3840x2160 --rate 30` (60Hz는 케이블/GPU 한계 시 불가)

---

## 3. 2단계 — Watchdog 스크립트 설치

NOC 자동 감시·복구 스크립트.

### 3.1 디렉토리 + 파일 생성
```bash
mkdir -p ~/bin
nano ~/bin/noc-watchdog.sh
```

### 3.2 nano에 붙여넣기
```bash
#!/bin/bash
# CleanERP NOC 자동 감시 — 1분마다 cron 실행
export DISPLAY=:1
export XAUTHORITY=/run/user/1000/gdm/Xauthority

LOG=~/.noc-watchdog.log

# (1) Chromium kiosk 살아있나? 죽었으면 재시작
if ! pgrep -f "chromium.*kiosk" > /dev/null; then
  echo "$(date '+%F %T') - Chromium 재시작" >> "$LOG"
  xset s off -dpms 2>/dev/null
  xrandr --output HDMI-1 --mode 1920x1080 --rate 60 --primary --output eDP-1 --off 2>/dev/null
  chromium --kiosk --noerrdialogs --disable-infobars \
    --disable-session-crashed-bubble \
    --check-for-update-interval=31536000 \
    --no-first-run \
    https://wci.helpbiz.kr/noc > /tmp/noc.log 2>&1 &
fi

# (2) 해상도 회귀 감지 — mutter가 되돌렸으면 1080p 강제
CUR=$(xrandr 2>/dev/null | grep "HDMI-1 connected primary" | grep -oE '[0-9]+x[0-9]+' | head -1)
if [ "$CUR" != "1920x1080" ] && [ -n "$CUR" ]; then
  echo "$(date '+%F %T') - 해상도 복원 ($CUR -> 1920x1080)" >> "$LOG"
  xrandr --output HDMI-1 --mode 1920x1080 --rate 60 --primary --output eDP-1 --off 2>/dev/null
fi

# (3) 화면보호기 항상 OFF
xset s off -dpms 2>/dev/null
```

### 3.3 저장 + 실행 권한
- nano 저장: **Ctrl+O** → Enter → **Ctrl+X**
- 실행 권한:
```bash
chmod +x ~/bin/noc-watchdog.sh
```

### 3.4 즉시 동작 검증
```bash
# Chromium 강제 종료
DISPLAY=:1 XAUTHORITY=/run/user/1000/gdm/Xauthority pkill -f chromium
sleep 3

# Watchdog 호출 → Chromium 자동 재시작 확인
~/bin/noc-watchdog.sh
sleep 5
ps aux | grep -i chromium | grep -v grep | wc -l   # 5 이상이면 OK
cat ~/.noc-watchdog.log    # "Chromium 재시작" 1줄 보여야 함
```

---

## 4. 3단계 — Cron 4중 안전망

### 4.1 등록
```bash
crontab -e
```

(첫 사용 시 nano 선택)

마지막에 추가:
```cron
# CleanERP NOC 무인 운영 — 4중 안전망
* * * * * /home/user/bin/noc-watchdog.sh
0 4 * * * pkill -f chromium && sleep 5 && /home/user/bin/noc-watchdog.sh
0 5 * * * /sbin/reboot
```

### 4.2 검증
```bash
crontab -l
```

3줄 모두 보이면 OK.

---

## 5. 4단계 — Autostart .desktop 파일

부팅 후 GNOME 자동 진입 시 NOC 자동 시작.

### 5.1 디렉토리 + 파일 생성
```bash
mkdir -p ~/.config/autostart
nano ~/.config/autostart/noc-kiosk.desktop
```

### 5.2 nano에 붙여넣기 (Exec 라인 **반드시 한 줄**)
```
[Desktop Entry]
Type=Application
Name=CleanERP NOC Kiosk
Exec=sh -c 'sleep 10 && /home/user/bin/noc-watchdog.sh'
X-GNOME-Autostart-enabled=true
X-GNOME-Autostart-Delay=10
```

### 5.3 저장 + 검증
- 저장: **Ctrl+O** → Enter → **Ctrl+X**
```bash
cat ~/.config/autostart/noc-kiosk.desktop
```
Exec 줄이 1줄이어야 함. 줄바꿈 있으면 안 됨.

---

## 6. 5단계 — GDM 자동 로그인 (X11 강제)

부팅 후 사용자 자동 로그인.

### 6.1 설정 편집
```bash
sudo nano /etc/gdm3/custom.conf
```

`[daemon]` 섹션 아래 다음 3줄 활성화 (주석 # 제거 또는 추가):

```ini
[daemon]
AutomaticLoginEnable = true
AutomaticLogin = user
WaylandEnable=false
```

> `user` 는 노트북 실제 계정명 (`whoami` 결과). `WaylandEnable=false` 는 xrandr 사용을 위해 X11 강제.

### 6.2 sed로 한 번에 (대안)
```bash
sudo sed -i 's/^#\s*AutomaticLoginEnable\s*=.*/AutomaticLoginEnable = true/' /etc/gdm3/custom.conf
sudo sed -i 's/^#\s*AutomaticLogin\s*=.*/AutomaticLogin = user/' /etc/gdm3/custom.conf
```

### 6.3 검증
```bash
sudo grep -E "Automatic|Wayland" /etc/gdm3/custom.conf
```

다음 3줄 보여야 OK:
```
AutomaticLoginEnable = true
AutomaticLogin = user
WaylandEnable=false
```

---

## 7. 6단계 — 노트북 lid 닫아도 작동 (선택)

```bash
sudo sed -i 's/^#HandleLidSwitch=.*/HandleLidSwitch=ignore/' /etc/systemd/logind.conf
sudo sed -i 's/^#HandleLidSwitchExternalPower=.*/HandleLidSwitchExternalPower=ignore/' /etc/systemd/logind.conf
sudo sed -i 's/^#HandleLidSwitchDocked=.*/HandleLidSwitchDocked=ignore/' /etc/systemd/logind.conf
sudo systemctl restart systemd-logind
```

→ 노트북 덮개 닫고 50" TV에만 NOC 표시.

---

## 8. 7단계 — 첫 로그인 (long-lived 토큰 자동 발급 권장)

### 8.1 권장 — long-lived JWT 자동 발급 (사용자 개입 0회)

> 일반 `wciSession`은 8시간 만료라 NOC에는 부적합. NOC 전용 90일 토큰을 발급하고
> 만료 14일 전에 cron이 자동 재발급하는 구조 (2026-05-02 도입).

서버측 사전조건:
- `.env.prod` 에 `NOC_ISSUE_SECRET` (32바이트 이상) 설정 후 컨테이너 재기동.
- `POST /api/auth/noc-issue` (Bearer 시크릿) 활성 — 미설정 시 503.

NOC PC측 1회 셋업:
```bash
# 1) 시크릿 보관 (운영 .env.prod 의 NOC_ISSUE_SECRET 값)
echo '<NOC_ISSUE_SECRET>' > ~/.noc-issue-secret
chmod 600 ~/.noc-issue-secret

# 2) 갱신 스크립트 배포 (저장소의 scripts/noc-renew.sh 또는 별도 보관본)
cp scripts/noc-renew.sh ~/bin/noc-renew.sh
chmod +x ~/bin/noc-renew.sh

# 3) 첫 발급 + 쿠키 주입 + chromium 재기동
~/bin/noc-renew.sh
tail ~/.noc-renew.log    # "갱신 완료" 보여야 OK

# 4) cron 등록 — 매일 04:30 KST 만료 임박(<=14일)일 때만 실제 발급
( crontab -l 2>/dev/null | grep -v 'noc-renew'
  echo '30 4 * * * /home/user/bin/noc-renew.sh >/dev/null 2>&1' ) | crontab -
```

자동 사이클:
- 매일 04:30: `noc-renew.sh` 호출. 만료까지 14일 초과면 즉시 종료(no-op).
- 만료 14일 이내가 되는 첫 호출에서 신규 90일 토큰 발급 → 쿠키 DB INSERT → watchdog 호출로 chromium 재시작.
- 분기에 1번 자동 갱신, 사용자 개입 0회.

### 8.2 폴백 — 본체에서 SUPER_ADMIN 수동 로그인

long-lived 발급 인프라가 없거나 시크릿이 회전 중일 때:

1. 부팅 → GNOME 자동 로그인 → autostart 트리거 → Chromium kiosk 시작
2. NOC 페이지가 로그인 화면으로 redirect됨
3. 노트북에 SUPER_ADMIN 계정 입력 + 로그인
4. NOC 화면 정상 표시 → 쿠키 8시간 만료까지 유지

**세션 만료 시**: 본체 키보드 재로그인 또는 `~/bin/noc-renew.sh` 강제 호출.

---

## 9. 자동 사이클 — 일일 운영

```
04:00  Chromium kill + watchdog 호출 → Chromium 새 세션으로 재시작 (메모리 리셋)
05:00  /sbin/reboot → 시스템 전체 fresh
05:00:30  부팅 완료
05:00:35  GDM 자동 로그인 (X11 + user)
05:00:40  GNOME 세션 시작
05:00:50  autostart 트리거 (Delay 10초)
05:00:55  watchdog → Chromium kiosk 시작
05:01:00  TV에 NOC 풀스크린 ✓
이후 24h  매 1분 watchdog 살아있는지 체크
```

---

## 10. 운영 점검 (모니터링)

### 10.1 SSH로 일일 확인
```bash
ssh user@192.168.1.95 'tail -10 ~/.noc-watchdog.log; echo "---"; ps aux | grep -i chromium | grep -v grep | wc -l'
```

| 출력 | 의미 |
|---|---|
| 로그에 새 일자 1줄 + chromium ≥5 | 자동 복귀 정상 |
| 로그 비어있고 chromium ≥5 | 재시작 필요 없었음 (정상) |
| chromium 0 | 큰 문제 — 즉시 진단 |

### 10.2 매주 시각적 확인
50" TV 화면 직접 보기:
- 시계 돌아가나
- KPI 숫자 갱신되나
- 갱신 stale 인디케이터 emerald (녹색)인가

---

## 11. 트러블슈팅

### 11.1 NOC 화면 멈춤
**진단**:
```bash
ssh user@<IP>
DISPLAY=:1 XAUTHORITY=/run/user/1000/gdm/Xauthority xrandr 2>&1 | grep connected
ps aux | grep chromium | grep -v grep | wc -l
curl -sk -I https://wci.helpbiz.kr/noc -m 5 | head -1
```

**1분 안 자동 복구**됩니다 (cron watchdog). 즉시 복구:
```bash
~/bin/noc-watchdog.sh
```

### 11.2 SUPER_ADMIN 세션 만료
**8.1 long-lived 발급이 활성화된 환경**: SSH로 `~/bin/noc-renew.sh` 즉시 실행 → 90일 신규 토큰 자동 주입 + chromium 재시작. 로그: `tail ~/.noc-renew.log`.

발급 실패 시(HTTP 403/503/네트워크): 시크릿 만료/회전 또는 백엔드 `NOC_ISSUE_SECRET` 미설정 가능성. `~/.noc-renew.log` 확인 후 시크릿 재배포.

**long-lived 미사용 환경 (폴백)**: TV에 로그인 화면 표시 → 노트북 본체에서 로그인. 또는 SSH로 chromium 죽이고 watchdog 호출 후 본체에서 1회 로그인.

### 11.3 mutter가 해상도 되돌림
Watchdog 다음 사이클(최대 1분) 안 자동 복원. 즉시:
```bash
DISPLAY=:1 XAUTHORITY=/run/user/1000/gdm/Xauthority \
  xrandr --output HDMI-1 --mode 1920x1080 --rate 60 --primary --output eDP-1 --off
```

### 11.4 TV 검은 화면
1. TV 리모컨 INPUT 순환 (HDMI 1, 2, 3...)
2. 케이블 점검 (분리·재연결 30초)
3. `xrandr --auto` 강제 재인식

### 11.5 Chromium 명령 못 찾음
snap 환경 확인:
```bash
which chromium chromium-browser google-chrome
ls /snap/bin/chromium
```

watchdog 스크립트 안 `chromium` 명령을 실제 경로로 변경.

---

## 12. 보안 고려사항

| 항목 | 권장 |
|---|---|
| 자동 로그인 | LAN 또는 잠긴 관제실 환경에서만 활성 |
| 화면 노출 | 외부인 출입 가능 공간이면 민감 정보 마스킹 또는 접근 제한 토큰 사용 |
| 토큰 | 현재는 일반 SUPER_ADMIN 세션 — 7일 만료. 추후 NOC 전용 long-lived JWT 도입 권장 |
| 네트워크 | nginx에 `/noc` IP allowlist (예: LAN 192.168.0.0/16, Tailscale 100.64.0.0/10) |
| 물리 보안 | 노트북 자체에 BIOS 비밀번호 + 디스크 암호화 LUKS |

---

## 13. 점검 체크리스트 (셋업 완료 시)

- [ ] `xrandr` 출력에 HDMI-1 + 지원 해상도 보임
- [ ] `ls ~/bin/noc-watchdog.sh` 실행 가능 (chmod +x)
- [ ] `crontab -l` 3줄 (1분 watchdog + 4 AM kill + 5 AM reboot)
- [ ] `cat ~/.config/autostart/noc-kiosk.desktop` Exec 1줄
- [ ] `sudo grep "Automatic" /etc/gdm3/custom.conf` 자동 로그인 활성
- [ ] 수동 검증: `pkill -f chromium` → 5초 → watchdog 자동 복구 확인
- [ ] 50" TV에 NOC 풀스크린 표시 (시계 + KPI + 차량)
- [ ] SUPER_ADMIN 1회 로그인 완료
- [ ] 재부팅 1회 시뮬레이션 → 자동 복귀 확인

---

## 14. Phase 2 권장 후속 작업

| 작업 | 효과 |
|---|---|
| ~~**NOC 전용 long-lived JWT**~~ | ✅ **2026-05-02 구현 완료** (8.1 절). 90일 토큰 + cron 자동 갱신. |
| **Grafana + Prometheus** | 인프라 KPI 1초 해상도 추가 |
| **Slack/SMS 알람** | Critical 이벤트 발생 시 즉시 알림 |
| **CSV/PDF 일별 자동 리포트** | 5 AM reboot 직전 자동 생성 + 이메일 |
| **차량 Leaflet 지도 통합** | NOC Q3 zone에 실시간 GPS 마커 |

---

## 15. 참고 파일 위치

| 파일 | 역할 |
|---|---|
| `~/bin/noc-watchdog.sh` | 자동 복구 스크립트 |
| `~/.config/autostart/noc-kiosk.desktop` | 부팅 후 NOC 자동 시작 |
| `~/.noc-watchdog.log` | watchdog 실행 로그 |
| `/tmp/noc.log` | Chromium stdout/stderr |
| `/etc/gdm3/custom.conf` | GDM 자동 로그인 설정 |
| `/etc/systemd/logind.conf` | lid switch 동작 |
| `crontab -l` | 1분 + 4시 + 5시 cron 3종 |

---

## 16. Decommission (해체) 절차

NOC 운영 종료 시:
```bash
# Watchdog 비활성화
crontab -l | grep -v "noc-watchdog\|reboot" | crontab -

# Autostart 제거
rm ~/.config/autostart/noc-kiosk.desktop

# 자동 로그인 비활성화 (보안 복구)
sudo sed -i 's/^AutomaticLoginEnable = true/#AutomaticLoginEnable = true/' /etc/gdm3/custom.conf
sudo sed -i 's/^AutomaticLogin = user/#AutomaticLogin = user/' /etc/gdm3/custom.conf

# 스크립트 보관 (혹시 다시 사용 시)
mv ~/bin/noc-watchdog.sh ~/bin/noc-watchdog.sh.disabled

# Chromium kiosk 종료
DISPLAY=:1 XAUTHORITY=/run/user/1000/gdm/Xauthority pkill -f chromium

# lid switch 복구
sudo sed -i 's/^HandleLidSwitch=ignore/#HandleLidSwitch=ignore/' /etc/systemd/logind.conf
sudo systemctl restart systemd-logind
```

---

## 17. Decision Trace

```
[2026-04-30] 사용자 50" 디스플레이 + 구형 노트북 (netdata 가동) 보유 → 비용 0 NOC
       ↓
[Plan agent + frontend-architect 협의] 6-Zone Bento + SWR 30s + 다중 폴링
       ↓
[Phase 1 코드 commit 5e2b3b6] /noc 페이지 + 6-Zone + 자동 폴링
       ↓
[하드웨어 셋업] HDMI-1 1080p@60 + GDM 자동 로그인 + autostart + watchdog
       ↓
[검증 2026-05-01] pkill chromium → 5초 → 자동 복구 확인
       ↓
[본 문서 v1.0] — 표준 절차서
```

---

> **CleanERP — 50" + 구형 노트북 = 무인 NOC, 비용 0원, 24/7 운영.**
> 본 문서대로 진행 시 1시간 안에 셋업 완료, 1분 안에 자동 복구, 7일에 1회 손 보면 됨.

**작성일**: 2026-05-01
**검증 환경**: lab2 노트북 (192.168.1.95) + 50" TV
**참고**: [docs/04-report/2026-04-29-session-log.md](04-report/2026-04-29-session-log.md) NOC 설계 협의 내역
