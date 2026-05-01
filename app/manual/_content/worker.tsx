/* 근로자(WORKER) 매뉴얼 — 모든 카피 + 화면 목업.
   대상: 운전원·수거원·기동반·환경공무직 (모바일 PWA)
   톤: 격식·큰 글자·단계 시각화. 배려.
   구조: array of ChapterData — Chapter 컴포넌트가 자동 렌더.

   .ts → .tsx 확장: step 마다 ScreenShot JSX 인라인 가능.
   2026-05-02 수정: 매뉴얼 ↔ 실 UI 불일치 3건 보정 (Ch.04 휴가 진입 / Ch.09 민원 탭 / Ch.12 추천경로 진입).
*/

import type { ChapterData } from '../_components/Chapter';
import ScreenShot from '../_components/ScreenShot';
import ButtonMock from '../_components/ButtonMock';
import StatusChipMock from '../_components/StatusChipMock';
import FormRowMock from '../_components/FormRowMock';
import ListItemMock from '../_components/ListItemMock';
import MapPlaceholder from '../_components/MapPlaceholder';

export const WORKER_META = {
  title: '근로자 사용설명서',
  subtitle: '운전원·수거원·기동반을 위한 모바일 사용 안내',
  welcome: 'CleanERP는 여러분의 출퇴근부터 휴가 신청, 안전점검까지 폰 하나로 처리할 수 있게 만들어졌습니다. 이 안내서가 첫 사용을 끝까지 함께해 드립니다.',
};

