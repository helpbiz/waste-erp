# iOS PWA 설치 체크리스트 & 트러블슈팅

> 이 프로젝트에서 실제로 겪은 문제들을 바탕으로 작성.  
> Next.js 14 App Router 기준. 신규 기능 개발 후 PWA 검증 시 참고.

---

## 1. iOS PWA 설치 필수 요건

iOS Safari에서 **홈 화면에 추가 → standalone 앱** 으로 동작하려면 아래 조건이 모두 충족되어야 한다.

| # | 요건 | 비고 |
|---|------|------|
| 1 | **HTTPS + 공인 CA 인증서** | 자체서명 인증서 불가. Let's Encrypt 등 신뢰된 CA 필수 |
| 2 | `<link rel="manifest">` **에 crossorigin 속성 없음** | ⚠️ Next.js 14 주의사항 — 아래 상세 참조 |
| 3 | manifest `display: "standalone"` | `"browser"` 이면 일반 북마크로만 추가됨 |
| 4 | `<meta name="apple-mobile-web-app-capable" content="yes">` | standalone 모드 활성화 |
| 5 | `<link rel="apple-touch-icon" href="/icons/icon-180.png">` | 홈 화면 아이콘 (180×180 권장) |
| 6 | Service Worker 등록 성공 | SW 없으면 설치는 되지만 오프라인 불가 |

---

## 2. ⚠️ Next.js 14 manifest crossorigin 문제 (핵심 주의사항)

### 문제

`metadata` 객체에 `manifest` 필드를 사용하면 Next.js가 자동으로 `crossorigin="use-credentials"` 를 추가한다.

```tsx
// ❌ 이렇게 하면 안 됨
export const metadata: Metadata = {
  manifest: '/manifest.json',   // → <link rel="manifest" href="..." crossorigin="use-credentials">
};
```

iOS Safari는 `crossorigin="use-credentials"` 가 있는 manifest 링크를 파싱하지 않는다.  
결과: 홈 화면에 추가해도 standalone 모드가 아닌 일반 Safari 탭으로 열림.

### 해결

`metadata.manifest` 를 제거하고, `<head>` 에 직접 선언한다.

```tsx
// ✅ layout.tsx
export const metadata: Metadata = {
  // manifest 필드 없음
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/icon-192.png',  // apple-touch-icon 생성용
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <head>
        {/* manifest — crossorigin 없이 직접 선언 */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="앱이름" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        {/* iOS 홈 화면 아이콘 — 180×180 명시 */}
        <link rel="apple-touch-icon" href="/icons/icon-180.png" />
      </head>
      ...
    </html>
  );
}
```

### 확인 방법

배포 후 아래 명령으로 `crossorigin` 유무를 반드시 검증:

```bash
curl -s http://localhost:3001/login | grep -o 'rel="manifest"[^>]*>'
# 정상: rel="manifest" href="/manifest.json"/>
# 비정상: rel="manifest" href="/manifest.json" crossorigin="use-credentials"/>
```

---

## 3. SSL 인증서 요건

### 자체서명(self-signed) 인증서는 PWA 설치 불가

iOS Safari는 신뢰되지 않는 인증서의 사이트에서 PWA 설치를 차단한다.  
개발 환경에서도 Let's Encrypt 또는 신뢰된 CA 인증서 사용 필수.

### Let's Encrypt 발급 (이 프로젝트 구성)

**HTTP-01 webroot 방식 (현재 운영 중)**

```
외부 포트 80 → 192.168.1.2 nginx (proxy) → 192.168.1.20:80 nginx → webroot 파일 서빙
```

```bash
# 수동 갱신 (자동 갱신 실패 시)
~/.acme.sh/acme.sh --renew -d wci.helpbiz.kr \
  --server letsencrypt \
  --webroot /opt/smartas/sites/helpbiz \
  --force
```

**자동 갱신**: cron `매일 23:43` → 만료 30일 전 자동 실행 → nginx 자동 reload

### 인증서 교체 후 iOS 브라우저 캐시

