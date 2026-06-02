/* 회사관리자(CONTRACTOR_ADMIN + INTERNAL_ADMIN) 매뉴얼 — 카피 + 데스크톱 목업.
   대상: 위탁업체 대표·팀장·안전관리자 (데스크톱 콘솔 + 일부 모바일)
   톤: 격식. 큰 글자. 단계 시각화.
   12 메뉴 → 13 챕터로 압축 (welcome + 콘솔 둘러보기 + 11개 핵심 메뉴 + FAQ). */

import type { ChapterData } from '../_components/Chapter';
import DesktopShot from '../_components/DesktopShot';
import KpiCardMock from '../_components/KpiCardMock';
import TableMock from '../_components/TableMock';
import ButtonMock from '../_components/ButtonMock';
import StatusChipMock from '../_components/StatusChipMock';
import FormRowMock from '../_components/FormRowMock';
import ListItemMock from '../_components/ListItemMock';

export const CONTRACTOR_META = {
  title: '회사관리자 사용설명서',
  subtitle: '대표·팀장·안전관리자를 위한 운영 콘솔 안내',
  welcome: 'CleanERP 회사관리자 콘솔은 직원 등록부터 휴가 결재, 민원 배정, 차량 운영, 안전 보고까지 회사 운영의 전 흐름을 한 화면에서 처리할 수 있게 만들어졌습니다. 1인 운영 사무실도 부담 없이 시작하실 수 있습니다.',
};

