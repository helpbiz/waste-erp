/* 지자체관리자(MUNI_ADMIN) 매뉴얼 — 카피 + 데스크톱 목업.
   대상: 시·군·구 환경과 직원 (관할 위탁업체 모니터링·보고서 조회)
   특징:
     - READ-ONLY 콘솔 (mutate API는 middleware에서 차단)
     - 화이트리스트 예외 4가지: 민원 직접 입력 / 본인 비밀번호·사진·서명 / 개인정보 동의 / 공지 작성
     - 권한 매트릭스 3종 (표준 / 모니터링 전용 / 전체 공개) 으로 보이는 메뉴가 달라짐
     - 사이드바 색상 navy (#1d4ed8) — admin(#1e3a5f)과 구분.
   톤: 격식. 큰 글자. 단계 시각화. */

import type { ChapterData } from '../_components/Chapter';
import DesktopShot from '../_components/DesktopShot';
import KpiCardMock from '../_components/KpiCardMock';
import TableMock from '../_components/TableMock';
import ButtonMock from '../_components/ButtonMock';
import StatusChipMock from '../_components/StatusChipMock';
import FormRowMock from '../_components/FormRowMock';
import ListItemMock from '../_components/ListItemMock';

export const MUNI_META = {
  title: '지자체관리자 사용설명서',
  subtitle: '시·군·구 환경과 직원을 위한 모니터링 콘솔 안내',
  welcome: 'CleanERP 지자체관리자 콘솔은 관할 위탁업체의 운영 현황·민원 처리·안전 관리·실적 보고를 한 화면에서 모니터링할 수 있게 해드립니다. 별도 보고 양식 작성 없이도 매월 정확한 통계를 받아보실 수 있습니다.',
};

