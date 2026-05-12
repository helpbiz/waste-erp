'use client';

import { useState } from 'react';
import Link from 'next/link';

const today = () => new Date().toISOString().slice(0, 10);
const thisMonth = () => new Date().toISOString().slice(0, 7);

function Card({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface border border-line rounded-xl p-5 flex flex-col gap-4">
      <div>
        <div className="text-base font-extrabold text-ink">{title}</div>
        <div className="text-xs text-ink-muted mt-0.5">{desc}</div>
      </div>
      {children}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-[0.6875rem] font-mono font-extrabold text-slate-500 mb-1">{children}</div>;
}

export default function PrintHubPage() {
  /* 차량일지 */
  const [vDate, setVDate] = useState(today());

  /* 처리실적 PDF */
  const [pDate, setPDate] = useState(today());

  /* 연차현황 */
  const [lFrom, setLFrom] = useState(thisMonth() + '-01');
  const [lTo, setLTo] = useState(today());
  const [lFmt, setLFmt] = useState<'xlsx' | 'csv'>('xlsx');

  /* 민원관리 */
  const [cFrom, setCFrom] = useState(thisMonth() + '-01');
  const [cTo, setCTo] = useState(today());
  const [cStatus, setCStatus] = useState('');

  /* 출퇴근 (월별) */
  const [aYm, setAYm] = useState(thisMonth());

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h2 className="text-xl font-black text-ink tracking-tight">출력 / 내보내기 센터</h2>
        <p className="text-sm text-ink-muted mt-1">각 항목의 조건을 선택한 뒤 출력 또는 다운로드하세요.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">

        {/* 1. 차량일지 */}
        <Card title="🚛 차량 운행일지" desc="날짜별 차량 운행일지 인쇄">
          <div>
            <Label>날짜</Label>
            <input type="date" value={vDate} onChange={(e) => setVDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-line bg-white text-sm font-mono font-bold" />
          </div>
          <a href={`/vehicles/print?date=${vDate}`} target="_blank" rel="noopener"
            className="w-full text-center px-4 py-2 rounded-lg text-sm font-extrabold bg-accent text-white hover:bg-accent-strong transition-colors">
            🖨 출력 화면 열기
          </a>
        </Card>

        {/* 2. 처리실적 */}
        <Card title="📊 일일 처리실적 일보" desc="일자별 처리실적 출력">
          <div>
            <Label>날짜</Label>
            <input type="date" value={pDate} onChange={(e) => setPDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-line bg-white text-sm font-mono font-bold" />
          </div>
          <a href={`/print/daily-treatment?date=${pDate}`} target="_blank" rel="noopener"
            className="w-full text-center px-4 py-2 rounded-lg text-sm font-extrabold bg-rose-600 text-white hover:bg-rose-700 transition-colors">
            🖨 출력 화면 열기
          </a>
        </Card>

        {/* 3. 안전관리 */}
        <Card title="⛑ 안전관리 보고서" desc="TBM·안전 보고서 화면 인쇄">
          <p className="text-xs text-ink-muted flex-1">안전관리 페이지의 일별 보기 탭에서 인쇄합니다.</p>
          <Link href="/safety?tab=DAILY"
            className="w-full text-center px-4 py-2 rounded-lg text-sm font-extrabold bg-amber-500 text-white hover:bg-amber-600 transition-colors">
            🖨 일별 보기로 바로 이동
          </Link>
        </Card>

        {/* 4. 연차현황 */}
        <Card title="📅 연차 현황" desc="기간별 연차 내역 Excel / CSV 다운로드">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>시작일</Label>
              <input type="date" value={lFrom} onChange={(e) => setLFrom(e.target.value)}
                className="w-full px-2 py-2 rounded-lg border border-line bg-white text-xs font-mono font-bold" />
            </div>
            <div>
              <Label>종료일</Label>
              <input type="date" value={lTo} onChange={(e) => setLTo(e.target.value)}
                className="w-full px-2 py-2 rounded-lg border border-line bg-white text-xs font-mono font-bold" />
            </div>
          </div>
          <div>
            <Label>형식</Label>
            <select value={lFmt} onChange={(e) => setLFmt(e.target.value as 'xlsx' | 'csv')}
              className="w-full px-3 py-2 rounded-lg border border-line bg-white text-sm font-bold">
              <option value="xlsx">Excel (.xlsx)</option>
              <option value="csv">CSV (.csv)</option>
            </select>
          </div>
          <a href={`/api/leave-requests/export?from=${lFrom}&to=${lTo}&format=${lFmt}`}
            className="w-full text-center px-4 py-2 rounded-lg text-sm font-extrabold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors">
            ⬇ {lFmt === 'xlsx' ? 'Excel' : 'CSV'} 다운로드
          </a>
        </Card>

        {/* 5. 민원관리 */}
        <Card title="📋 민원 대장" desc="기간·상태별 민원 목록 출력 / Excel">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>시작일</Label>
              <input type="date" value={cFrom} onChange={(e) => setCFrom(e.target.value)}
                className="w-full px-2 py-2 rounded-lg border border-line bg-white text-xs font-mono font-bold" />
            </div>
            <div>
              <Label>종료일</Label>
              <input type="date" value={cTo} onChange={(e) => setCTo(e.target.value)}
                className="w-full px-2 py-2 rounded-lg border border-line bg-white text-xs font-mono font-bold" />
            </div>
          </div>
          <div>
            <Label>상태 (선택)</Label>
            <select value={cStatus} onChange={(e) => setCStatus(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-line bg-white text-sm font-bold">
              <option value="">전체</option>
              <option value="RECEIVED">접수</option>
              <option value="ASSIGNED">배정</option>
              <option value="IN_PROGRESS">처리중</option>
              <option value="COMPLETED">완료</option>
              <option value="REJECTED">반려</option>
            </select>
          </div>
          <div className="flex gap-2">
            <a href={`/print/complaints?from=${cFrom}&to=${cTo}${cStatus ? `&status=${cStatus}` : ''}`}
              target="_blank" rel="noopener"
              className="flex-1 text-center px-4 py-2 rounded-lg text-sm font-extrabold bg-blue-600 text-white hover:bg-blue-700 transition-colors">
              🖨 출력
            </a>
            <a href={`/api/complaints/export?from=${cFrom}&to=${cTo}${cStatus ? `&status=${cStatus}` : ''}&format=xlsx`}
              className="flex-1 text-center px-4 py-2 rounded-lg text-sm font-extrabold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors">
              ⬇ Excel
            </a>
          </div>
        </Card>

        {/* 6. 출퇴근 월별 */}
        <Card title="🕐 월별 출퇴근 대장" desc="월별 근로자 출퇴근 현황 출력">
          <div>
            <Label>년월</Label>
            <input type="month" value={aYm} onChange={(e) => setAYm(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-line bg-white text-sm font-mono font-bold" />
          </div>
          <a href={`/print/attendance?ym=${aYm}`} target="_blank" rel="noopener"
            className="w-full text-center px-4 py-2 rounded-lg text-sm font-extrabold bg-violet-600 text-white hover:bg-violet-700 transition-colors">
            🖨 출력 화면 열기
          </a>
        </Card>

      </div>
    </div>
  );
}