export const CONTRACTOR_CHAPTERS: ChapterData[] = [
  /* ─── 01 환영합니다 ─── */
  {
    kind: 'welcome',
    num: '01',
    title: '환영합니다',
    lead: '회사관리자 콘솔로 무엇을 할 수 있는지 한눈에 보여드립니다. 대표·팀장 모두 이 안내서로 시작하실 수 있습니다.',
    intro: '본 매뉴얼은 회사관리자(CONTRACTOR_ADMIN)와 일반관리자(INTERNAL_ADMIN) 두 직책 모두를 위한 통합 안내서입니다. 일부 기능(휴가 2차 결재·회사정보 수정·권한 매트릭스)은 회사관리자만 가능하며, 그 외는 두 직책 동일하게 작동합니다.',
    hero: (
      <DesktopShot url="wci.helpbiz.kr/dashboard" active="메인 대시보드" caption="회사관리자 콘솔 — 사이드바 + 메인 대시보드.">
        <div className="mock-h2">메인 대시보드</div>
        <div className="mock-kpi-grid">
          <KpiCardMock label="출근현황" value="26 / 30" sub="정시 24" tone="success" />
          <KpiCardMock label="미처리 민원" value="7" sub="기한 초과 2" tone="warn" />
          <KpiCardMock label="운행차량" value="12 / 14" sub="정비 1" />
          <KpiCardMock label="금일 수집량" value="14.2" unit="t" />
        </div>
      </DesktopShot>
    ),
    canDo: [
      { title: '직원·차량 등록·관리', body: '신규 직원 추가, 임시 비밀번호 발급, 차량 등록·정비 상태 관리. CSV 일괄 import 지원.' },
      { title: '휴가 결재 (1차·2차)', body: '팀장이 1차 결재 → 대표가 2차 결재. 한 화면에서 대기 중인 휴가를 모두 확인하실 수 있습니다.' },
      { title: '민원 배정·모니터링', body: '시민에게서 들어온 민원을 운전원에게 배정, 처리 기한 초과 시 자동 알림.' },
      { title: '실적·보고서 자동 출력', body: '일·월·분기 실적 자동 집계. 지자체별 양식으로 PDF·엑셀 즉시 출력.' },
      { title: '안전보건·TBM 관리', body: 'TBM 일지 작성, 안전점검 검토, 산업안전보건법 양식 자동 출력.' },
    ],
  },

  /* ─── 02 처음 로그인 + 콘솔 둘러보기 ─── */
  {
    kind: 'standard',
    num: '02',
    title: '처음 로그인 + 콘솔 둘러보기',
    lead: '운영팀이 발급한 임시 비밀번호로 처음 들어가신 뒤, 새 비밀번호로 변경합니다. 좌측 사이드바 메뉴 구조를 한 번만 익히시면 됩니다.',
    steps: [
      {
        title: '데스크톱 브라우저(크롬·엣지 권장)에서 접속합니다',
        body: '주소창에 wci.helpbiz.kr 을 입력하시면 로그인 화면이 나옵니다. 모바일에서도 사용 가능하지만 결재·일괄 등록 등은 데스크톱이 편합니다.',
      },
      { title: '아이디·임시 비밀번호로 로그인 후 새 비밀번호로 변경', body: '운영팀이 알려드린 아이디(예: HQ001)와 임시 비밀번호로 처음 로그인하시고, 본인만 아는 새 비밀번호로 변경합니다. 이후 모든 로그인은 새 비밀번호로 하시면 됩니다.' },
      {
        title: '좌측 사이드바 메뉴 4그룹을 익힙니다',
        body: '메뉴는 4그룹으로 정리되어 있습니다 — OVERVIEW(대시보드) · CORE MODULES(민원·안전·건강) · OPERATIONS(📋 결재관리·근태관리·💰 급여관리·차량·실적·보고서) · SETTINGS(사용자·대형폐기물·공지). OPERATIONS 순서는 결재관리 → 근태관리 → 급여관리 → 출퇴근제한 → 차량 순입니다.',
        screenshot: (
          <DesktopShot active="메인 대시보드" caption="좌측 사이드바 4그룹 — 매일 사용하는 메뉴는 익숙해지는 데 1주면 충분합니다.">
            <div className="mock-h2">시작하기</div>
            <FormRowMock label="첫 로그인 후" value="비밀번호 변경 → 메뉴 둘러보기" />
            <FormRowMock label="자주 쓰는 메뉴" value="대시보드 · 민원 · 근태 · 사용자관리" />
            <FormRowMock label="가끔 쓰는 메뉴" value="차량 · 안전 · 실적 · 공지" />
          </DesktopShot>
        ),
      },
      { title: '메인 대시보드에서 오늘 현황을 한눈에 봅니다', body: '출근현황·미처리 민원·운행차량·수집량 4개 KPI가 매일 자동 갱신됩니다. 휴가 신청 대기·시스템 알림도 함께 표시됩니다.' },
    ],
    tip: { title: '아이디·비밀번호를 잊었을 때', body: '운영팀(공비Lab)에 연락 주시면 본인 확인 후 새 임시 비밀번호로 재발급해 드립니다. 일반 관리자(INTERNAL_ADMIN)는 회사관리자에게도 요청 가능합니다.' },
    nextHref: '#03',
    nextDesc: '매일 가장 먼저 보시는 메인 대시보드를 살펴봅니다.',
  },

  /* ─── 03 메인 대시보드 ─── */
  {
    kind: 'standard',
    num: '03',
    title: '메인 대시보드',
    lead: '회사 운영 현황을 한 화면에 모은 페이지입니다. 매일 아침 가장 먼저 보시는 곳이며, 클릭으로 상세 화면으로 이동하실 수 있습니다.',
    steps: [
      {
        title: '4개 KPI 카드로 오늘 현황을 확인합니다',
        body: '출근현황(체크인/총원) · 미처리 민원(기한 초과 강조) · 운행차량(정비 제외) · 금일 수집량 4가지가 가장 위에 표시됩니다.',
        screenshot: (
          <DesktopShot active="메인 대시보드" caption="4개 KPI 카드 — 출근·민원·차량·수집량.">
            <div className="mock-h2">오늘의 운영 현황</div>
            <div className="mock-kpi-grid">
              <KpiCardMock label="출근 / 총원" value="26 / 30" sub="정시 24 · 지각 2" tone="success" />
              <KpiCardMock label="미처리 민원" value="7" sub="기한 초과 2건" tone="warn" />
              <KpiCardMock label="운행 / 보유" value="12 / 14" sub="정비 1 · 대기 1" />
              <KpiCardMock label="금일 수집량" value="14.2" unit="t" sub="전일 대비 +8%" />
            </div>
          </DesktopShot>
        ),
      },
      { title: '"휴가 신청 대기" 패널에서 결재할 휴가를 봅니다', body: '대기 중인 휴가 신청이 카드 형태로 표시됩니다. 각 카드를 누르시면 상세 화면으로 이동합니다.' },
      { title: '"오늘 근태 현황" 박스에서 정상·지각·결근·조정필요를 확인합니다', body: '4가지 상태별 인원수와 합계가 표시됩니다. 결근·조정필요 인원이 있으면 즉시 근태관리 메뉴로 이동해 처리해 주세요.' },
    ],
    tip: { title: '대시보드는 5분 간격으로 자동 갱신됩니다', body: '직접 새로고침하지 않아도 출근·민원·차량 데이터가 최신 상태로 유지됩니다. 화면을 띄워두고 다른 일을 하셔도 됩니다.' },
    nextHref: '#04',
  },

  /* ─── 04 민원 관리 ─── */
  {
    kind: 'standard',
    num: '04',
    title: '민원 관리',
    lead: '시민·지자체에서 들어온 민원을 운전원에게 배정하고 처리 진행을 관리하는 메뉴입니다. 처리기한 초과 민원은 자동으로 강조됩니다.',
    steps: [
      {
        title: '사이드바에서 "민원관리"를 누릅니다',
        body: '뱃지 숫자(미처리 건수)가 함께 표시됩니다. 클릭하시면 민원 목록이 열립니다.',
        screenshot: (
          <DesktopShot url="wci.helpbiz.kr/complaints" active="민원관리" caption="민원 목록 — 상태·유형·기한별 필터링 가능.">
            <div className="mock-h2">민원 관리</div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
              <ButtonMock label="+ 민원 등록" variant="primary" fullWidth={false} />
              <StatusChipMock label="미처리 7" tone="warn" />
              <StatusChipMock label="기한초과 2" tone="danger" />
            </div>
            <TableMock
              headers={['ID', '유형', '위치', '담당자', '상태']}
              rows={[
                { cells: ['#0428', '대형폐기물', '용산구 이태원동', '김운전', <StatusChipMock label="처리중" tone="info" />], highlighted: true },
                { cells: ['#0427', '음식물 미수거', '용산구 한남동', '미배정', <StatusChipMock label="기한초과" tone="danger" />] },
                { cells: ['#0426', '재활용 위반', '용산구 후암동', '박수거', <StatusChipMock label="완료" tone="success" />] },
              ]}
            />
          </DesktopShot>
        ),
      },
      { title: '"+ 민원 등록"으로 신규 민원을 직접 등록합니다', body: '시민에게서 전화로 받은 민원을 직접 입력하실 수 있습니다. 유형·위치·내용·신고자 연락처를 입력 후 저장.' },
      { title: '민원 상세에서 운전원을 배정합니다', body: '민원 카드를 클릭하시면 상세가 열립니다. "담당자 배정" 버튼을 누르고 운전원을 선택하시면 자동으로 알림이 갑니다.' },
      { title: '처리 진행을 모니터링합니다', body: '운전원이 도착·완료 시점에 자동 기록됩니다. 처리기한 초과가 임박하면 빨간 강조로 표시되며, 우선 처리하셔야 합니다.' },
    ],
    warn: { title: '처리기한을 넘긴 민원은 지자체 평가에 반영될 수 있습니다', body: '대시보드에서 매일 "기한 초과" KPI를 확인하시고, 1건이라도 발생하면 즉시 담당 운전원과 통화 부탁드립니다.' },
    nextHref: '#05',
  },

  /* ─── 05 근태 관리 ─── */
  {
    kind: 'standard',
    num: '05',
    title: '근태 관리',
    lead: '직원의 출퇴근 기록을 조회·조정하고, 월말에는 급여 산정용으로 최종화하는 메뉴입니다. 모든 조정은 감사로그에 자동 기록됩니다.',
    steps: [
      {
        title: '"근태관리" 메뉴에서 일자를 선택합니다',
        body: '달력에서 조회할 날짜를 선택하시면 그날의 직원별 출퇴근 기록이 표시됩니다.',
        screenshot: (
          <DesktopShot url="wci.helpbiz.kr/attendance" active="근태관리" caption="일자별 직원 근태 + 정상·지각·결근·조정필요 4종 상태.">
            <div className="mock-h2">근태 현황 — 2026.05.02</div>
            <div className="mock-kpi-grid">
              <KpiCardMock label="정상" value="24" tone="success" />
              <KpiCardMock label="지각" value="2" tone="warn" />
              <KpiCardMock label="결근" value="1" tone="danger" />
              <KpiCardMock label="조정필요" value="3" tone="warn" />
            </div>
            <TableMock
              headers={['직원', '출근', '퇴근', '상태']}
              rows={[
                { cells: ['김운전', '06:55', '17:02', <StatusChipMock label="정상" tone="success" />] },
                { cells: ['이수거', '07:18', '17:05', <StatusChipMock label="지각" tone="warn" />], highlighted: true },
                { cells: ['박기동', '—', '—', <StatusChipMock label="결근" tone="danger" />] },
              ]}
            />
          </DesktopShot>
        ),
      },
      { title: '문제 있는 기록은 "조정"으로 수정합니다', body: '직원이 GPS 오류로 출근이 안 잡혔거나, 외근으로 차고지 밖에서 시작한 경우 시간을 직접 수정하실 수 있습니다. 사유 입력 후 저장하시면 감사로그에 남습니다.' },
      { title: '야간근무 자동 감지', body: '22:00~06:00 사이에 출근 기록이 생성되면 workType이 자동으로 "야간"으로 설정됩니다. 야간 기준 시간대는 급여정책 설정에서 변경하실 수 있습니다.' },
      { title: '마감 해제 기능 — 💰 급여관리 > 📋 근태마감 탭', body: '"💰 급여관리" 메뉴(사이드바 OPERATIONS 그룹)에서 "📋 근태마감" 탭을 선택하면, 이미 마감된 근로자 행 오른쪽에 "해제" 버튼이 나타납니다. 클릭하면 사유 입력창이 열리며, 10자 이상 사유 입력 후 해제가 완료됩니다. 해제 후 수정 → 재마감이 가능하며 감사로그에 자동 기록됩니다.' },
      { title: '월말 마지막 날에 "월별 최종화"를 눌러 급여 산정 잠금합니다', body: '최종화하신 월의 근태는 더 이상 수정되지 않으며 급여 정산에 반영됩니다. 실수가 있다면 운영팀(공비Lab)에 unlock 요청 부탁드립니다.' },
    ],
    tip: { title: '조정이 자주 발생하는 이유', body: '대부분 GPS 권한 미허용·차고지 반경 설정 오류·외근 사전 통보 누락입니다. 1주일 이상 같은 직원이 반복되면 회사 정책 점검을 권장드립니다.' },
    nextHref: '#06',
  },

  /* ─── 06 차량 관리·운행일지 ─── */
  {
    kind: 'standard',
    num: '06',
    title: '차량 관리·운행일지',
    lead: '회사 보유 차량 등록·수정, 일일 운행일지 작성·승인을 관리합니다. 차량별 정비 이력도 자동 누적됩니다.',
    steps: [
      {
        title: '"차량관리" 메뉴에서 보유 차량을 등록합니다',
        body: '차량번호·종류·톤수·연식·구매일을 입력하시면 자동으로 ACTIVE 상태로 등록됩니다. 차량 일괄 import용 CSV 양식도 제공됩니다.',
        screenshot: (
          <DesktopShot url="wci.helpbiz.kr/vehicles" active="차량관리" caption="보유 차량 + 운행 상태 + 정비 이력.">
            <div className="mock-h2">차량 관리</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <ButtonMock label="+ 차량 등록" variant="primary" fullWidth={false} />
              <ButtonMock label="CSV 일괄 import" variant="secondary" fullWidth={false} />
            </div>
            <TableMock
              headers={['차량번호', '종류', '톤수', '운전자', '상태']}
              rows={[
                { cells: ['11가1234', '압축', '5t', '김운전', <StatusChipMock label="운행중" tone="success" />] },
                { cells: ['11가5678', '암롤', '8t', '이수거', <StatusChipMock label="정비중" tone="warn" />], highlighted: true },
                { cells: ['11가9012', '청소', '2.5t', '박기동', <StatusChipMock label="대기" tone="neutral" />] },
              ]}
            />
          </DesktopShot>
        ),
      },
      { title: '"오늘 운행일지" 탭에서 미제출 차량을 확인합니다', body: '근무 종료 후 운전원이 작성한 운행일지가 차량별로 표시됩니다. 미제출 차량은 빨간색으로 강조됩니다.' },
      { title: '운행일지를 검토하고 승인합니다', body: '시작/종료 거리, 연료 사용, 처리 폐기물량을 확인 후 "승인" 버튼을 누르시면 일지가 잠깁니다. 이상이 있으면 "반려"로 운전원에게 다시 작성 요청하실 수 있습니다.' },
      { title: '차량 연료 선택 — 휘발유(GASOLINE) 추가', body: '차량 등록·수정 시 연료 종류에 "휘발유(GASOLINE)"이 추가되었습니다. 기존에 휘발유 차량 등록이 오류가 발생하던 문제가 해결되었으니, 해당 차량은 연료 항목을 재확인해 주세요.' },
    ],
    nextHref: '#07',
  },

  /* ─── 07 실시간 차량 + NOC ─── */
  {
    kind: 'standard',
    num: '07',
    title: '실시간 차량 조회',
    lead: '회사가 실시간 GPS 추적 기능에 가입한 경우, 운행 중 차량의 위치·노선·도착 여부를 실시간으로 보실 수 있습니다.',
    steps: [
      {
        title: '"실시간 차량조회" 메뉴를 누릅니다',
        body: '이 기능은 회사 단위로 활성화된 경우에만 사이드바에 보입니다. 보이지 않으면 운영팀에 문의 부탁드립니다.',
      },
      { title: '지도에서 차량 위치를 확인합니다', body: '회사 보유 차량들이 지도에 색상별 마커로 표시됩니다. 30초마다 자동 갱신되며, 마커를 클릭하면 차량번호·운전자·현재 속도가 보입니다.' },
      {
        title: 'NOC 56" 운영센터 화면에서 6개 영역을 동시 확인',
        body: '대형 모니터(56" 4K) 환경이라면 출근·운행·민원·수집량·안전·알림 6개 영역을 한 화면에서 모두 모니터링하실 수 있습니다.',
        screenshot: (
          <DesktopShot url="wci.helpbiz.kr/noc" active="실시간 차량조회" caption="56″ 4K 운영센터 — 6개 영역 동시 모니터링.">
            <div className="mock-h2">NOC 운영센터</div>
            <div className="mock-kpi-grid">
              <KpiCardMock label="출근" value="26 / 30" tone="success" />
              <KpiCardMock label="운행" value="12 / 14" />
              <KpiCardMock label="민원" value="7" tone="warn" />
              <KpiCardMock label="수집량" value="14.2t" />
              <KpiCardMock label="안전 보고" value="3" />
              <KpiCardMock label="알림" value="12" />
            </div>
          </DesktopShot>
        ),
      },
    ],
    tip: { title: '기능이 보이지 않을 때', body: '실시간 GPS 추적은 회사별 옵션 기능입니다. 도입 문의는 운영팀(공비Lab) — 02-XXXX-XXXX 또는 contact@helpbiz.kr.' },
    nextHref: '#08',
  },

  /* ─── 08 산업안전보건 ─── */
  {
    kind: 'standard',
    num: '08',
    title: '산업안전보건',
    lead: '근로자가 모바일로 제출한 일일점검·아차사고·재해 보고를 검토하고, TBM 일지를 작성·관리하는 메뉴입니다. 중대재해처벌법 대응의 핵심.',
    steps: [
      {
        title: '"산업안전보건" 메뉴에서 미검토 보고를 확인합니다',
        body: '근로자가 새로 제출한 안전 보고가 뱃지 숫자로 표시됩니다. 일일점검·아차사고·재해 발생 3종을 한 화면에서 모두 확인하실 수 있습니다.',
        screenshot: (
          <DesktopShot url="wci.helpbiz.kr/safety" active="산업안전보건" caption="안전 보고 검토 + TBM 작성.">
            <div className="mock-h2">산업안전보건</div>
            <TableMock
              headers={['일자', '제출자', '유형', '심각도', '상태']}
              rows={[
                { cells: ['05.02', '김운전', '아차사고', <StatusChipMock label="경미" tone="warn" />, <StatusChipMock label="미검토" tone="warn" />], highlighted: true },
                { cells: ['05.01', '이수거', '일일점검', '—', <StatusChipMock label="검토완료" tone="success" />] },
                { cells: ['04.30', '박기동', '재해', <StatusChipMock label="부상" tone="danger" />, <StatusChipMock label="MOL 보고됨" tone="info" />] },
              ]}
            />
          </DesktopShot>
        ),
      },
      { title: '오늘의 TBM을 작성·등록합니다', body: '주제·상세 내용을 입력하시면 근로자들이 모바일에서 읽고 서명할 수 있게 됩니다. 어제 TBM이 있으면 복사해서 빠르게 등록하실 수 있습니다.' },
      { title: '재해 발생 보고는 24시간 내 처리합니다', body: '중상·사망 보고는 자동으로 24시간 카운트다운이 시작됩니다. 검토 후 고용노동부 자동 보고 기능을 사용하시면 법정 기한 내 신고가 처리됩니다.' },
    ],
    warn: { title: 'TBM 미서명자가 사고 시 회사 책임 가중', body: '근로자가 TBM에 서명하지 않은 상태에서 작업 중 사고가 나면 안전 교육 미실시로 간주될 수 있습니다. 매일 TBM 서명률 100% 달성 권장드립니다.' },
    nextHref: '#08b',
  },

  /* ─── 08b 날씨관리대장 ─── */
  {
    kind: 'standard',
    num: '08b',
    title: '날씨관리대장',
    lead: '산업안전보건 메뉴 아래에 위치한 날씨관리대장에서 날짜별 기상 안전 기록을 조회하고 엑셀로 출력합니다.',
    steps: [
      {
        title: '"날씨관리대장" 메뉴를 선택하고 날짜를 지정합니다',
        body: '산업안전보건 메뉴 하위에 있습니다. 날짜를 선택하면 그날 등록된 공지를 기반으로 근로자별 기상 안전 기록이 조회됩니다.',
        screenshot: (
          <DesktopShot url="wci.helpbiz.kr/weather-log" active="날씨관리대장" caption="날짜 선택 → 근로자별 기상 안전 기록 조회.">
            <div className="mock-h2">날씨관리대장</div>
            <FormRowMock label="조회 날짜" value="2026-06-01" type="header" />
            <TableMock
              headers={['직원명', '기록시간', '체감온도', '조치사항', '담당자', '사진']}
              rows={[
                { cells: ['김운전', '06:48', '31°C', '냉각조끼 착용', '이안전', '1장'] },
                { cells: ['이수거', '07:02', '31°C', '수분 보충 지시', '이안전', '—'], highlighted: true },
                { cells: ['박기동', '07:15', '30°C', '이상없음', '이안전', '—'] },
              ]}
            />
            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
              <ButtonMock label="📊 Excel(텍스트)" variant="secondary" fullWidth={false} />
              <ButtonMock label="📊 Excel(이미지 포함)" variant="secondary" fullWidth={false} />
            </div>
          </DesktopShot>
        ),
      },
      { title: '각 기록 행에서 직원명·기록시간·체감온도·조치사항·담당자·사진을 확인합니다', body: '날짜별로 공지에 연동된 근로자 기록이 한 행씩 표시됩니다. 사진이 첨부된 경우 장수가 표시되며, 클릭하면 원본 이미지를 확인할 수 있습니다.' },
      { title: '"📊 Excel(텍스트)" 또는 "📊 Excel(이미지 포함)"으로 출력합니다', body: '텍스트 전용 Excel은 용량이 작아 이메일 첨부에 적합합니다. 이미지 포함 Excel은 사진이 셀 안에 삽입되어 출력·보관용으로 활용하실 수 있습니다.' },
    ],
    tip: { title: '공지와 날씨관리대장의 관계', body: '날씨관리대장의 기록은 해당 날짜에 등록된 공지를 기준으로 집계됩니다. 공지는 공지사항 메뉴에서 별도로 등록하시면 되며, 날씨관리대장에서 직접 공지를 등록하는 기능은 제공되지 않습니다.' },
    nextHref: '#09',
  },

  /* ─── 09 사용자 관리 + 휴가 결재 ─── */
  {
    kind: 'standard',
    num: '09',
    title: '사용자 관리 + 휴가 결재',
    lead: '직원 등록·수정·퇴직 처리, 휴가 결재(1차+2차)를 한 메뉴에서 처리합니다. 회사관리자만 휴가 2차 결재가 가능합니다.',
    steps: [
      {
        title: '"사용자관리" 메뉴 → "근로자 목록" 탭에서 직원을 등록합니다',
        body: '신규 직원의 이름·전화·생년월일·직책을 입력하시면 직원번호와 임시 비밀번호가 자동 발급됩니다. 임시 비번을 직원에게 카카오톡으로 전달하시면 됩니다.',
        screenshot: (
          <DesktopShot url="wci.helpbiz.kr/users" active="사용자관리" caption="근로자 목록 + 휴가 신청 두 탭.">
            <div className="mock-h2">사용자 관리</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <ButtonMock label="+ 신규 직원" variant="primary" fullWidth={false} />
              <ButtonMock label="CSV 일괄 등록" variant="secondary" fullWidth={false} />
            </div>
            <TableMock
              headers={['이름', '직번', '직책', '연차', '상태']}
              rows={[
                { cells: ['김운전', 'EMP001', '운전원', '12.5', <StatusChipMock label="재직" tone="success" />] },
                { cells: ['이수거', 'EMP002', '수거원', '8.0', <StatusChipMock label="재직" tone="success" />] },
                { cells: ['박기동', 'EMP003', '기동반', '0.5', <StatusChipMock label="신규" tone="info" />], highlighted: true },
              ]}
            />
          </DesktopShot>
        ),
      },
      { title: '"휴가 신청" 탭에서 결재 대기 휴가를 처리합니다', body: '대기 중인 휴가가 카드로 표시됩니다. 1차 결재(팀장)는 INTERNAL_ADMIN까지 가능하며, 2차 결재(대표)는 CONTRACTOR_ADMIN만 가능합니다. 본인 직책에 해당하는 단계의 휴가가 강조됩니다.' },
      {
        title: '결재 시 본인 서명을 첨부합니다',
        body: '결재 버튼을 누르시면 본인 등록된 서명이 자동으로 휴가 신청서에 첨부됩니다. 서명이 없으면 결재가 진행되지 않습니다 — 프로필에서 먼저 서명 등록 부탁드립니다.',
        screenshot: (
          <DesktopShot active="사용자관리" caption="휴가 결재 — 1차/2차 단계 표시.">
            <div className="mock-h2">휴가 결재 대기 (3건)</div>
            <ListItemMock
              title="이수거 — 연차 05.10 (월)"
              sub="가족 행사 · 1일"
              right={<StatusChipMock label="2차 대기" tone="warn" />}
              highlighted
            />
            <ListItemMock
              title="박기동 — 반차 05.08 (금)"
              sub="병원 · 0.5일"
              right={<StatusChipMock label="1차 대기" tone="warn" />}
            />
            <ListItemMock
              title="김운전 — 가족돌봄 05.15 (수)"
              sub="자녀 학교 행사 · 1일"
              right={<StatusChipMock label="결재 완료" tone="success" />}
            />
          </DesktopShot>
        ),
      },
      { title: '직원 퇴사 시 "퇴직 처리"로 비활성화합니다', body: '퇴직일을 입력하시면 직원 계정이 비활성화되어 더 이상 로그인할 수 없게 됩니다. 데이터는 그대로 보존되어 과거 기록 조회가 가능합니다.' },
    ],
    tip: { title: '비밀번호를 잊은 직원이 있을 때', body: '"근로자 목록"에서 해당 직원을 누르신 후 "비밀번호 재설정" 버튼으로 새 임시 비번을 발급해 드릴 수 있습니다. 본인 회사 직원만 가능합니다.' },
    nextHref: '#10',
  },

  /* ─── 10 실적·통계·보고서 ─── */
  {
    kind: 'standard',
    num: '10',
    title: '실적·통계·보고서',
    lead: '근로자가 입력한 처리·반입 실적을 자동 집계하여 일·월·분기 보고서로 출력합니다. 지자체별 양식이 사전 등록되어 있어 클릭 한 번으로 즉시 출력 가능.',
    steps: [
      {
        title: '"통계/보고서" 메뉴를 누릅니다',
        body: '날짜 범위·지자체·보고서 유형 3가지를 선택하시면 자동으로 통계가 표시됩니다.',
        screenshot: (
          <DesktopShot url="wci.helpbiz.kr/reports" active="통계/보고서" caption="지자체별 양식으로 즉시 출력.">
            <div className="mock-h2">월간 보고서 — 2026.04</div>
            <FormRowMock label="지자체" value="용산구청" type="header" />
            <FormRowMock label="총 수집량" value="432.8 t" />
            <FormRowMock label="운행 차량" value="14대 · 12,840 km" />
            <FormRowMock label="처리 민원" value="128건 (기한 초과 0)" />
            <div style={{ display: 'flex', gap: 6 }}>
              <ButtonMock label="PDF 출력" variant="primary" fullWidth={false} />
              <ButtonMock label="엑셀 출력" variant="secondary" fullWidth={false} />
              <ButtonMock label="지자체 발송" variant="success" fullWidth={false} highlighted />
            </div>
          </DesktopShot>
        ),
      },
      { title: 'PDF·엑셀·CSV 형식으로 출력합니다', body: 'PDF는 결재란이 포함되어 인쇄·서명용으로 적합하고, 엑셀은 추가 가공용입니다. CSV는 외부 시스템 연동 시 사용합니다.' },
      { title: '"지자체 발송" 버튼으로 자동 전송합니다', body: '담당 지자체 환경과의 사전 등록된 이메일로 보고서가 자동 발송됩니다. 한 번에 여러 지자체 동시 발송도 가능합니다.' },
    ],
    nextHref: '#11',
  },

  /* ─── 11 공지사항 ─── */
  {
    kind: 'standard',
    num: '11',
    title: '공지사항',
    lead: '회사 내부 공지(전체·관리자급·근로자급)와 지자체에 발송되는 공지를 작성·관리합니다. 긴급도와 만료일을 설정할 수 있습니다.',
    steps: [
      { title: '"공지사항" 메뉴에서 "+ 신규 공지" 버튼을 누릅니다', body: '제목·본문·대상층·긴급도·만료일을 입력하시고 저장하시면 즉시 게시됩니다.' },
      {
        title: '대상층(audience)을 신중히 선택합니다',
        body: 'ALL(전체) / ADMIN(관리자급만) / WORKER(근로자급만) / OWNER(대표급만) 중 선택. 근로자에게 보낼 공지는 WORKER로, 팀장 회의용은 ADMIN으로 분리하시는 것을 권장드립니다.',
        screenshot: (
          <DesktopShot url="wci.helpbiz.kr/announcements" active="공지사항" caption="대상층·긴급도·만료일 3가지를 항상 함께 설정.">
            <div className="mock-h2">신규 공지 작성</div>
            <FormRowMock label="제목" placeholder="예: 5월 3일 차량 정기점검 일정 안내" type="input" />
            <FormRowMock label="대상" value="WORKER (근로자급)" />
            <FormRowMock label="긴급도" value={<StatusChipMock label="WARNING" tone="warn" />} />
            <FormRowMock label="만료일" value="2026-05-04" />
            <ButtonMock label="게시" variant="primary" highlighted />
          </DesktopShot>
        ),
      },
      { title: '긴급 공지는 INFO/WARNING/CRITICAL 3단계로 표시합니다', body: 'CRITICAL은 빨간색으로 강조되며 만료 전까지 모든 사용자 화면 상단에 고정됩니다. 진짜 긴급한 경우에만 사용 부탁드립니다.' },
    ],
    nextHref: '#12',
  },

  /* ─── 12 추가 기능: 보건기록·원가급여·대형폐기물 ─── */
  {
    kind: 'standard',
    num: '12',
    title: '추가 기능 — 보건·원가·대형폐기물',
    lead: '회사 옵션에 따라 활성화되는 3가지 추가 메뉴. 사이드바에 보이지 않으면 운영팀(공비Lab)에 활성화 요청 부탁드립니다.',
    steps: [
      { title: '건강기록카드 — 직원 건강검진 결과 보관', body: '직원별 일반·특수 건강검진 결과를 암호화하여 보관합니다. 이상 소견자는 자동으로 알림되어 사후관리(휴가·작업 제한 등)를 놓치지 않게 합니다. CONTRACTOR_ADMIN/INTERNAL_ADMIN만 조회 가능.' },
      { title: '원가급여 — 월별 인건비 자동 정산 + 임금명세서', body: '근태 기록을 기반으로 월별 근무일수·초과근무·야간근무 시간이 자동 집계됩니다. 월말 "최종화" 버튼으로 잠금 후 외부 급여 시스템으로 export 가능합니다. 임금명세서 관련 기능은 아래 세부 항목을 참고하세요.' },
      { title: '임금명세서 — 항목설정', body: '각 항목 앞에 순서번호가 표시되며, ↑↓ 버튼으로 출력 순서를 변경할 수 있습니다. 각 항목은 필수/선택 여부도 설정 가능합니다. "지급일 안내" 필드에 "매월 15일" 형식으로 입력하면 명세서에 급여지급일이 자동 표시됩니다.' },
      { title: '임금명세서 — 발송 현황', body: '발송 현황 목록의 각 행에 "내용보기" 버튼이 추가되었습니다. 클릭하면 해당 명세서 상세 내용이 펼쳐지며, "🖨 인쇄" 버튼으로 즉시 인쇄할 수 있습니다.' },
      { title: '임금명세서 — 출근일수 자동 반영', body: 'Excel에서 임금명세서를 업로드할 때 "출근일수" 컬럼이 비어있으면 근태마감 집계값이 자동으로 반영됩니다.' },
      {
        title: '대형폐기물 자동연동 — "빼기" 앱 연동',
        body: '시민이 "빼기" 앱으로 신청한 대형폐기물 수거 요청을 자동으로 민원으로 import합니다. 매일 정해진 시간에 자동 실행되며, 수동 import도 가능합니다.',
        screenshot: (
          <DesktopShot url="wci.helpbiz.kr/bulky-waste" active="대형폐기물 설정" caption="빼기 앱 자동 연동 — 시간대 + 행정동 필터.">
            <div className="mock-h2">대형폐기물 자동연동</div>
            <FormRowMock label="빼기 계정" value="용산구청 환경과" />
            <FormRowMock label="자동 import" value={<StatusChipMock label="활성화" tone="success" />} />
            <FormRowMock label="실행 시간" value="매일 06:00 / 14:00" />
            <FormRowMock label="마지막 import" value="2026-05-02 14:00 · 12건" />
            <ButtonMock label="지금 수동 import" variant="secondary" fullWidth={false} />
          </DesktopShot>
        ),
      },
    ],
    nextHref: '#13',
  },

  /* ─── 13 자주 묻는 질문 ─── */
  {
    kind: 'faq',
    num: '13',
    title: '자주 묻는 질문',
    lead: '회사관리자 역할에서 자주 나오는 질문들을 모았습니다.',
    faqs: [
      { q: 'CONTRACTOR_ADMIN과 INTERNAL_ADMIN 차이가 무엇인가요?', a: 'CONTRACTOR_ADMIN(회사관리자)는 회사 대표급으로 휴가 2차 결재·회사정보 수정·권한 매트릭스 등 모든 기능에 접근 가능합니다. INTERNAL_ADMIN(일반관리자)는 팀장·실장·안전관리자급으로 일상 운영(근태·민원·차량·안전·휴가 1차 결재)은 모두 가능하지만, 회사정보 수정과 휴가 2차 결재는 불가합니다.' },
      { q: '직원이 비밀번호를 잊었습니다', a: '"사용자관리 → 근로자 목록"에서 해당 직원을 누르신 후 "비밀번호 재설정" 버튼으로 새 임시 비번을 발급해 직원에게 카카오톡 등으로 전달하시면 됩니다.' },
      { q: '엑셀에 있는 직원·차량을 한꺼번에 등록할 수 있나요?', a: '네. "사용자관리 / 차량관리" 각 메뉴에서 "CSV 일괄 import" 버튼을 누르시면 양식을 다운로드하실 수 있습니다. 양식대로 채워서 다시 업로드하시면 자동 등록됩니다.' },
      { q: '월 최종화한 근태를 다시 수정할 수 있나요?', a: '회사관리자도 직접 unlock은 불가합니다. 운영팀(공비Lab)에 사유와 함께 요청하시면 본인 확인 후 unlock해 드립니다. 무분별한 unlock은 감사로그에 남고 지자체 신뢰도 영향을 줄 수 있어 신중히 처리됩니다.' },
      { q: '사이드바에 보이지 않는 메뉴는 어떻게 활성화하나요?', a: '실시간 차량조회·원가급여·대형폐기물 자동연동은 회사 옵션 기능입니다. 운영팀에 도입 문의하시면 빠르면 당일 내 활성화됩니다.' },
      { q: '휴가 결재가 너무 자주 와요', a: '결재 위임을 사용해 보세요. "사용자관리"에서 본인 부재 시 자동으로 다른 관리자에게 결재가 넘어가도록 설정 가능합니다.' },
      { q: '지자체에 보고서가 자동 발송되도록 하려면?', a: '"통계/보고서" 메뉴에서 보고서 출력 시 "지자체 발송" 버튼을 사용하시면 됩니다. 정기 자동 발송이 필요하시면 운영팀에 일정 설정 요청 부탁드립니다.' },
      { q: '데이터가 안 보여요. 권한 문제일까요?', a: '회사 격리 정책으로 본인 회사(contractorId)의 데이터만 보입니다. 다른 회사 데이터는 절대 노출되지 않습니다. 본인 회사 데이터인데 안 보이면 운영팀에 문의 부탁드립니다.' },
      { q: '공지가 일부 직원에게는 안 보입니다', a: '대상층(audience) 설정을 확인해 주세요. ADMIN으로 설정한 공지는 근로자에게 보이지 않습니다. 전체에 보이려면 ALL로 다시 설정하시면 됩니다.' },
    ],
  },
];
