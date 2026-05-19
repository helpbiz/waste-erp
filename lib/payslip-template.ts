export type PayslipColumn = { key: string; label: string; required: boolean };

export type PayslipTemplate = {
  earnings:       PayslipColumn[];  // 임금구성항목
  deductions:     PayslipColumn[];  // 공제내역
  extras:         PayslipColumn[];  // 급식비·생일축하금 등 소계 아래 별도항목
  showWorkHours:  boolean;          // 연장/야간 근로시간 표 표시
  showCalcMethod: boolean;          // 계산방법 섹션 표시
  payDayLabel:    string;           // 지급일 안내 텍스트
  footer:         string;           // 하단 고지문
};

export const DEFAULT_TEMPLATE: PayslipTemplate = {
  earnings: [
    { key: '기본급',           label: '기 본 급',               required: true  },
    { key: '주휴수당',         label: '주 휴 수 당',             required: false },
    { key: '운전수당',         label: '운 전 수 당',             required: false },
    { key: '기술수당',         label: '기 술 수 당',             required: false },
    { key: '연장근로수당',     label: '연 장 근 로 수 당',       required: false },
    { key: '야간근로수당',     label: '야 간 근 로 수 당',       required: false },
    { key: '법정휴일근로수당', label: '법 정 휴 일 근 로 수 당', required: false },
    { key: '연차수당',         label: '연 차 수 당',             required: false },
    { key: '조정수당',         label: '조 정 수 당',             required: false },
    { key: '특수작업수당',     label: '특 수 작 업 수 당',       required: false },
    { key: '보존수당',         label: '보 존 수 당',             required: false },
    { key: '직책수당',         label: '직 책 수 당',             required: false },
  ],
  deductions: [
    { key: '근로소득세',   label: '근 로 소 득 세',       required: true  },
    { key: '지방소득세',   label: '지 방 소 득 세',       required: true  },
    { key: '건강보험',     label: '건 강 보 험',           required: false },
    { key: '장기요양보험', label: '장 기 요 양 보 험',     required: false },
    { key: '국민연금',     label: '국 민 연 금',           required: false },
    { key: '고용보험',     label: '고 용 보 험',           required: false },
    { key: '기타공제',     label: '기 타 공 제',           required: false },
    { key: '연말정산',     label: '연 말 정 산',           required: false },
  ],
  extras: [
    { key: '급식비',           label: '급 식 비',               required: false },
    { key: '생일축하금',       label: '생 일 축 하 금',         required: false },
    { key: '안전규정이행수당', label: '안 전 규 정 이 행 수 당', required: false },
  ],
  showWorkHours:  true,
  showCalcMethod: true,
  payDayLabel:    '매월 15일',
  footer: '※ 근로기준법 시행령에 의거 작성함.(2021년11월19일 시행)\n※ 개인정보 공유금지',
};
