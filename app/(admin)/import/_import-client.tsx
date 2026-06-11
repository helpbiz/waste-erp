'use client';

import { useState, useRef, useCallback } from 'react';

interface Props {
  isSuperAdmin: boolean;
  contractors: { id: string; name: string }[];
}

type DataType = '인원' | '차량';
type Step = 'upload' | 'mapping' | 'result';

interface ParsedSheet {
  name: string;
  headers: string[];
  sample: Record<string, string>[];
  rows: Record<string, string>[];
}

interface RowResult {
  rowNo: number;
  status: 'OK' | 'SKIP' | 'ERROR';
  message: string;
  [key: string]: unknown;
}

interface ImportResponse {
  total: number;
  okCount: number;
  results: RowResult[];
}

const VEHICLE_FIELDS = [
  { key: 'vehicleNo',        label: '차량번호',    required: true  },
  { key: 'vehicleType',      label: '차종',        required: true  },
  { key: 'vehicleTon',       label: '톤수',        required: false },
  { key: 'fuelType',         label: '연료종류',    required: false },
  { key: 'yearManufactured', label: '연식(년도)',  required: false },
];

const WORKER_FIELDS = [
  { key: 'name',       label: '이름',     required: true  },
  { key: 'phone',      label: '전화번호', required: false },
  { key: 'employeeNo', label: '직원번호', required: false },
  { key: 'hireDate',   label: '입사일',   required: false },
  { key: 'rank',       label: '직급',     required: false },
];

const AUTO_KEYWORDS: Record<string, string[]> = {
  vehicleNo:        ['차량번호', '번호판', '등록번호', '차번'],
  vehicleType:      ['차종', '차량유형', '유형', '종류'],
  vehicleTon:       ['톤수', '적재량', '톤'],
  fuelType:         ['연료', '유종', '연료종류'],
  yearManufactured: ['연식', '제조연도', '년식'],
  name:             ['이름', '성명', '직원명'],
  phone:            ['전화', '전화번호', '연락처', '휴대폰'],
  employeeNo:       ['직원번호', '사번', '사원번호'],
  hireDate:         ['입사일', '채용일', '고용일'],
  rank:             ['직급', '직책', '직위'],
};

function autoMap(headers: string[], fields: typeof VEHICLE_FIELDS): Record<string, string | null> {
  const result: Record<string, string | null> = {};
  const hNorm = headers.map((h) => h.toLowerCase().replace(/\s/g, ''));
  for (const f of fields) {
    let matched: string | null = null;
    for (const kw of AUTO_KEYWORDS[f.key] ?? []) {
      const kwN = kw.toLowerCase().replace(/\s/g, '');
      const idx = hNorm.findIndex((h) => h.includes(kwN) || kwN.includes(h));
      if (idx >= 0) { matched = headers[idx]; break; }
    }
    result[f.key] = matched;
  }
  return result;
}