export const MUNI_CHAPTERS: ChapterData[] = [
  /* ─── 01 환영합니다 ─── */
  {
    kind: 'welcome',
    num: '01',
    title: '환영합니다',
    lead: '지자체관리자 콘솔로 무엇을 보실 수 있는지 한눈에 정리해 드립니다. 모든 데이터는 본인 지자체 산하 위탁업체로 자동 격리되어 표시됩니다.',
    intro: '본 매뉴얼은 시·군·구 환경과 또는 시설관리공단 등 관할 위탁업체를 감독·평가하는 지자체 직원을 위한 안내서입니다. 콘솔은 조회·다운로드·공지 작성에 최적화되어 있으며, 위탁업체 데이터의 직접 수정·삭제는 불가합니다.',
    hero: (
      <DesktopShot url="www.cleanerp.kr/dashboard" active="메인 대시보드" variant="muni" caption="지자체관리자 콘솔 — navy 사이드바, 관할 위탁업체 종합 현황.">
        <div className="mock-h2">메인 대시보드 — 용산구청</div>
        <div className="mock-kpi-grid">
          <KpiCardMock label="관할 위탁업체" value="3" sub="용산청소·한남환경·이태원위생" />
          <KpiCardMock label="총 출근율" value="92" unit="%" tone="success" />
          <KpiCardMock label="미처리 민원" value="14" sub="기한 초과 3건" tone="warn" />
          <KpiCardMock label="이번달 수집량" value="1,240" unit="t" />
        </div>
      </DesktopShot>
    ),
    canDo: [
      { title: '관할 위탁업체 현황 모니터링', body: '대시보드 한 화면에서 산하 모든 위탁업체의 출근율·민원·차량·수집량을 동시에 볼 수 있습니다.' },
      { title: '민원 처리 진행 조회', body: '시민·구청에 들어온 민원이 어느 위탁업체에 배정되었고, 처리 기한 내 완료되는지 실시간 추적합니다.' },
      { title: '안전사고·재해 현황 검토', body: '관할 위탁업체에서 발생한 산업재해 보고를 즉시 확인하시고 필요시 고용노동부 보고 진행을 점검하실 수 있습니다.' },
      { title: '월간 보고서 자동 다운로드', body: '통합 보고서(전체) + 개별 위탁업체 보고서를 클릭 한 번으로 PDF·엑셀 출력. 별도 양식 작성 없음.' },
      { title: '관할 위탁업체에 일괄 공지 발송', body: '본 콘솔에서 작성하신 공지는 산하 모든 위탁업체와 근로자에게 즉시 전달됩니다 — 지자체 고유 권한.' },
    ],
  },

  /* ─── 02 처음 로그인 + 콘솔 둘러보기 ─── */
  {
    kind: 'standard',
    num: '02',
    title: '처음 로그인 + 콘솔 둘러보기',
    lead: '운영팀(공비Lab)이 발급한 임시 비밀번호로 처음 들어가신 뒤, 본인만 아는 새 비밀번호로 변경합니다. 메뉴 구조는 회사관리자 콘솔과 비슷하지만 등록·수정 버튼이 없는 조회 전용입니다.',
    steps: [
      { title: '데스크톱 브라우저로 www.cleanerp.kr 에 접속합니다', body: '크롬·엣지·사파리 모두 지원합니다. 모바일에서도 사용 가능하지만 표·차트 조회는 데스크톱이 편합니다.' },
      { title: '아이디·임시 비밀번호로 로그인 후 새 비밀번호로 변경합니다', body: '운영팀이 알려드린 아이디(예: MUNI001)와 임시 비밀번호로 로그인 후 본인만 아는 비밀번호로 변경합니다. 영문·숫자 포함 8자 이상 권장.' },
      {
        title: '개인정보 수집 동의서를 읽고 동의합니다',
        body: '처음 로그인 시 한 번만 표시됩니다. 동의를 마치셔야 모든 메뉴에 접근 가능합니다.',
      },
      {
        title: '좌측 사이드바 메뉴 4그룹을 익힙니다',
        body: '사이드바 색상이 navy인 것이 회사관리자 콘솔과의 차이입니다. 메뉴 구성은 OVERVIEW · CORE MODULES · OPERATIONS · SETTINGS 4그룹.',
        screenshot: (
          <DesktopShot active="메인 대시보드" variant="muni" caption="navy 사이드바 = 지자체관리자 콘솔. 보이는 메뉴는 권한 매트릭스에 따라 다를 수 있습니다.">
            <div className="mock-h2">시작하기</div>
            <FormRowMock label="처음 로그인 시" value="비밀번호 변경 → 동의 → 메뉴 둘러보기" />
            <FormRowMock label="자주 보는 메뉴" value="대시보드 · 통계/보고서 · 민원" />
            <FormRowMock label="권한 매트릭스" value="다음 챕터에서 자세히" />
          </DesktopShot>
        ),
      },
    ],
    tip: { title: '비밀번호를 잊었을 때', body: '운영팀(공비Lab)에 연락 부탁드립니다. 회사관리자가 아니라 운영팀이 직접 발급해 드립니다 — 02-XXXX-XXXX / contact@helpbiz.kr.' },
    nextHref: '#03',
    nextDesc: '지자체별로 보이는 메뉴가 다른 이유 — 권한 매트릭스 3종을 알아봅니다.',
  },

  /* ─── 03 권한 매트릭스 3 프리셋 ─── */
  {
    kind: 'standard',
    num: '03',
    title: '권한 매트릭스 — 3 프리셋',
    lead: '지자체별로 보이는 메뉴가 다를 수 있습니다. 운영팀이 협의 시 결정한 권한 매트릭스 프리셋(표준 / 모니터링 전용 / 전체 공개) 3종 중 하나가 적용됩니다. 본 매뉴얼은 가장 흔한 "표준 프리셋" 기준입니다.',
    steps: [
      {
        title: '"표준 프리셋" — 90% 지자체에 적용 (기본값)',
        body: '대시보드 + 민원관리 + 산업안전보건 + 근태 + 차량 + 실적 + 통계/보고서 + 공지사항 — 일상 모니터링에 필요한 거의 모든 메뉴가 보입니다. 보고서 다운로드도 PDF·엑셀 모두 가능.',
        screenshot: (
          <DesktopShot active="메인 대시보드" variant="muni" caption="표준 프리셋 — 8개 메뉴 그룹이 모두 보입니다.">
            <div className="mock-h2">표준 프리셋</div>
            <FormRowMock label="대시보드" value={<StatusChipMock label="표시" tone="success" />} />
            <FormRowMock label="민원·안전·근태" value={<StatusChipMock label="표시" tone="success" />} />
            <FormRowMock label="차량·실적·보고서" value={<StatusChipMock label="표시" tone="success" />} />
            <FormRowMock label="공지사항" value={<StatusChipMock label="표시" tone="success" />} />
            <FormRowMock label="다운로드" value={<StatusChipMock label="PDF · 엑셀 OK" tone="success" />} />
          </DesktopShot>
        ),
      },
      { title: '"모니터링 전용 프리셋" — 시범 도입·소극적 모니터링', body: '대시보드만 보입니다. 민원·안전·보고서 등 상세 메뉴는 표시되지 않으며 다운로드도 비활성화됩니다. 도입 초기·시범 운영 단계에서 사용됩니다.' },
      { title: '"전체 공개 프리셋" — 광역단체·전수 검토', body: '모든 메뉴 + 일괄(bulk) 다운로드까지 활성화됩니다. 광역지자체·합동 감사 시 사용됩니다.' },
    ],
    warn: { title: '본 매뉴얼은 표준 프리셋 기준입니다', body: '"모니터링 전용" 프리셋이라면 본 매뉴얼의 일부 챕터(민원·안전·보고서 등)는 본인 화면에 보이지 않을 수 있습니다. 프리셋 변경이 필요하면 운영팀에 협의 요청 부탁드립니다.' },
    nextHref: '#04',
  },

  /* ─── 04 메인 대시보드 ─── */
  {
    kind: 'standard',
    num: '04',
    title: '메인 대시보드',
    lead: '관할 모든 위탁업체의 운영 현황을 한 화면에 모은 페이지입니다. 매일 아침 첫 클릭이며, 30초 만에 오늘 상황 파악이 가능합니다. 2026-06-01 업데이트로 화면 최상단에 "위탁업체 통합 현황판"이 추가되었습니다.',
    steps: [
      {
        title: '위탁업체 통합 현황판(최상단)으로 빠르게 업체별 상태를 비교합니다',
        body: '대시보드 맨 위에 위탁업체 탭 필터(전체 업체 / 개별 업체)가 나타납니다. 탭을 전환하면 KPI 카드·비교 테이블·차트가 모두 선택한 업체 기준으로 바뀝니다.',
        screenshot: (
          <DesktopShot active="메인 대시보드" variant="muni" caption="위탁업체 통합 현황판 — 탭 전환으로 전체/개별 업체 조회.">
            <div className="mock-h2">위탁업체 통합 현황판</div>
            <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
              <ButtonMock label="전체 업체" variant="primary" fullWidth={false} highlighted />
              <ButtonMock label="용산청소" variant="secondary" fullWidth={false} />
              <ButtonMock label="한남환경" variant="secondary" fullWidth={false} />
              <ButtonMock label="이태원위생" variant="secondary" fullWidth={false} />
            </div>
            <div className="mock-kpi-grid">
              <KpiCardMock label="총 인원" value="87" sub="3개 업체 합산" />
              <KpiCardMock label="오늘 출근" value="80" sub="출근율 92%" tone="success" />
              <KpiCardMock label="미처리 민원" value="14" sub="기한초과 3건" tone="warn" />
              <KpiCardMock label="운행 차량" value="21" sub="전체 24대 중" />
              <KpiCardMock label="안전 보고" value="2" sub="이번달 접수" />
            </div>
          </DesktopShot>
        ),
      },
      {
        title: '업체별 비교 테이블로 출근율을 한눈에 비교합니다',
        body: '통합 현황판 하단에 위탁업체별 출근율이 색상으로 구분됩니다. 80% 이상은 녹색, 60~79%는 황색, 60% 미만은 적색으로 즉시 이상 여부를 파악할 수 있습니다.',
        screenshot: (
          <DesktopShot active="메인 대시보드" variant="muni" caption="업체별 비교 테이블 — 출근율 색상 구분.">
            <div className="mock-h2">업체별 현황 비교</div>
            <TableMock
              headers={['업체', '총 인원', '출근율', '미처리 민원', '운행 차량']}
              rows={[
                { cells: ['용산청소', '35명', <StatusChipMock label="94%" tone="success" />, '5건', '9대'] },
                { cells: ['한남환경', '28명', <StatusChipMock label="71%" tone="warn" />, '6건', '7대'], highlighted: true },
                { cells: ['이태원위생', '24명', <StatusChipMock label="95%" tone="success" />, '3건', '5대'] },
              ]}
            />
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
              ● 80%↑ 녹색 &nbsp;● 60~79% 황색 &nbsp;● 60%↓ 적색
            </div>
          </DesktopShot>
        ),
      },
      {
        title: '차트 4종으로 추이를 분석합니다',
        body: '현황판 하단에 차트 4종이 자동 표시됩니다: ① 업체별 출근율 막대차트(BarChart) ② 인원 분포 원형차트(PieChart) ③ 미처리 민원 현황 ④ 월별 출근율 추이. 각 차트는 탭 필터와 연동됩니다.',
      },
      { title: '미처리·기한초과 항목은 빨간색으로 강조됩니다', body: '운영 이슈가 있는 위탁업체는 즉시 눈에 띄도록 강조 표시됩니다. 클릭으로 해당 업체 상세 화면으로 바로 이동합니다.' },
    ],
    tip: { title: '데이터는 5분마다 자동 갱신', body: '직접 새로고침하지 않아도 출근·민원·차량 정보가 최신 상태로 유지됩니다. 화면을 띄워두고 다른 업무를 하셔도 됩니다.' },
    nextHref: '#05',
  },

  /* ─── 05 민원 조회 ─── */
  {
    kind: 'standard',
    num: '05',
    title: '민원 조회 + 직접 입력',
    lead: '관할 위탁업체에 배정된 민원의 처리 진행을 추적합니다. 시민이 구청에 직접 전화한 민원은 본 콘솔에서 직접 입력하실 수 있습니다 (지자체 고유 권한). 2026-06-01 업데이트로 날짜 필터·업체 탭 필터·Excel 출력이 추가되었습니다.',
    steps: [
      {
        title: '날짜 필터와 업체 탭으로 조회 범위를 먼저 설정합니다',
        body: '민원 목록 상단에 날짜 기간 입력란과 빠른 버튼(이번달 / 전월 / 최근3개월)이 표시됩니다. 업체 탭에서 "전체 업체" 또는 특정 위탁업체를 선택하면 해당 업체 민원만 필터링됩니다.',
        screenshot: (
          <DesktopShot url="www.cleanerp.kr/complaints" active="민원관리" variant="muni" caption="날짜 필터 + 업체 탭 — 기간·업체별 민원 조회.">
            <div className="mock-h2">민원 관리</div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
              <FormRowMock label="기간" value="2026-05-01 ~ 2026-05-31" />
              <ButtonMock label="이번달" variant="secondary" fullWidth={false} highlighted />
              <ButtonMock label="전월" variant="secondary" fullWidth={false} />
              <ButtonMock label="최근3개월" variant="secondary" fullWidth={false} />
            </div>
            <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
              <ButtonMock label="전체 업체" variant="primary" fullWidth={false} highlighted />
              <ButtonMock label="용산청소" variant="secondary" fullWidth={false} />
              <ButtonMock label="한남환경" variant="secondary" fullWidth={false} />
            </div>
          </DesktopShot>
        ),
      },
      {
        title: '"민원관리" 메뉴에서 민원 목록을 봅니다',
        body: '관할 모든 위탁업체의 민원이 시간순으로 표시됩니다. 위탁업체별·유형별·기한초과 등으로 필터링 가능하며, 업체(구역) 형식으로 구역 정보도 함께 표시됩니다.',
        screenshot: (
          <DesktopShot url="www.cleanerp.kr/complaints" active="민원관리" variant="muni" caption="관할 위탁업체 민원 통합 조회.">
            <div className="mock-h2">민원 목록</div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
              <ButtonMock label="+ 민원 입력 (시민 대신)" variant="primary" fullWidth={false} highlighted />
              <ButtonMock label="Excel" variant="secondary" fullWidth={false} />
              <StatusChipMock label="기한초과 3" tone="danger" />
            </div>
            <TableMock
              headers={['ID', '업체(구역)', '유형', '위치', '상태']}
              rows={[
                { cells: ['#0428', '용산청소 (이태원권)', '대형폐기물', '이태원동', <StatusChipMock label="처리중" tone="info" />] },
                { cells: ['#0427', '한남환경 (한남권)', '음식물 미수거', '한남동', <StatusChipMock label="기한초과" tone="danger" />], highlighted: true },
                { cells: ['#0426', '이태원위생 (후암권)', '재활용 위반', '후암동', <StatusChipMock label="완료" tone="success" />] },
              ]}
            />
          </DesktopShot>
        ),
      },
      { title: '"+ 민원 입력" 버튼으로 시민 민원을 직접 등록합니다', body: '시민이 구청 환경과로 직접 전화한 민원을 본 콘솔에서 입력하실 수 있습니다. 유형·위치·내용·신고자 연락처 입력 후 저장하시면 자동으로 관할 위탁업체에 배정됩니다.' },
      { title: '"Excel" 버튼으로 민원 목록을 엑셀로 내려받습니다', body: '현재 필터 조건(기간·업체 탭)이 그대로 적용된 데이터가 엑셀 파일로 출력됩니다. 업체(구역) 컬럼이 포함되어 구역별 분류가 편리합니다.' },
      { title: '민원 상세를 클릭해 처리 진행을 확인합니다', body: '도착 시각·처리 사진·완료 시각이 자동 기록되어 있어 위탁업체의 응대 품질을 객관적으로 평가하실 수 있습니다. 단, 본인이 배정·완료 처리는 불가합니다 (위탁업체 권한).' },
    ],
    tip: { title: '직접 입력한 민원은 누가 처리하나요?', body: '본인의 관할 지자체 내 위탁업체 중 해당 행정동을 담당하는 업체에 자동 배정됩니다. 배정 즉시 알림이 가서 위탁업체가 즉시 처리에 들어갑니다.' },
    nextHref: '#06',
  },

  /* ─── 06 산업안전보건 조회 ─── */
  {
    kind: 'standard',
    num: '06',
    title: '산업안전보건 조회',
    lead: '관할 위탁업체에서 발생한 안전사고·재해 보고와 일일점검 이력을 확인합니다. 중대재해 발생 시 24시간 이내 고용노동부 보고가 진행되는지 점검할 수 있습니다. 2026-06-01 업데이트로 날짜·업체 필터, 검토 처리 권한, TBM 이력 조회, Excel 출력이 추가되었습니다.',
    steps: [
      {
        title: '날짜 필터와 업체 탭으로 조회 범위를 설정합니다',
        body: '안전 보고 목록 상단에 기간 입력란과 빠른 버튼(이번달 / 전월 / 최근3개월), 업체 탭 필터가 나타납니다. 탭 전환 시 보고 목록·통계가 해당 업체 기준으로 갱신됩니다.',
        screenshot: (
          <DesktopShot url="www.cleanerp.kr/safety" active="산업안전보건" variant="muni" caption="날짜·업체 필터 — 기간·업체별 안전 보고 조회.">
            <div className="mock-h2">산업안전보건</div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
              <FormRowMock label="기간" value="2026-05-01 ~ 2026-05-31" />
              <ButtonMock label="이번달" variant="secondary" fullWidth={false} highlighted />
              <ButtonMock label="전월" variant="secondary" fullWidth={false} />
              <ButtonMock label="최근3개월" variant="secondary" fullWidth={false} />
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <ButtonMock label="전체 업체" variant="primary" fullWidth={false} highlighted />
              <ButtonMock label="용산청소" variant="secondary" fullWidth={false} />
              <ButtonMock label="한남환경" variant="secondary" fullWidth={false} />
            </div>
          </DesktopShot>
        ),
      },
      {
        title: '"산업안전보건" 메뉴에서 보고 목록을 봅니다',
        body: '일자·업체·심각도별로 안전 보고가 정리됩니다. 중상·사망 발생 시 빨간색으로 강조되며 MOL(고용노동부) 보고 상태도 함께 표시됩니다.',
        screenshot: (
          <DesktopShot url="www.cleanerp.kr/safety" active="산업안전보건" variant="muni" caption="관할 위탁업체 안전 보고 통합 조회.">
            <div className="mock-h2">안전 보고 목록</div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
              <ButtonMock label="Excel" variant="secondary" fullWidth={false} />
            </div>
            <TableMock
              headers={['일자', '업체', '유형', '심각도', 'MOL', '검토']}
              rows={[
                { cells: ['05.02', '용산청소', '아차사고', <StatusChipMock label="경미" tone="warn" />, '—', <ButtonMock label="검토 처리" variant="secondary" fullWidth={false} />] },
                { cells: ['04.30', '한남환경', '재해', <StatusChipMock label="부상" tone="danger" />, <StatusChipMock label="보고완료" tone="success" />, <StatusChipMock label="REVIEWED" tone="success" />], highlighted: true },
                { cells: ['04.28', '이태원위생', '일일점검', '—', '—', '—'] },
              ]}
            />
          </DesktopShot>
        ),
      },
      {
        title: '"검토 처리" 버튼으로 지자체 검토 완료 처리를 합니다',
        body: 'MUNI_ADMIN은 안전 보고 건에 대해 "검토 처리" 버튼을 누를 수 있습니다. 처리 시 상태가 REVIEWED(지자체 보고 완료/종결)로 변경됩니다. 중상 이상 건에 대해 구청 내부 보고 완료 후 처리해 주세요.',
      },
      {
        title: 'TBM 이력 조회 탭을 확인합니다',
        body: '안전 메뉴 내 "TBM 이력" 탭(/safety/tbm-history)에서 관할 위탁업체가 실시한 일일 TBM(Tool Box Meeting) 이력을 날짜·업체별로 조회할 수 있습니다. 빈도가 낮은 업체는 안전 관리 점검이 필요합니다.',
      },
      { title: '재해 보고는 24시간 카운트다운을 함께 봅니다', body: '중상·사망 보고는 산안법§54에 따라 24시간 이내 고용노동부 보고가 의무입니다. 카운트다운이 임박한 보고는 위탁업체에 즉시 확인 부탁드립니다.' },
      { title: '"Excel" 버튼으로 안전 보고 목록을 출력합니다', body: '현재 필터 조건(기간·업체 탭)이 적용된 안전 보고 데이터가 엑셀로 출력됩니다. 월간 보고서 제출 전 확인용으로 활용하실 수 있습니다.' },
    ],
    tip: { title: 'TBM 이력 메뉴가 보이지 않을 때', body: '권한 매트릭스 프리셋에 따라 TBM 이력 탭이 숨겨질 수 있습니다. 필요하시면 운영팀에 접근 허용 요청 부탁드립니다.' },
    nextHref: '#07',
  },

  /* ─── 07 근태·차량·실적 조회 ─── */
  {
    kind: 'standard',
    num: '07',
    title: '근태·차량·실적 조회',
    lead: '운영 관련 3개 메뉴를 한 챕터에 묶어 안내합니다. 모두 조회 전용이며 데이터 수정·승인은 위탁업체 권한입니다. 2026-06-01 업데이트로 업체 탭 필터·날짜 연동·Excel 출근대장 출력이 추가되었습니다.',
    steps: [
      {
        title: '"근태관리" — 업체 탭 필터로 원하는 업체만 조회합니다',
        body: '근태 화면 상단에 업체 탭(전체 업체 / 개별 업체)이 표시됩니다. 날짜(월)를 변경해도 선택한 contractorId 탭이 그대로 유지되어 같은 업체의 다른 월을 연속으로 비교할 수 있습니다.',
        screenshot: (
          <DesktopShot url="www.cleanerp.kr/attendance" active="근태관리" variant="muni" caption="업체 탭 필터 — 날짜 변경 시에도 선택 업체 유지.">
            <div className="mock-h2">근태 — 2026.05</div>
            <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
              <ButtonMock label="전체 업체" variant="primary" fullWidth={false} highlighted />
              <ButtonMock label="용산청소" variant="secondary" fullWidth={false} />
              <ButtonMock label="한남환경" variant="secondary" fullWidth={false} />
              <ButtonMock label="이태원위생" variant="secondary" fullWidth={false} />
            </div>
            <div className="mock-kpi-grid">
              <KpiCardMock label="용산청소" value="92%" tone="success" />
              <KpiCardMock label="한남환경" value="71%" tone="warn" />
              <KpiCardMock label="이태원위생" value="95%" tone="success" />
              <KpiCardMock label="평균" value="86%" />
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <ButtonMock label="Excel (출근대장)" variant="secondary" fullWidth={false} highlighted />
            </div>
          </DesktopShot>
        ),
      },
      { title: '"Excel (출근대장)" 버튼으로 해당 월 출근대장을 다운로드합니다', body: '현재 선택된 월과 업체 탭 기준의 출근대장이 엑셀로 출력됩니다. 현장 보고·감사 자료로 활용하실 수 있습니다.' },
      {
        title: '"차량관리" — 실시간 차량조회에서 업체 탭 필터를 사용합니다',
        body: '실시간 차량조회 화면에도 업체 탭 필터가 추가되었습니다. 여러 위탁업체 차량이 섞여 있을 때 특정 업체 차량만 선택해 지도와 목록을 볼 수 있습니다.',
      },
      { title: '"실적관리" — 일·월 처리·반입 실적', body: '근로자가 입력한 처리실적·반입실적이 자동 집계됩니다. 통계/보고서 메뉴에서 더 자세한 분석이 가능합니다.' },
    ],
    tip: { title: '업체 탭 선택이 초기화될 때', body: '페이지를 완전히 새로고침하면 "전체 업체" 탭으로 초기화됩니다. 특정 업체를 집중 모니터링할 때는 탭을 다시 선택해 주세요.' },
    nextHref: '#08',
  },

  /* ─── 08 실시간 차량 조회 ─── */
  {
    kind: 'standard',
    num: '08',
    title: '실시간 차량 조회',
    lead: '관할 위탁업체가 실시간 GPS 추적 기능을 활성화한 경우, 차량의 현재 위치와 노선을 지도에서 확인하실 수 있습니다. 2026-06-01 업데이트로 업체 탭 필터가 추가되었습니다.',
    steps: [
      { title: '"실시간 차량조회" 메뉴를 누릅니다', body: '메뉴가 보이지 않으면 본인 지자체 또는 관할 위탁업체가 이 기능을 활성화하지 않은 경우입니다. 관심 있으시면 운영팀에 도입 문의 부탁드립니다.' },
      {
        title: '업체 탭 필터로 원하는 업체 차량만 조회합니다',
        body: '화면 상단의 업체 탭(전체 업체 / 개별 업체)에서 탭을 선택하면 지도 마커와 차량 목록이 해당 업체 차량만 표시됩니다. 여러 위탁업체 차량이 섞여 있을 때 특히 유용합니다.',
        screenshot: (
          <DesktopShot url="www.cleanerp.kr/vehicles/live" active="실시간 차량조회" variant="muni" caption="업체 탭 필터 — 선택 업체 차량만 지도에 표시.">
            <div className="mock-h2">실시간 차량조회</div>
            <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
              <ButtonMock label="전체 업체" variant="primary" fullWidth={false} highlighted />
              <ButtonMock label="용산청소" variant="secondary" fullWidth={false} />
              <ButtonMock label="한남환경" variant="secondary" fullWidth={false} />
              <ButtonMock label="이태원위생" variant="secondary" fullWidth={false} />
            </div>
            <TableMock
              headers={['차량번호', '소속 업체', '운전자', '상태']}
              rows={[
                { cells: ['서울 가 1234', '용산청소', '박청소', <StatusChipMock label="운행중" tone="success" />] },
                { cells: ['서울 나 5678', '한남환경', '이환경', <StatusChipMock label="정비중" tone="warn" />] },
                { cells: ['서울 다 9012', '이태원위생', '최위생', <StatusChipMock label="운행중" tone="success" />] },
              ]}
            />
          </DesktopShot>
        ),
      },
      { title: '지도에서 차량 위치를 확인합니다', body: '관할 위탁업체 차량들이 색상별로 마커로 표시됩니다. 30초마다 자동 갱신되며 마커 클릭 시 차량번호·소속 업체·운전자가 보입니다.' },
    ],
    tip: { title: '기능이 보이지 않을 때', body: '실시간 GPS 추적은 회사·지자체별 옵션 기능입니다. 도입 문의는 운영팀(공비Lab) — 02-XXXX-XXXX.' },
    nextHref: '#09',
  },

  /* ─── 09 날씨관리대장 조회 ─── */
  {
    kind: 'standard',
    num: '09',
    title: '날씨관리대장 조회',
    lead: '관할 위탁업체 근로자가 작성한 기상·온열 안전 기록을 조회하는 메뉴입니다. MUNI_ADMIN은 공지 등록 없이 근로자 기록만 열람할 수 있습니다.',
    steps: [
      {
        title: '"날씨관리대장" 메뉴에서 기록 목록을 봅니다',
        body: '근로자가 현장에서 입력한 기상 기록이 날짜순으로 표시됩니다. 직원명·기록시간·체감온도·조치사항·담당자 정보가 열로 정리됩니다.',
        screenshot: (
          <DesktopShot url="www.cleanerp.kr/weather-log" active="날씨관리대장" variant="muni" caption="근로자 기상 안전 기록 조회 — 공지 등록 불가, 조회 전용.">
            <div className="mock-h2">날씨관리대장</div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
              <ButtonMock label="Excel (텍스트)" variant="secondary" fullWidth={false} highlighted />
              <ButtonMock label="Excel (이미지 포함)" variant="secondary" fullWidth={false} />
            </div>
            <TableMock
              headers={['일자', '직원명', '기록시간', '체감온도', '조치사항', '담당자']}
              rows={[
                { cells: ['06.01', '홍길동', '08:30', '38°C', '10분 휴식 지시', '박현장'] },
                { cells: ['06.01', '김작업', '10:15', '41°C', <StatusChipMock label="작업중지" tone="danger" />, '이팀장'], highlighted: true },
                { cells: ['05.31', '이청소', '09:00', '35°C', '수분 보충 권고', '박현장'] },
              ]}
            />
          </DesktopShot>
        ),
      },
      {
        title: '사진이 첨부된 기록은 상세 클릭으로 확인합니다',
        body: '근로자가 현장 사진을 첨부한 기록은 목록에서 사진 아이콘이 표시됩니다. 행 클릭 시 첨부 사진과 상세 기록을 함께 볼 수 있습니다.',
      },
      {
        title: '"Excel (텍스트)" 또는 "Excel (이미지 포함)" 버튼으로 출력합니다',
        body: 'Excel (텍스트): 기록 내용만 빠르게 출력합니다. 텍스트 기반 통계·보고용으로 적합합니다. Excel (이미지 포함): 첨부 사진이 포함된 엑셀 파일로 출력됩니다. 현장 사진 증빙이 필요한 감사·보고 자료에 활용하세요. 파일 크기가 크므로 필요한 경우에만 사용 권장합니다.',
      },
    ],
    tip: { title: 'MUNI_ADMIN은 공지 등록이 없습니다', body: '날씨관리대장 공지(온열 경보 등)는 회사관리자(OWNER/ADMIN)가 등록합니다. MUNI_ADMIN은 근로자가 작성한 기록을 조회·출력만 할 수 있습니다.' },
    nextHref: '#10',
  },

  /* ─── 10 통합·개별 보고서 ─── */
  {
    kind: 'standard',
    num: '10',
    title: '통합·개별 보고서 다운로드',
    lead: '월간·분기·연간 보고서를 위탁업체별 또는 지자체 통합으로 출력하는 메뉴입니다. 가장 자주 사용하시는 기능이며, 별도 양식 작성 없이 클릭 한 번으로 PDF·엑셀이 생성됩니다.',
    steps: [
      {
        title: '"통계/보고서" 메뉴에서 기간을 선택합니다',
        body: '날짜 범위를 달력에서 골라주세요. 기본값은 지난 달 1일 ~ 말일입니다.',
        screenshot: (
          <DesktopShot url="www.cleanerp.kr/reports" active="통계/보고서" variant="muni" caption="통합(전체) 또는 위탁업체 개별 선택 후 출력.">
            <div className="mock-h2">월간 보고서 — 2026.04</div>
            <FormRowMock label="기간" value="2026-04-01 ~ 2026-04-30" />
            <FormRowMock label="대상" value="📊 통합 (관할 전체) ▼" />
            <FormRowMock label="총 수집량" value="4,820 t" />
            <FormRowMock label="처리 민원" value="487건 (기한 초과 5건)" />
            <FormRowMock label="안전사고" value="아차사고 12 · 부상 1 · 중상 0" />
            <div style={{ display: 'flex', gap: 6 }}>
              <ButtonMock label="PDF 출력" variant="primary" fullWidth={false} highlighted />
              <ButtonMock label="엑셀 출력" variant="secondary" fullWidth={false} />
            </div>
          </DesktopShot>
        ),
      },
      { title: '"📊 통합" 또는 "위탁업체 개별" 중 선택합니다', body: '통합은 관할 모든 위탁업체 합산 통계, 개별은 특정 위탁업체 한 곳의 통계를 출력합니다. 둘 다 결재란이 hide된 깔끔한 형식입니다.' },
      { title: 'PDF·엑셀 형식으로 출력합니다', body: 'PDF는 즉시 보고용·인쇄용으로, 엑셀은 추가 분석용으로 활용하실 수 있습니다. CSV 출력도 지원됩니다.' },
      { title: '필요시 일괄(bulk) 다운로드를 사용합니다', body: '"전체 공개 프리셋"이 적용된 지자체는 모든 위탁업체 보고서를 zip으로 한 번에 다운로드하실 수 있습니다. 상위 권한이 필요하시면 운영팀에 문의 부탁드립니다.' },
    ],
    nextHref: '#11',
  },

  /* ─── 11 공지사항 작성 (MUNI 고유 권한) ─── */
  {
    kind: 'standard',
    num: '11',
    title: '공지사항 작성 — 지자체 고유 권한',
    lead: '본 콘솔에서 작성하신 공지는 관할 모든 위탁업체와 근로자에게 즉시 전달됩니다. 일괄 발송이 가능한 유일한 mutate 기능입니다.',
    steps: [
      {
        title: '"공지사항" 메뉴에서 "+ 신규 공지"를 누릅니다',
        body: '제목·본문·대상층·긴급도·만료일을 입력 후 게시하시면 즉시 발송됩니다.',
        screenshot: (
          <DesktopShot url="www.cleanerp.kr/announcements" active="공지사항" variant="muni" caption="관할 위탁업체 일괄 공지 — MUNI 고유 mutate 권한.">
            <div className="mock-h2">신규 공지 작성</div>
            <FormRowMock label="제목" placeholder="예: 5월 환경의 날 행사 안내" type="input" />
            <FormRowMock label="대상" value="MUNI (관할 전체)" />
            <FormRowMock label="긴급도" value={<StatusChipMock label="INFO" tone="info" />} />
            <FormRowMock label="만료일" value="2026-05-31" />
            <ButtonMock label="게시" variant="primary" highlighted />
          </DesktopShot>
        ),
      },
      { title: '대상층(audience)으로 도달 범위를 결정합니다', body: 'MUNI(관할 전체) — 모든 위탁업체와 근로자에게 / OWNER — 위탁업체 대표급에만 / WORKER — 근로자급에만 / ALL — 전체. 신중히 선택해 주세요.' },
      { title: '긴급도로 노출 강도를 조정합니다', body: 'INFO(파랑) / WARNING(앰버) / CRITICAL(빨강) 3단계. CRITICAL은 모든 사용자 화면 상단에 만료 전까지 고정 표시됩니다 — 진짜 긴급할 때만 사용 부탁드립니다.' },
      { title: '본인이 작성한 공지만 수정·삭제 가능합니다', body: '다른 사용자(SUPER_ADMIN 운영팀 또는 위탁업체 관리자)가 작성한 공지는 보기만 가능하며 수정·삭제는 불가합니다.' },
    ],
    warn: { title: '한 번 발송된 공지는 즉시 모든 대상에게 전달됩니다', body: '게시 전에 제목·본문·대상층을 한 번 더 확인 부탁드립니다. 잘못 발송된 경우 신속히 수정하시거나 삭제하시면 알림 노출이 중단됩니다.' },
    nextHref: '#12',
  },

  /* ─── 12 관제모드 설정 ─── */
  {
    kind: 'standard',
    num: '12',
    title: '관제모드 설정',
    lead: '지자체관리자(MUNI_ADMIN)는 본인 지자체의 관제 화면을 직접 설정할 수 있습니다. 저장된 설정은 지자체 전용으로 적용되며 위탁업체 관제 설정과 독립적으로 관리됩니다.',
    steps: [
      {
        title: '"관제모드 설정" 메뉴에서 현재 구성을 확인합니다',
        body: '메뉴가 보이지 않으면 해당 기능이 본인 지자체 프리셋에 포함되지 않은 경우입니다. 운영팀에 활성화 요청 부탁드립니다.',
        screenshot: (
          <DesktopShot url="www.cleanerp.kr/settings/kiosk" active="관제모드 설정" variant="muni" caption="지자체 전용 관제 화면 설정 — 위탁업체 설정과 독립.">
            <div className="mock-h2">관제모드 설정 — 용산구청</div>
            <FormRowMock label="표시 레이아웃" value="4분할 ▼" />
            <FormRowMock label="자동 전환 간격" value="30초 ▼" />
            <FormRowMock label="표시 항목" value="출근현황 · 미처리민원 · 차량현황 · 안전보고" />
            <FormRowMock label="설정 범위" value="지자체 전용 (위탁업체 설정 무관)" />
            <div style={{ display: 'flex', gap: 6 }}>
              <ButtonMock label="저장" variant="primary" fullWidth={false} highlighted />
              <ButtonMock label="미리보기" variant="secondary" fullWidth={false} />
            </div>
          </DesktopShot>
        ),
      },
      {
        title: '표시 항목과 레이아웃을 선택합니다',
        body: '관제 화면에 표시할 KPI 항목(출근현황·미처리민원·차량현황·안전보고 등)과 레이아웃(4분할·2분할·전체화면)을 선택합니다. 변경사항은 "저장" 버튼을 누를 때 반영됩니다.',
      },
      {
        title: '지자체 전용으로 저장합니다',
        body: '저장된 설정은 본인 지자체 관제 화면에만 적용됩니다. 관할 위탁업체가 별도로 설정한 관제 화면과는 완전히 독립적으로 동작하므로 서로 영향을 주지 않습니다.',
      },
    ],
    tip: { title: '관제 화면을 TV·모니터에 띄워두는 방법', body: '설정 완료 후 "미리보기" 버튼으로 관제 화면을 열고, 해당 URL을 TV·모니터에 연결된 PC에서 전체화면(F11)으로 띄워두시면 됩니다. 자동 갱신으로 별도 조작 없이 항상 최신 상태를 유지합니다.' },
    nextHref: '#13',
  },

  /* ─── 13 본인 계정 관리 ─── */
  {
    kind: 'standard',
    num: '13',
    title: '본인 계정 관리',
    lead: '본인의 비밀번호·프로필 사진·서명(도장)을 관리합니다. 다른 계정의 정보는 수정하실 수 없으며 운영팀에 요청해야 합니다.',
    steps: [
      { title: '우측 상단 본인 이름 클릭 → "내 프로필"', body: '프로필 페이지에서 비밀번호 변경·사진 등록·서명 등록·연락처 수정이 가능합니다.' },
      { title: '비밀번호는 정기적으로 변경 권장', body: '6개월마다 한 번씩 새 비밀번호로 갱신하시는 것이 보안상 좋습니다. 영문·숫자 포함 8자 이상 권장.' },
      {
        title: '도장(서명) 등록 — 보고서 결재용',
        body: '월간 보고서 등에 결재가 필요한 경우 본인 서명을 한 번 등록해 두시면 자동 사용됩니다. 한 번 등록한 서명은 본인이 직접 변경하실 수 없으니 신중히 그려주세요.',
        screenshot: (
          <DesktopShot url="www.cleanerp.kr/users/me" variant="muni" caption="본인 프로필 — 비밀번호·사진·서명·연락처.">
            <div className="mock-h2">내 프로필</div>
            <FormRowMock label="이름" value="김환경" type="header" />
            <FormRowMock label="소속" value="용산구청 환경과" />
            <FormRowMock label="아이디" value="MUNI001" />
            <FormRowMock label="이메일" value="env@yongsan.go.kr" />
            <ButtonMock label="비밀번호 변경" variant="secondary" fullWidth={false} />
          </DesktopShot>
        ),
      },
    ],
    tip: { title: '서명을 새로 등록하고 싶을 때', body: '운영팀(공비Lab)에 요청하시면 기존 서명을 비활성화 후 다시 등록하실 수 있습니다. 본인 확인 후 처리됩니다.' },
    nextHref: '#14',
  },

  /* ─── 14 자주 묻는 질문 ─── */
  {
    kind: 'faq',
    num: '14',
    title: '자주 묻는 질문',
    lead: '지자체관리자 역할에서 자주 나오는 질문들을 모았습니다.',
    faqs: [
      { q: '왜 등록·수정·삭제 버튼이 없나요?', a: '지자체관리자는 조회 전용(READ-ONLY) 권한입니다. 위탁업체 데이터의 직접 수정은 위탁업체 자체 책임 영역이며, 데이터 정합성과 책임 소재 명확화를 위해 시스템 차원에서 차단됩니다. 단, 시민 민원 직접 입력·관할 공지 작성·본인 계정 관리는 가능합니다.' },
      { q: '다른 지자체 데이터도 볼 수 있나요?', a: '아닙니다. 본인 지자체 산하 위탁업체의 데이터만 표시되며, 다른 지자체의 데이터는 절대 노출되지 않습니다. 시스템이 자동으로 격리(cross-tenant isolation)합니다.' },
      { q: '메뉴가 일부만 보입니다', a: '권한 매트릭스 프리셋(표준/모니터링 전용/전체 공개)에 따라 다릅니다. 본인 지자체에 적용된 프리셋을 확인하시거나 운영팀에 변경 요청 부탁드립니다.' },
      { q: '월간 보고서를 정기적으로 자동 발송 받고 싶어요', a: '운영팀(공비Lab)에 일정(예: 매월 1일 오전 9시)을 요청하시면 자동 메일 발송으로 설정해 드립니다. 별도 비용 없이 가능합니다.' },
      { q: '시민이 구청에 직접 전화한 민원을 등록하면 누가 처리하나요?', a: '입력하신 민원의 위치(행정동) 기준으로 관할 위탁업체에 자동 배정됩니다. 배정 즉시 위탁업체에 알림이 가서 처리에 들어갑니다.' },
      { q: '공지를 잘못 발송했어요', a: '본인이 작성하신 공지는 즉시 수정·삭제 가능합니다. 삭제하시면 모든 대상의 화면에서 즉시 사라집니다. 단, 이미 푸시 알림으로 전달된 내용은 회수가 어려울 수 있습니다.' },
      { q: '비밀번호를 잊었어요', a: '본 콘솔의 사용자관리 메뉴는 본인 계정만 가능하므로 본인 비밀번호 재발급은 운영팀(공비Lab)에 요청하셔야 합니다 — 02-XXXX-XXXX / contact@helpbiz.kr.' },
      { q: '관할 위탁업체에 신규 도입을 권하려면?', a: '운영팀에 도입 문의 연결 부탁드립니다. 시연·견적·셋업까지 운영팀이 직접 진행해 드리며, 지자체 차원에서 협조해 주시면 신규 위탁업체 셋업이 30분 안에 끝납니다.' },
      { q: 'CleanERP 도입 효과를 평가하려면?', a: '월간 보고서의 KPI(처리 민원 수·기한 초과율·안전사고·수집량 등)를 도입 전후로 비교하시면 됩니다. 6개월 이상 누적되면 통계적 유의미한 비교가 가능하며, 운영팀에서도 평가 자료 작성을 도와드립니다.' },
      { q: '안전 보고에서 "검토 처리" 버튼이 보이지 않아요', a: 'MUNI_ADMIN 계정이 맞는지, 그리고 해당 안전 보고의 상태가 이미 REVIEWED 처리된 건이 아닌지 확인해 주세요. 버튼이 여전히 보이지 않으면 운영팀에 권한 설정 확인을 요청 부탁드립니다.' },
      { q: 'TBM 이력 탭이 보이지 않아요', a: '권한 매트릭스 프리셋에 따라 TBM 이력(/safety/tbm-history) 접근이 제한될 수 있습니다. 운영팀에 접근 허용 요청 부탁드립니다.' },
      { q: '날씨관리대장에서 공지를 등록하고 싶어요', a: 'MUNI_ADMIN은 날씨관리대장에서 근로자 기록 조회만 가능합니다. 온열 경보·기상 공지는 관할 위탁업체 회사관리자(OWNER/ADMIN)가 등록합니다. 긴급 공지가 필요하면 공지사항 메뉴를 이용해 주세요.' },
      { q: '관제모드 설정이 위탁업체 설정에 영향을 주나요?', a: '아닙니다. MUNI_ADMIN이 저장한 관제 설정은 지자체 전용으로 저장되며 관할 위탁업체의 관제 화면 설정과 완전히 독립적입니다. 서로 덮어쓰지 않습니다.' },
    ],
  },
];