export const WORKER_CHAPTERS: ChapterData[] = [
  /* ─── 01 환영합니다 ─── */
  {
    kind: 'welcome',
    num: '01',
    title: '환영합니다',
    lead: 'CleanERP로 무엇을 할 수 있는지 한눈에 보여드립니다. 이 안내서는 폰을 처음 다루시는 분도 막힘없이 따라오실 수 있도록 단계별로 정리되어 있습니다.',
    intro: 'CleanERP 워커앱은 여러분이 매일 하시는 일들 — 출퇴근, 작업 확인, 휴가 신청, 안전 보고, 민원 처리 — 을 폰 하나로 빠르게 처리할 수 있도록 돕습니다.',
    hero: (
      <ScreenShot appBar={{ title: '워커앱 홈', role: 'worker' }} activeTab="home" caption="앱을 열면 첫 화면 — 하단 5개 탭으로 모든 기능에 접근합니다.">
        <FormRowMock label="안녕하세요" value="김운전 님" type="header" />
        <ListItemMock title="오늘 출근" sub="07:00 차고지 도착" right={<StatusChipMock label="대기" tone="warn" />} />
        <ListItemMock title="배정된 민원" sub="대형폐기물 3건" right={<StatusChipMock label="3건" tone="info" />} />
        <ListItemMock title="오늘 TBM" sub="높은 곳 작업 안전" right={<StatusChipMock label="서명필요" tone="warn" />} />
      </ScreenShot>
    ),
    canDo: [
      { title: '출퇴근 도장 찍기', body: '차고지에 도착하시면 폰으로 GPS 출퇴근. 종이 출근부 작성 없이 자동 기록됩니다.' },
      { title: '오늘의 작업 보기', body: '오늘 배정된 민원·노선·차량을 한 화면에서 확인하실 수 있습니다.' },
      { title: '휴가 신청하기', body: '연차·반차·경조사 등을 폰에서 바로 신청. 결재 진행 상황도 실시간으로 보입니다.' },
      { title: '안전 보고·서명', body: '일일점검 7개 항목과 TBM 서명을 모바일로. 종이 서명 받으러 다닐 일이 없어집니다.' },
      { title: '민원 처리·도착확인', body: '배정된 민원 위치를 지도로 확인, 처리 완료 사진을 첨부해 즉시 보고할 수 있습니다.' },
    ],
  },

  /* ─── 02 처음 로그인하기 ─── */
  {
    kind: 'standard',
    num: '02',
    title: '처음 로그인하기',
    lead: '회사 관리자가 발급해 드린 임시 비밀번호로 처음 들어가신 뒤, 본인만 아는 새 비밀번호로 변경합니다. 이 단계는 한 번만 하시면 됩니다.',
    steps: [
      {
        title: '주소창에 서비스 주소를 입력합니다',
        body: '폰의 인터넷 브라우저(크롬·사파리)를 열고 주소창에 wci.helpbiz.kr 을 입력해 주세요. 회사 관리자가 보내드린 카카오톡의 링크를 누르셔도 됩니다.',
      },
      {
        title: '직원번호와 임시 비밀번호를 입력합니다',
        body: '회사 관리자가 알려드린 직원번호(예: EMP001)와 임시 비밀번호를 입력하신 후 로그인 버튼을 눌러 주세요.',
        screenshot: (
          <ScreenShot appBar={{ title: 'CleanERP 로그인', role: 'worker' }} caption="아이디와 임시 비밀번호 입력 후 로그인 버튼.">
            <FormRowMock label="직원번호" value="EMP001" type="input" />
            <FormRowMock label="비밀번호" placeholder="임시 비밀번호" type="input" />
            <ButtonMock label="로그인" variant="primary" highlighted />
          </ScreenShot>
        ),
      },
      {
        title: '개인정보 수집 동의서를 읽고 동의합니다',
        body: '처음 로그인하실 때 동의 화면이 나옵니다. 천천히 읽으시고 하단의 동의 버튼을 눌러 주세요. 한 번 동의하시면 다시 묻지 않습니다.',
      },
      {
        title: '새 비밀번호로 변경합니다',
        body: '본인만 알 수 있는 비밀번호로 바꿔 주세요. 영문·숫자 포함 8자 이상을 권장드립니다.',
        screenshot: (
          <ScreenShot appBar={{ title: '비밀번호 변경', role: 'worker', showBack: true }} caption="새 비밀번호는 영문+숫자 8자 이상.">
            <FormRowMock label="현재 비밀번호" placeholder="임시 비밀번호" type="input" />
            <FormRowMock label="새 비밀번호" placeholder="8자 이상" type="input" />
            <FormRowMock label="새 비밀번호 확인" placeholder="다시 한 번" type="input" />
            <ButtonMock label="비밀번호 변경" variant="primary" highlighted />
          </ScreenShot>
        ),
      },
      { title: '홈 화면에 바로가기를 추가합니다 (선택)', body: '브라우저 메뉴에서 "홈 화면에 추가"를 누르시면 앱처럼 아이콘이 생깁니다. 다음부터는 아이콘 한 번에 바로 들어오실 수 있습니다.' },
    ],
    tip: { title: '비밀번호를 잊으셨다면', body: '회사 관리자에게 말씀해 주세요. 새 임시 비밀번호로 다시 발급해 드립니다. 본인 확인 후 1분이면 처리됩니다.' },
    warn: { title: '비밀번호는 다른 사람과 절대 공유하지 마세요', body: '여러분의 출퇴근·휴가·서명 모두에 본인 책임이 따릅니다. 동료에게 알려주시거나 메모지에 적어두지 않도록 주의 부탁드립니다.' },
    nextHref: '#03',
    nextDesc: '로그인을 마치셨다면 다음 단계는 첫 출근 등록입니다.',
  },

  /* ─── 03 출근 도장 찍기 ─── */
  {
    kind: 'standard',
    num: '03',
    title: '출근 도장 찍기',
    lead: '차고지에 도착하시면 폰으로 GPS 출근을 찍어주세요. 정확한 위치 확인 후 한 번에 등록되며, 종이 출근부 작성이 필요 없습니다.',
    steps: [
      {
        title: '워커앱을 열고 "출퇴근" 탭을 누릅니다',
        body: '하단 다섯 개 탭 중 가운데에 가까운 시계 모양 아이콘이 "출퇴근"입니다. 누르시면 오늘 날짜·시각과 함께 출근 화면이 나옵니다.',
        screenshot: (
          <ScreenShot appBar={{ title: '워커앱', role: 'worker' }} activeTab="clock" caption="하단 두 번째 시계 아이콘이 '출퇴근' 탭입니다.">
            <ListItemMock title="안녕하세요 김운전 님" sub="2026년 5월 2일 (금)" />
            <ListItemMock title="오늘 출근 대기 중" sub="차고지 도착 후 출퇴근 탭 → 출근하기" right={<StatusChipMock label="대기" tone="warn" />} />
          </ScreenShot>
        ),
      },
      { title: '위치 권한을 한 번 허용해 주세요', body: '폰이 현재 위치를 가져오기 위해 권한을 묻습니다. "허용"을 한 번 눌러주시면 다음부터는 자동으로 동작합니다. 위치는 ~10m 격자로 처리되어 90일 후 자동 폐기됩니다.' },
      {
        title: 'GPS 신호가 잡힐 때까지 잠시 기다립니다',
        body: '"위치 확인 중..."이 표시되다가 "준비 완료"로 바뀝니다. 보통 1~5초가 걸리며, 실내·지하주차장에서는 더 오래 걸릴 수 있습니다.',
        screenshot: (
          <ScreenShot appBar={{ title: '출퇴근', role: 'worker', showBack: true }} activeTab="clock" caption="위치 확인이 끝나면 '준비 완료'로 바뀝니다.">
            <FormRowMock label="현재 시각" value="07:02" />
            <FormRowMock label="GPS 상태" value={<StatusChipMock label="위치 확인 중…" tone="warn" />} />
            <ButtonMock label="출근하기" variant="disabled" />
          </ScreenShot>
        ),
      },
      {
        title: '출근하기 버튼을 누릅니다',
        body: '"출근하기" 버튼이 활성화되면 한 번 눌러주세요. 등록 완료 메시지와 함께 출근 시간이 화면에 표시됩니다.',
        screenshot: (
          <ScreenShot appBar={{ title: '출퇴근', role: 'worker', showBack: true }} activeTab="clock" caption="GPS 준비가 끝나면 초록 '출근하기' 버튼이 활성화됩니다.">
            <FormRowMock label="현재 시각" value="07:03" />
            <FormRowMock label="GPS 상태" value={<StatusChipMock label="준비 완료 ✓" tone="success" />} />
            <FormRowMock label="담당 차고지" value="용산구 청파동" />
            <ButtonMock label="출근하기" variant="success" highlighted />
          </ScreenShot>
        ),
      },
      { title: '퇴근 시에도 같은 방법으로', body: '근무 종료 후 같은 화면에서 "퇴근하기" 버튼을 눌러주시면 됩니다. 출근 기록이 있어야 퇴근 버튼이 활성화됩니다.' },
    ],
    tip: { title: 'GPS 신호가 잘 안 잡힐 때', body: '실내·지하라면 차고지 마당으로 잠깐 나오시면 신호가 빨리 잡힙니다. 그래도 안 되면 화면의 "다시 시도" 버튼을 눌러 주세요. 폰의 위치 서비스가 꺼져 있는 경우도 있으니 설정에서 켜져 있는지 확인 부탁드립니다.' },
    warn: { title: '차고지 반경 밖에서는 출근이 등록되지 않습니다', body: '회사가 등록한 차고지 GPS 반경(보통 100m) 안에서만 출근이 가능합니다. 외근 등으로 차고지 외부에서 시작하는 경우 회사 관리자에게 미리 말씀해 주세요.' },
    nextHref: '#04',
    nextDesc: '출퇴근에 익숙해지셨다면 휴가 신청도 폰에서 바로 해보세요.',
  },

  /* ─── 04 휴가 신청하기 (Ch.04 카피 수정: "더보기 탭" → "홈 그리드 카드") ─── */
  {
    kind: 'standard',
    num: '04',
    title: '휴가 신청하기',
    lead: '연차·반차·경조사 등 모든 휴가는 폰에서 직접 신청하실 수 있습니다. 결재 진행 상황도 실시간으로 보이며, 결재 전이라면 취소도 가능합니다.',
    steps: [
      {
        title: '홈 화면에서 "휴가 신청" 카드를 누릅니다',
        body: '하단 "홈" 탭으로 이동하시면 메뉴 카드들이 보입니다. 그중 "휴가 신청" 카드를 한 번 눌러주세요.',
        screenshot: (
          <ScreenShot appBar={{ title: '워커앱 홈', role: 'worker' }} activeTab="home" caption="홈 화면 중간의 메뉴 카드 — '휴가 신청'을 누릅니다.">
            <ListItemMock title="휴가 신청" sub="연차·반차·경조사 등" right={<span style={{ fontSize: 18 }}>→</span>} highlighted />
            <ListItemMock title="내 프로필" sub="사진·서명·연락처" right={<span style={{ fontSize: 18 }}>→</span>} />
            <ListItemMock title="추천경로" sub="기동반 전용" right={<span style={{ fontSize: 18 }}>→</span>} />
          </ScreenShot>
        ),
      },
      {
        title: '내 잔여 연차를 확인합니다',
        body: '화면 상단에 올해 부여받은 연차·사용한 연차·남은 연차가 표시됩니다. 신청 전에 확인 부탁드립니다.',
        screenshot: (
          <ScreenShot appBar={{ title: '휴가 신청', role: 'worker', showBack: true }} caption="잔여 연차가 큰 숫자로 표시됩니다.">
            <FormRowMock label="올해 부여" value="15일" />
            <FormRowMock label="사용한 연차" value="2.5일" />
            <FormRowMock label="남은 연차" value="12.5일" />
            <ButtonMock label="+ 휴가 신청" variant="primary" highlighted />
          </ScreenShot>
        ),
      },
      { title: '"+ 휴가 신청" 버튼을 누릅니다', body: '휴가 유형(연차·반차·경조사·가족돌봄 등 11종)을 선택하시고, 시작일과 종료일을 달력에서 골라주세요. 반차의 경우 자동으로 0.5일로 계산됩니다.' },
      { title: '신청 사유를 간단히 적어주세요', body: '"가족 행사", "건강 검진" 등 간단한 사유면 충분합니다. 경조사·병가의 경우 회사 정책에 따라 증빙서류 제출이 필요할 수 있습니다.' },
      {
        title: '신청 후 결재 진행을 확인합니다',
        body: '신청을 누르시면 1차 결재(팀장) → 2차 결재(대표)로 자동 전달됩니다. 휴가 목록에서 "신청 / 결재중 / 결재완료 / 반려" 상태가 실시간으로 표시됩니다.',
        screenshot: (
          <ScreenShot appBar={{ title: '내 휴가 목록', role: 'worker', showBack: true }} caption="결재 진행 상태가 실시간 표시됩니다.">
            <ListItemMock title="연차 — 05.10 (월)" sub="가족 행사 · 1일" right={<StatusChipMock label="결재 중" tone="warn" />} />
            <ListItemMock title="반차 — 04.28 (월)" sub="병원 · 0.5일" right={<StatusChipMock label="결재 완료" tone="success" />} />
            <ListItemMock title="연차 — 04.15 (화)" sub="개인 사정 · 1일" right={<StatusChipMock label="반려" tone="danger" />} />
          </ScreenShot>
        ),
      },
    ],
    tip: { title: '신청한 휴가를 취소하고 싶을 때', body: '결재가 시작되기 전(상태가 "신청"일 때)에는 휴가 목록에서 직접 취소하실 수 있습니다. 1차 결재가 진행된 후에는 회사 관리자에게 직접 말씀해 주세요.' },
    warn: { title: '잔여 연차가 부족하면 신청이 안 될 수 있습니다', body: '남은 연차보다 많은 일수를 신청하시면 경고가 표시됩니다. 무급휴가·특별휴가가 필요하시다면 회사 관리자와 먼저 상의 부탁드립니다.' },
    nextHref: '#05',
    nextDesc: '안전한 작업의 시작 — 일일 안전점검을 알아봅니다.',
  },

  /* ─── 05 안전 - 일일점검 ─── */
  {
    kind: 'standard',
    num: '05',
    title: '안전 — 일일 점검',
    lead: '근무 시작 전 안전용품과 차량 상태를 확인하는 7개 항목 체크리스트입니다. 매일 한 번 1분이면 끝나며, 사고 예방의 첫 단계입니다.',
    steps: [
      {
        title: '"안전" 탭을 누르고 "일일점검"을 선택합니다',
        body: '하단 탭에서 방패 모양 아이콘을 누르시면 안전 화면이 열립니다. 상단의 "일일점검" 탭을 선택해 주세요.',
        screenshot: (
          <ScreenShot appBar={{ title: '안전 · 점검', role: 'worker' }} activeTab="safety" caption="안전 화면 상단의 3개 탭 — '일일점검' 활성화.">
            <div style={{ display: 'flex', gap: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 800, padding: '6px 10px', background: '#0e7490', color: 'white', borderRadius: 4 }}>일일점검</span>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '6px 10px', color: '#64748b', borderRadius: 4 }}>아차/재해</span>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '6px 10px', color: '#64748b', borderRadius: 4 }}>TBM</span>
            </div>
            <FormRowMock label="🪖 안전모" value={<StatusChipMock label="✓" tone="success" />} />
            <FormRowMock label="🦺 안전조끼" value={<StatusChipMock label="✓" tone="success" />} />
            <FormRowMock label="🧤 장갑" value={<StatusChipMock label="—" tone="neutral" />} />
          </ScreenShot>
        ),
      },
      { title: '7개 항목을 차례로 점검합니다', body: '안전모·안전조끼·장갑·신발·타이어·브레이크·리프트 7개를 직접 확인하시고 화면에서 체크해 주세요. 이상이 있는 항목은 체크하지 않으시면 됩니다.' },
      { title: '비상 연락처와 오늘 날씨를 확인합니다', body: '화면 하단에 보호자 연락처와 오늘 기온·습도·풍속이 함께 표시됩니다. 폭염·강풍 시에는 작업 전 회사 관리자와 상의 부탁드립니다.' },
      {
        title: '"제출" 버튼을 누릅니다',
        body: '체크가 끝나면 한 번에 제출됩니다. 제출 시각이 기록되어 안전 입증 자료로 자동 보관됩니다.',
        screenshot: (
          <ScreenShot appBar={{ title: '일일 점검', role: 'worker', showBack: true }} caption="7개 항목 체크 후 '제출'.">
            <FormRowMock label="체크 진행" value="7 / 7" />
            <FormRowMock label="현재 기온" value="14°C · 풍속 3m/s" />
            <ButtonMock label="제출" variant="success" highlighted />
          </ScreenShot>
        ),
      },
    ],
    warn: { title: '체크하지 않은 항목은 작업 전 점검이 필요합니다', body: '안전모·신발 등 빠진 항목은 즉시 보충해 주세요. 미점검 상태로 작업하시면 안전사고 시 본인과 회사 모두에게 책임이 따릅니다.' },
    nextHref: '#06',
    nextDesc: '갑작스런 상황이 생기면 — 아차사고·재해 보고 방법을 알아봅니다.',
  },

  /* ─── 06 안전 - 아차사고·재해 보고 ─── */
  {
    kind: 'standard',
    num: '06',
    title: '안전 — 아차사고·재해 보고',
    lead: '작업 중 사고가 났거나 다칠 뻔했다면 즉시 보고해 주세요. 산업안전보건법은 재해 발생 시 24시간 또는 30일 이내 보고를 의무화하고 있습니다.',
    steps: [
      { title: '"안전" 탭에서 "아차/재해" 탭을 누릅니다', body: '안전 화면 상단의 "아차/재해" 탭을 선택해 주세요. 보고 화면이 열립니다.' },
      { title: '보고 유형을 고릅니다', body: '"아차사고" — 다치진 않았지만 위험했던 상황 / "재해 발생" — 부상·중상·사망이 있었던 상황. 둘 중 해당하는 것을 선택해 주세요.' },
      {
        title: '심각도와 상황을 간단히 적습니다',
        body: '경미·부상·중상·사망 중 해당 항목을 누르시고, 어떤 일이 있었는지 5자 이상 적어주세요. 발생 위치는 자동으로 현재 위치가 입력됩니다.',
        screenshot: (
          <ScreenShot appBar={{ title: '아차/재해 보고', role: 'worker', showBack: true }} caption="유형·심각도·상황·위치를 차례대로 입력.">
            <FormRowMock label="유형" value={<StatusChipMock label="아차사고" tone="warn" />} />
            <FormRowMock label="심각도" value={<StatusChipMock label="경미" tone="neutral" />} />
            <FormRowMock label="상황" placeholder="예: 적재함 미끄러짐" type="input" />
            <FormRowMock label="발생 위치" value="용산구 한남동 (자동)" />
            <ButtonMock label="제출" variant="danger" highlighted />
          </ScreenShot>
        ),
      },
      { title: '"제출" 버튼을 누릅니다', body: '제출되면 회사 관리자에게 즉시 알림이 갑니다. 중상·사망 보고는 자동으로 24시간 기한 카운트다운이 시작됩니다.' },
    ],
    tip: { title: '큰 부상·중상이라면 먼저 119에 신고', body: '본인이나 동료의 응급 상황이라면 매뉴얼 기록보다 119 신고가 우선입니다. 응급 처치 후 안정되면 그때 보고해 주세요. 사고 시 즉시 사용할 수 있는 SOS 버튼도 있습니다 (다음 챕터 참고).' },
    nextHref: '#07',
  },

  /* ─── 07 TBM 서명 ─── */
  {
    kind: 'standard',
    num: '07',
    title: 'TBM 서명',
    lead: 'TBM(Tool Box Meeting)은 작업 시작 전 5~10분 안전 교육입니다. 매일 회사 관리자가 등록하는 그날의 주제를 확인하고 손가락으로 서명해 주세요.',
    steps: [
      {
        title: '"안전" 탭의 "TBM" 탭을 누릅니다',
        body: '오늘의 TBM 주제와 상세 내용이 표시됩니다. 회사 관리자가 아직 등록하지 않은 경우 "오늘 TBM 미등록"으로 보일 수 있습니다.',
        screenshot: (
          <ScreenShot appBar={{ title: '안전 · TBM', role: 'worker' }} activeTab="safety" caption="오늘의 TBM 주제와 본문이 표시됩니다.">
            <FormRowMock label="주제" value="높은 곳 작업 안전" type="header" />
            <div style={{ fontSize: 11, color: '#475569', padding: '6px 10px', background: 'white', borderRadius: 6, lineHeight: 1.5 }}>
              안전모와 안전벨트 착용 필수. 사다리는 두 사람이 잡고 작업하며, 비 오는 날은 작업을 중단합니다.
            </div>
            <FormRowMock label="서명 인원" value="3 / 5" />
          </ScreenShot>
        ),
      },
      { title: 'TBM 내용을 읽습니다', body: '오늘 작업의 주의사항·위험 요인을 천천히 읽어주세요. 이해가 안 되는 부분은 동료·관리자에게 바로 확인 부탁드립니다.' },
      {
        title: '서명 칸에 손가락으로 서명합니다',
        body: '화면 아래 흰 박스에 본인 서명을 그려 주세요. 잘못 그렸다면 "지우기" 버튼으로 다시 시작하실 수 있습니다.',
        screenshot: (
          <ScreenShot appBar={{ title: 'TBM 서명', role: 'worker', showBack: true }} caption="흰 박스에 손가락으로 서명.">
            <div style={{ background: 'white', height: 80, borderRadius: 6, border: '1px dashed #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 11, fontWeight: 600 }}>
              여기에 손가락으로 서명
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <ButtonMock label="지우기" variant="secondary" fullWidth={false} />
              <ButtonMock label="서명 저장" variant="primary" highlighted />
            </div>
          </ScreenShot>
        ),
      },
      { title: '"서명 저장" 버튼을 누릅니다', body: '서명이 저장되며 회사 관리자가 누가 참석·서명했는지 확인할 수 있게 됩니다. 동일 TBM에는 한 번만 서명하실 수 있습니다.' },
    ],
    warn: { title: '서명을 미루면 안전 작업 입증이 어려워집니다', body: 'TBM 서명은 사고 발생 시 회사가 안전 교육을 실시했음을 입증하는 핵심 자료입니다. 가능하시면 작업 시작 전 즉시 서명 부탁드립니다.' },
    nextHref: '#08',
  },

  /* ─── 08 SOS 긴급 신고 ─── */
  {
    kind: 'standard',
    num: '08',
    title: 'SOS — 긴급 상황 신고',
    lead: '본인이나 동료의 응급 상황 발생 시 한 번의 터치로 회사 관리자와 119에 즉시 알림을 보내는 기능입니다.',
    steps: [
      {
        title: '"안전" 탭 상단의 빨간색 "SOS" 버튼을 누릅니다',
        body: '실수로 누를 일이 거의 없도록 누른 후 "정말 보낼까요?" 한 번 더 묻습니다. "예"를 눌러주세요.',
        screenshot: (
          <ScreenShot appBar={{ title: '안전 · SOS', role: 'worker' }} activeTab="safety" caption="안전 화면 상단의 빨간 SOS 버튼.">
            <ButtonMock label="🚨 SOS · 긴급 신고" variant="danger" highlighted />
            <FormRowMock label="대상" value="회사 관리자 + 119" />
            <FormRowMock label="현재 위치" value="자동 첨부됨" />
          </ScreenShot>
        ),
      },
      { title: '현재 위치가 자동으로 함께 전달됩니다', body: '여러분의 GPS 좌표·주소가 회사 관리자에게 즉시 전송됩니다. 통화·문자 모두 함께 갈 수 있습니다.' },
      { title: '가능하시면 상황을 짧게 입력합니다', body: '"동료 부상", "차량 사고" 등 한 줄이면 됩니다. 시간이 없다면 비워두셔도 SOS는 그대로 발송됩니다.' },
    ],
    warn: { title: 'SOS는 정말 긴급할 때만 사용해 주세요', body: '회사 관리자뿐 아니라 119·병원 등 외부 기관에도 알림이 갈 수 있습니다. 잘못 누른 경우 즉시 회사 관리자에게 연락해 상황 설명 부탁드립니다.' },
    nextHref: '#09',
  },

  /* ─── 09 민원 처리 (Ch.09 카피 수정: "내 민원" 탭 명시) ─── */
  {
    kind: 'standard',
    num: '09',
    title: '민원 처리하기',
    lead: '시민이 신고한 민원이 본인에게 배정되면 알림이 옵니다. 위치를 지도로 확인하시고 현장 처리 후 사진을 첨부해 완료를 보고해 주세요.',
    steps: [
      {
        title: '"민원" 탭에서 "내 민원" 탭을 선택합니다',
        body: '하단 민원 탭으로 들어가시면 상단에 "내 민원 / 신규 등록" 두 개의 탭이 있습니다. "내 민원"을 누르시면 본인에게 배정된 민원 목록이 보입니다.',
        screenshot: (
          <ScreenShot appBar={{ title: '민원', role: 'worker' }} activeTab="complaint" caption="상단 두 탭 — '내 민원' 활성화.">
            <div style={{ display: 'flex', gap: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 800, padding: '6px 10px', background: '#0e7490', color: 'white', borderRadius: 4 }}>내 민원 (3)</span>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '6px 10px', color: '#64748b', borderRadius: 4 }}>신규 등록</span>
            </div>
            <ListItemMock title="대형폐기물 #2026-0428" sub="용산구 이태원동" right={<StatusChipMock label="배정됨" tone="warn" />} />
            <ListItemMock title="음식물 미수거 #2026-0427" sub="용산구 한남동" right={<StatusChipMock label="처리중" tone="info" />} />
          </ScreenShot>
        ),
      },
      { title: '민원 상세를 누르고 위치를 확인합니다', body: '민원 카드를 누르시면 시민이 신고한 위치가 지도에 표시됩니다. 주소·신고 사진(있는 경우)·처리 기한이 함께 보입니다.' },
      {
        title: '현장에 도착하면 "도착" 버튼을 누릅니다',
        body: '도착 시각과 GPS가 자동 기록되어 회사 관리자에게 전달됩니다. 도착 전후 시간이 처리 KPI로 활용됩니다.',
        screenshot: (
          <ScreenShot appBar={{ title: '민원 #2026-0428', role: 'worker', showBack: true }} caption="지도 + 도착 버튼.">
            <MapPlaceholder pinX="58%" pinY="42%" label="용산구 이태원동" height={100} />
            <FormRowMock label="유형" value="대형폐기물" />
            <ButtonMock label="현장 도착" variant="primary" highlighted />
          </ScreenShot>
        ),
      },
      { title: '처리 후 사진을 1~5장 첨부하고 완료를 누릅니다', body: '폐기물 수거 전·후 사진을 한 장씩 찍으시면 좋습니다. "완료" 버튼을 누르면 시민에게 자동으로 처리 완료 알림이 갑니다.' },
    ],
    tip: { title: '민원 위치를 못 찾겠을 때', body: '민원 상세의 지도 핀이 정확하지 않을 수 있습니다. 신고자 연락처가 있다면 전화로 정확한 위치를 확인하시거나, 회사 관리자에게 도움을 요청해 주세요.' },
    nextHref: '#10',
  },

  /* ─── 10 실적 입력 ─── */
  {
    kind: 'standard',
    num: '10',
    title: '실적 입력 — 처리·반입',
    lead: '하루 처리한 폐기물 무게(처리실적)와 처리장에 반입한 무게(반입실적)를 기록합니다. 회사가 지자체에 보고하는 핵심 데이터입니다.',
    steps: [
      {
        title: '"실적" 탭을 누릅니다',
        body: '하단 탭에서 차트 모양 아이콘이 "실적"입니다. 상단에서 "처리실적" 또는 "반입실적" 중 하나를 선택해 주세요.',
        screenshot: (
          <ScreenShot appBar={{ title: '실적관리', role: 'worker' }} activeTab="perf" caption="처리실적 / 반입실적 두 탭.">
            <div style={{ display: 'flex', gap: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 800, padding: '6px 10px', background: '#0e7490', color: 'white', borderRadius: 4 }}>처리실적</span>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '6px 10px', color: '#64748b', borderRadius: 4 }}>반입실적</span>
            </div>
            <FormRowMock label="기록 날짜" value="2026-05-02 (금)" />
            <FormRowMock label="성상" placeholder="음식물 / 일반 / 재활용 …" type="input" />
            <FormRowMock label="무게(톤)" placeholder="0.00" type="input" />
          </ScreenShot>
        ),
      },
      { title: '날짜와 성상을 선택합니다', body: '오늘 날짜는 자동 입력됩니다. 폐기물 성상(일반·음식물·재활용·폐목재 등 14종)을 드롭다운에서 선택해 주세요.' },
      { title: '무게(톤)를 입력합니다', body: '소수점 둘째 자리까지 입력 가능합니다. 같은 날짜·성상에 다시 입력하면 덮어쓰기됩니다.' },
      { title: '"저장" 버튼을 누릅니다', body: '저장된 기록은 월별로 자동 합산되어 지자체 보고서에 반영됩니다.' },
    ],
    nextHref: '#11',
  },

  /* ─── 11 내 프로필 관리 ─── */
  {
    kind: 'standard',
    num: '11',
    title: '내 프로필 관리',
    lead: '연락처·주소·은행계좌 등 본인 정보를 본인이 직접 관리합니다. 프로필 사진과 서명 한 번 등록하면 결재·민원 처리에 자동 사용됩니다.',
    steps: [
      {
        title: '홈 화면의 "내 프로필" 카드를 누릅니다',
        body: '하단 "홈" 탭에서 메뉴 카드들 중 "내 프로필"을 누르시면 본인 정보가 표시됩니다.',
        screenshot: (
          <ScreenShot appBar={{ title: '내 프로필', role: 'worker', showBack: true }} caption="이름·직책·사번 + 사진·서명 + 연락처.">
            <FormRowMock label="이름" value="김운전" type="header" />
            <FormRowMock label="직원번호" value="EMP001" />
            <FormRowMock label="직책" value="운전원" />
            <FormRowMock label="전화" value="010-XXXX-1234" />
          </ScreenShot>
        ),
      },
      { title: '프로필 사진을 등록합니다', body: '카메라로 찍거나 갤러리에서 선택하실 수 있습니다. 사진은 자동 압축되어 저장됩니다(최대 700KB).' },
      { title: '서명을 등록합니다 (한 번만)', body: '결재·TBM·민원 처리 등에 사용되는 본인 서명을 손가락으로 그려 주세요. 한 번 등록한 서명은 본인이 변경할 수 없으니 신중히 그려주세요.' },
      { title: '연락처·주소·계좌를 수정합니다', body: '전화번호·비상연락처·주소·은행계좌 변경 시 직접 수정하실 수 있습니다. 주소·계좌 정보는 암호화되어 저장됩니다.' },
    ],
    warn: { title: '서명은 한 번 등록하면 변경이 어렵습니다', body: '결재 신뢰성을 위한 정책입니다. 잘못 그렸을 경우 회사 관리자에게 요청하시면 기존 서명을 비활성화 후 다시 등록하실 수 있습니다.' },
    nextHref: '#12',
  },

  /* ─── 12 추천경로 (Ch.12 카피 수정: "더보기 메뉴" → "홈 그리드 카드") ─── */
  {
    kind: 'standard',
    num: '12',
    title: '추천경로 (기동반 전용)',
    lead: '기동반(RAPID) 직책으로 등록된 분만 사용 가능한 기능입니다. 미처리 민원의 위치를 지도에 표시하고 최적 방문 순서를 제안합니다.',
    steps: [
      {
        title: '홈 화면의 "추천경로" 카드를 누릅니다',
        body: '기동반 직책이라면 홈 그리드에 보라색 "추천경로" 카드가 보입니다. 카드가 보이지 않으면 본인 직책이 기동반(RAPID)이 아닌 경우입니다.',
        screenshot: (
          <ScreenShot appBar={{ title: '워커앱 홈', role: 'worker' }} activeTab="home" caption="기동반에게만 보이는 보라색 '추천경로' 카드.">
            <ListItemMock title="휴가 신청" sub="연차·반차·경조사" right={<span style={{ fontSize: 18 }}>→</span>} />
            <ListItemMock title="내 프로필" sub="사진·서명·연락처" right={<span style={{ fontSize: 18 }}>→</span>} />
            <ListItemMock title="🟣 추천경로 (기동반)" sub="민원 위치 + 최적 방문 순서" right={<span style={{ fontSize: 18 }}>→</span>} highlighted />
          </ScreenShot>
        ),
      },
      {
        title: '지도에서 미처리 민원 마커를 봅니다',
        body: '본인 회사의 미처리 민원이 색상별로 표시됩니다. 마커를 누르시면 민원 제목·유형이 보입니다.',
        screenshot: (
          <ScreenShot appBar={{ title: '추천경로', role: 'worker', showBack: true }} caption="미처리 민원 핀 + 경로 최적화 버튼.">
            <MapPlaceholder pinX="48%" pinY="38%" label="용산구 이태원동" height={120} />
            <FormRowMock label="미처리 민원" value="5건" />
            <ButtonMock label="경로 최적화" variant="primary" highlighted />
          </ScreenShot>
        ),
      },
      { title: '"경로 최적화" 버튼을 누릅니다', body: '현재 위치 기준으로 가장 효율적인 방문 순서가 라인으로 표시됩니다. 소요 시간과 거리가 함께 보입니다.' },
    ],
    tip: { title: '메뉴가 보이지 않을 때', body: '회사가 추천경로 기능을 활성화하지 않았거나, 본인 직책이 기동반(RAPID)이 아닌 경우입니다. 둘 중 어느 것이든 회사 관리자에게 확인 요청해 주세요.' },
    nextHref: '#13',
  },

  /* ─── 13 자주 묻는 질문 ─── */
  {
    kind: 'faq',
    num: '13',
    title: '자주 묻는 질문',
    lead: '현장에서 자주 받는 질문들을 모았습니다. 더 궁금한 내용이 있으시면 회사 관리자에게 언제든지 말씀해 주세요.',
    faqs: [
      { q: '비밀번호를 잊었어요. 어떻게 하나요?', a: '회사 관리자에게 말씀해 주세요. 새 임시 비밀번호로 즉시 다시 발급해 드립니다. 본인 확인 후 1~2분이면 처리됩니다.' },
      { q: '출근 도장 찍을 때 GPS가 안 잡혀요', a: '실내·지하주차장에서는 신호가 약합니다. 차고지 마당으로 잠시 나오시면 1~5초 안에 신호가 잡힙니다. 그래도 안 되면 폰 설정에서 위치 서비스가 켜져 있는지, 브라우저에 위치 권한이 허용되어 있는지 확인 부탁드립니다.' },
      { q: '폰을 새것으로 바꿨어요. 다시 설정해야 하나요?', a: '네. 새 폰의 브라우저에서 wci.helpbiz.kr로 접속하시고, 같은 직원번호와 비밀번호로 로그인하시면 모든 데이터가 그대로 보입니다. 위치 권한과 알림 권한만 다시 한 번 허용해 주시면 됩니다.' },
      { q: '휴가 신청 후 결재가 며칠째 안 와요', a: '결재는 보통 1~2일 안에 처리되지만, 휴일·연휴가 끼면 더 걸릴 수 있습니다. 3일 이상 결재가 없으면 회사 관리자에게 직접 확인 요청 부탁드립니다.' },
      { q: '실수로 출근을 두 번 눌렀어요', a: '걱정하지 않으셔도 됩니다. 같은 날에는 한 번만 등록되며, 두 번째 누르신 것은 무시됩니다. 잘못된 시간으로 등록되었다면 회사 관리자에게 말씀해 주세요. 조정이 가능합니다.' },
      { q: '내 위치 정보가 회사에 다 노출되나요?', a: 'GPS는 출퇴근 시점에만 사용되며, 좌표는 약 10m 격자로 처리되어 정밀 위치는 저장되지 않습니다. 또한 90일이 지나면 자동으로 삭제됩니다. 작업 중인 동안의 실시간 위치는 차량 GPS 추적 기능이 활성화된 회사에서만, 차량 단위로 기록됩니다.' },
      { q: '서명을 잘못 그렸어요. 다시 하고 싶어요', a: '서명은 한 번 등록되면 본인이 직접 변경하실 수 없습니다. 보안과 결재 신뢰성을 위한 정책입니다. 서명을 새로 등록해야 한다면 회사 관리자에게 요청해 주세요. 관리자가 기존 서명을 비활성화하면 다시 등록하실 수 있습니다.' },
      { q: '글자가 너무 작아 보입니다', a: '폰 설정에서 글자 크기를 키우시면 워커앱도 함께 커집니다. iOS는 "설정 > 손쉬운 사용 > 디스플레이 및 텍스트 크기", 안드로이드는 "설정 > 디스플레이 > 글꼴 크기"에서 조정 가능합니다.' },
      { q: 'TBM 화면에 "오늘 미등록"이라고 나와요', a: '회사 관리자가 오늘 TBM을 아직 생성하지 않은 경우입니다. 잠시 후 다시 들어와 주시거나, 작업 시작 시점에 관리자에게 등록 요청 부탁드립니다.' },
      { q: '추천경로 메뉴가 안 보여요', a: '추천경로는 기동반(RAPID) 직책에만 보입니다. 본인 직책이 운전원·수거원이라면 정상적으로 안 보이는 것이 맞습니다. 기동반 직책을 받으셨는데도 안 보이면 회사 관리자에게 권한 확인 부탁드립니다.' },
      { q: 'SOS를 실수로 눌렀어요', a: '한 번 더 확인 다이얼로그에서 "아니오"를 누르시면 발송되지 않습니다. 이미 발송된 경우라면 즉시 회사 관리자에게 연락해 상황 설명 부탁드립니다. 늦을수록 119 등 외부 기관에도 알림이 갈 수 있습니다.' },
      { q: '민원 처리 사진을 잘못 첨부했어요', a: '완료 버튼을 누르기 전이라면 사진 옆 X 버튼으로 삭제 후 다시 첨부 가능합니다. 이미 완료한 후라면 회사 관리자에게 요청하시면 사진을 추가하거나 교체할 수 있습니다.' },
    ],
  },
];