export default function ImportClient({ isSuperAdmin, contractors }: Props) {
  const [dataType, setDataType]       = useState<DataType>('인원');
  const [contractorId, setContractorId] = useState(contractors[0]?.id ?? '');
  const [step, setStep]               = useState<Step>('upload');
  const [sheets, setSheets]           = useState<ParsedSheet[]>([]);
  const [sheetIdx, setSheetIdx]       = useState(0);
  const [colMap, setColMap]           = useState<Record<string, string | null>>({});
  const [loading, setLoading]         = useState(false);
  const [importRes, setImportRes]     = useState<ImportResponse | null>(null);
  const [error, setError]             = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fields = dataType === '차량' ? VEHICLE_FIELDS : WORKER_FIELDS;
  const requiredKey = dataType === '차량' ? 'vehicleNo' : 'name';
  const sheet = sheets[sheetIdx] ?? null;

  function reset() {
    setStep('upload');
    setSheets([]);
    setSheetIdx(0);
    setColMap({});
    setImportRes(null);
    setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function changeDataType(t: DataType) {
    setDataType(t);
    reset();
  }

  const handleFile = useCallback(async (file: File) => {
    setLoading(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/import/parse', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.error ?? '파일 파싱 실패');
      setSheets(data.sheets);
      setSheetIdx(0);
      setColMap(autoMap(data.sheets[0].headers, fields));
      setStep('mapping');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '알 수 없는 오류');
    } finally {
      setLoading(false);
    }
  }, [fields]);

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  function handleSheetChange(idx: number) {
    setSheetIdx(idx);
    setColMap(autoMap(sheets[idx].headers, fields));
  }

  async function handleImport() {
    if (!sheet) return;
    setLoading(true);
    setError('');
    try {
      const endpoint = dataType === '차량' ? '/api/import/vehicles' : '/api/import/workers';
      const body: Record<string, unknown> = { rows: sheet.rows, colMap };
      if (isSuperAdmin && contractorId) body.contractorId = contractorId;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.error ?? '입력 실패');
      setImportRes(data);
      setStep('result');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '알 수 없는 오류');
    } finally {
      setLoading(false);
    }
  }

  const statusIcon: Record<string, string> = { OK: '✅', SKIP: '⏭', ERROR: '❌' };
  const statusLabel: Record<string, string> = { OK: '성공', SKIP: '건너뜀', ERROR: '오류' };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">
      {/* 헤더 */}
      <div>
        <h1 className="text-xl font-bold text-gray-800">📥 일괄 업로드</h1>
        <p className="text-sm text-gray-500 mt-1">
          엑셀 파일을 첨부하면 인원·차량 마스터를 자동으로 등록합니다. 컬럼 순서·이름이 달라도 자동 인식합니다.
        </p>
      </div>

      {/* ① 데이터 유형 + 업체 */}
      <section className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
        <p className="text-sm font-semibold text-gray-700">① 데이터 유형 선택</p>
        <div className="flex gap-3">
          {(['인원', '차량'] as DataType[]).map((t) => (
            <button
              key={t}
              onClick={() => changeDataType(t)}
              className={`px-5 py-2 rounded-lg border-2 font-semibold text-sm transition-colors ${
                dataType === t
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300'
              }`}
            >
              {t === '인원' ? '👷 인원' : '🚛 차량'}
            </button>
          ))}
        </div>

        {isSuperAdmin && contractors.length > 0 && (
          <div>
            <label className="text-sm font-medium text-gray-600 block mb-1">위탁업체 선택</label>
            <select
              value={contractorId}
              onChange={(e) => setContractorId(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-72 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus:ring-2 focus:ring-blue-400"
            >
              {contractors.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}
      </section>

      {/* ② 파일 업로드 */}
      <section className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        <p className="text-sm font-semibold text-gray-700">② 파일 업로드</p>
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
          className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors"
        >
          <span className="text-2xl">📂</span>
          <span className="text-gray-500 text-sm mt-1">엑셀 파일(.xlsx, .xls)을 클릭하거나 드래그하세요</span>
          <span className="text-sm text-gray-400 mt-0.5">컬럼 형식이 달라도 자동 인식합니다</span>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={handleInputChange}
        />
        {loading && (
          <p className="text-sm text-blue-600 animate-pulse">⏳ 파일 분석 중...</p>
        )}
        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
        )}
      </section>

      {/* ③ 컬럼 매핑 */}
      {step !== 'upload' && sheet && (
        <section className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-700">③ 컬럼 매핑</p>
            <span className="text-sm text-gray-400">
              컬럼 {sheet.headers.length}개 · 데이터 {sheet.rows.length}행 감지
            </span>
          </div>

          {sheets.length > 1 && (
            <div>
              <label className="text-sm font-medium text-gray-600 block mb-1">시트 선택</label>
              <select
                value={sheetIdx}
                onChange={(e) => handleSheetChange(Number(e.target.value))}
                className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus:ring-2 focus:ring-blue-400"
              >
                {sheets.map((s, i) => (
                  <option key={i} value={i}>{s.name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <p className="text-sm text-gray-500 mb-2">자동 인식 결과입니다. 잘못된 항목은 직접 수정하세요.</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {fields.map((f) => (
                <div key={f.key}>
                  <label className="text-sm font-medium text-gray-600 block mb-1">
                    {f.required && <span className="text-red-500 mr-0.5">*</span>}
                    {f.label}
                  </label>
                  <select
                    value={colMap[f.key] ?? ''}
                    onChange={(e) =>
                      setColMap((prev) => ({ ...prev, [f.key]: e.target.value || null }))
                    }
                    className="border border-gray-300 rounded px-2 py-1.5 text-sm w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus:ring-2 focus:ring-blue-400"
                  >
                    <option value="">(없음)</option>
                    {sheet.headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* 샘플 미리보기 */}
          <div>
            <p className="text-sm font-medium text-gray-600 mb-2">매핑된 데이터 미리보기 (처음 5행)</p>
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="text-sm w-full border-collapse">
                <thead>
                  <tr className="bg-gray-50">
                    {fields.filter((f) => colMap[f.key]).map((f) => (
                      <th key={f.key} className="border-b border-gray-200 px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap">
                        {f.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sheet.rows.slice(0, 5).map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50/50">
                      {fields.filter((f) => colMap[f.key]).map((f) => (
                        <td key={f.key} className="border-b border-gray-100 px-3 py-1.5 text-gray-700 whitespace-nowrap">
                          {colMap[f.key] ? (row[colMap[f.key]!] ?? '') : ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {sheet.rows.length > 5 && (
              <p className="text-sm text-gray-400 mt-1">처음 5행 표시 중 (전체 {sheet.rows.length}행)</p>
            )}
          </div>
        </section>
      )}

      {/* ④ 가져오기 실행 */}
      {step === 'mapping' && sheet && (
        <section className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-gray-600">
              <strong className="text-gray-800">{dataType === '차량' ? '🚛 차량' : '👷 인원'}</strong> 데이터{' '}
              <strong className="text-blue-600">{sheet.rows.length}행</strong>을 DB에 입력합니다.
              {dataType === '인원' && (
                <span className="text-sm text-gray-400 ml-2">초기 비밀번호: Qwer1234!</span>
              )}
            </p>
            <button
              onClick={handleImport}
              disabled={!colMap[requiredKey] || loading}
              className="shrink-0 px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold disabled:opacity-40 hover:bg-blue-700 active:bg-blue-800 transition-colors"
            >
              {loading ? '입력 중...' : '📥 가져오기 실행'}
            </button>
          </div>
          {!colMap[requiredKey] && (
            <p className="text-sm text-red-500 mt-2">
              ⚠️ 필수 컬럼 &quot;{dataType === '차량' ? '차량번호' : '이름'}&quot;을 ③에서 지정해주세요.
            </p>
          )}
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-2">{error}</p>
          )}
        </section>
      )}

      {/* ⑤ 결과 */}
      {step === 'result' && importRes && (
        <section className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-700">⑤ 가져오기 결과</p>
            <button onClick={reset} className="text-sm text-blue-600 hover:underline">
              다시 업로드
            </button>
          </div>

          {/* 요약 카드 */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-gray-700">{importRes.total}</p>
              <p className="text-sm text-gray-500 mt-1">전체</p>
            </div>
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-green-600">{importRes.okCount}</p>
              <p className="text-sm text-green-600 mt-1">성공</p>
            </div>
            <div className={`rounded-lg p-3 text-center ${
              importRes.results.some((r) => r.status === 'ERROR') ? 'bg-red-50' : 'bg-yellow-50'
            }`}>
              <p className={`text-2xl font-bold ${
                importRes.results.some((r) => r.status === 'ERROR') ? 'text-red-600' : 'text-yellow-600'
              }`}>
                {importRes.total - importRes.okCount}
              </p>
              <p className={`text-sm mt-1 ${
                importRes.results.some((r) => r.status === 'ERROR') ? 'text-red-600' : 'text-yellow-600'
              }`}>건너뜀/오류</p>
            </div>
          </div>

          {importRes.okCount > 0 && importRes.okCount === importRes.total && (
            <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700 font-medium">
              ✅ 전체 {importRes.total}건 입력 완료!
            </div>
          )}
          {importRes.okCount > 0 && importRes.okCount < importRes.total && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-700">
              ✅ {importRes.okCount}건 성공 · {importRes.total - importRes.okCount}건 건너뜀/오류
              {dataType === '인원' && (
                <span className="block text-sm mt-0.5 text-blue-500">등록된 인원의 초기 비밀번호는 Qwer1234! 입니다.</span>
              )}
            </div>
          )}

          {/* 행별 결과 테이블 */}
          <div className="overflow-auto max-h-72 rounded-lg border border-gray-200">
            <table className="text-sm w-full border-collapse">
              <thead className="sticky top-0 bg-white">
                <tr className="bg-gray-50">
                  <th className="border-b border-gray-200 px-3 py-2 text-left font-semibold text-gray-600 w-12">행</th>
                  <th className="border-b border-gray-200 px-3 py-2 text-left font-semibold text-gray-600 w-24">상태</th>
                  <th className="border-b border-gray-200 px-3 py-2 text-left font-semibold text-gray-600">메시지</th>
                  <th className="border-b border-gray-200 px-3 py-2 text-left font-semibold text-gray-600">데이터</th>
                </tr>
              </thead>
              <tbody>
                {importRes.results.map((r, i) => (
                  <tr
                    key={i}
                    className={
                      r.status === 'ERROR' ? 'bg-red-50' :
                      r.status === 'SKIP'  ? 'bg-yellow-50/50' : ''
                    }
                  >
                    <td className="border-b border-gray-100 px-3 py-1.5 text-gray-500">{r.rowNo}</td>
                    <td className="border-b border-gray-100 px-3 py-1.5 whitespace-nowrap">
                      <span className={`font-medium ${
                        r.status === 'OK' ? 'text-green-700' :
                        r.status === 'SKIP' ? 'text-yellow-700' : 'text-red-700'
                      }`}>
                        {statusIcon[r.status]} {statusLabel[r.status]}
                      </span>
                    </td>
                    <td className="border-b border-gray-100 px-3 py-1.5 text-gray-600">{r.message}</td>
                    <td className="border-b border-gray-100 px-3 py-1.5 text-gray-400 font-mono">
                      {Object.entries(r)
                        .filter(([k]) => !['rowNo', 'status', 'message'].includes(k))
                        .map(([k, v]) => `${k}=${v}`)
                        .join(' · ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