인증서를 교체한 직후 iOS Safari가 이전 인증서 에러를 캐싱하고 있을 수 있다.  
해결: Safari **설정 → Safari → 방문 기록 및 웹 사이트 데이터 지우기** 후 재시도.

---

## 4. manifest.json 작성 기준

```json
{
  "name": "앱 전체 이름",
  "short_name": "짧은 이름 (홈 화면 표시용, 12자 이내 권장)",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "orientation": "portrait-primary",
  "background_color": "#ffffff",
  "theme_color": "#0e7490",
  "lang": "ko-KR",
  "icons": [
    { "src": "/icons/icon-180.png",         "sizes": "180x180",   "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-192.png",         "sizes": "192x192",   "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-512.png",         "sizes": "512x512",   "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-maskable-512.png","sizes": "512x512",   "type": "image/png", "purpose": "maskable" }
  ]
}
```

**주의사항**

- `icons` 배열에 최소 192×192, 512×512 포함 필수
- iOS는 `apple-touch-icon` 링크를 우선 사용하므로 manifest icons와 별도로 관리
- `start_url` 은 로그인 이후 진입점(`/worker` 등)으로 설정 가능

---

## 5. Service Worker 주의사항

### sw.js 경로와 scope

SW는 등록된 경로의 하위 경로만 제어한다. `/sw.js` 로 등록하면 전체 scope `/` 제어 가능.

```typescript
// middleware.ts — sw.js 를 인증 없이 서빙
if (path === '/sw.js') return NextResponse.next();
```

### iOS에서 SW 업데이트

iOS Safari는 SW 업데이트가 느리다. 강제 업데이트 패턴:

```typescript
// _sw-register.tsx
reg.addEventListener('updatefound', () => {
  const next = reg.installing;
  next?.addEventListener('statechange', () => {
    if (next.state === 'installed') next.postMessage('SKIP_WAITING');
  });
});
navigator.serviceWorker.addEventListener('controllerchange', () => {
  window.location.reload();  // 새 SW 활성화 시 자동 새로고침
});
```

### Cache-Control

sw.js 응답에는 반드시 캐싱 비활성화:

```
Cache-Control: no-store, no-cache, must-revalidate, max-age=0
```

---

## 6. 설치 전 검증 체크리스트

새 기능 개발 후 iOS PWA 배포 전 확인 항목:

```
□ manifest 링크에 crossorigin 속성 없음
  curl -s https://[도메인]/login | grep 'rel="manifest"'

□ SSL 인증서 공인 CA 발급 확인
  openssl s_client -connect [도메인]:443 </dev/null 2>/dev/null | openssl x509 -noout -issuer

□ manifest.json 정상 서빙
  curl -s https://[도메인]/manifest.json | python3 -m json.tool

□ sw.js 정상 서빙 + Cache-Control: no-store
  curl -sI https://[도메인]/sw.js | grep -E "200|Cache-Control"

□ apple-touch-icon 링크 존재
  curl -s https://[도메인]/login | grep 'apple-touch-icon'

□ apple-mobile-web-app-capable 메타태그 존재
  curl -s https://[도메인]/login | grep 'apple-mobile-web-app-capable'

□ manifest display: standalone 확인
  curl -s https://[도메인]/manifest.json | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['display'])"
```

---

## 7. 트러블슈팅 플로우

```
홈 화면 추가가 안 됨
│
├─ "추가" 버튼 자체가 없음
│   └─ HTTPS 인증서 문제 또는 페이지 완전 로드 실패
│       → 인증서 확인, Safari 콘솔 오류 확인
│
├─ 추가는 됐는데 일반 브라우저 탭으로 열림 (standalone 아님)
│   ├─ manifest crossorigin 문제  ← 이 프로젝트에서 실제 발생
│   │   → metadata.manifest 제거, <head>에 직접 선언
│   ├─ manifest display 값 확인 ("standalone" 인지)
│   └─ manifest 파싱 오류 (JSON 문법 등)
│
└─ 설치 후 아이콘이 이상함
    └─ apple-touch-icon 사이즈/경로 확인 (180×180 PNG)
```
