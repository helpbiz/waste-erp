/**
 * Streamlit DB(wci_ops_db:5434) → PWA DB(wci_waste_erp:5433) 마이그레이션
 *
 * 이전 대상:
 *   1. contractors (업체)   — municipalityId=3 (경기도 파주시) 매핑
 *   2. contractor_positions — 업체별 직책
 *   3. contractor_ranks     — 업체별 직급
 *
 * 실행: node scripts/migrate-from-streamlit.mjs
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { Client } = require('pg');

// ─── DB 연결 ───────────────────────────────────────────────────────
const SRC = new Client({
  host: 'localhost', port: 5434,
  user: 'cleanerp',
  password: 'tV7FRpcWgD+G+1r+YqW5L85ajaX9OIFnFaIRsmZFaA8',
  database: 'wci_ops_db',
});

const DST = new Client({
  host: 'localhost', port: 5433,
  user: 'wciuser',
  password: 'wcipass',
  database: 'wci_waste_erp',
});

// ─── 파주시 municipalityId ─────────────────────────────────────────
const PAJU_MUNICIPALITY_ID = 3n; // 경기도 파주시

const log = (msg) => console.log(`[${new Date().toISOString().slice(11,19)}] ${msg}`);

async function main() {
  await SRC.connect();
  await DST.connect();
  log('두 DB 연결 완료');

  // ── STEP 1: 업체 이전 ────────────────────────────────────────────
  log('STEP 1: 업체(contractors) 이전 시작');

  const { rows: srcContractors } = await SRC.query(
    `SELECT id, name, business_no, representative, active, contract_from, contract_to
     FROM contractors ORDER BY id`
  );

  const contractorIdMap = {}; // streamlit id → pwa id

  for (const c of srcContractors) {
    // business_no 없으면 임시값 (TEMP-업체명 앞4자)
    const bizNo = c.business_no?.trim() || `TEMP-${c.name.replace(/[^가-힣a-zA-Z0-9]/g, '').slice(0, 12)}`;

    const { rows: existing } = await DST.query(
      `SELECT id FROM contractors WHERE company_name = $1 AND municipality_id = $2`,
      [c.name, PAJU_MUNICIPALITY_ID]
    );

    if (existing.length > 0) {
      contractorIdMap[c.id] = existing[0].id;
      log(`  SKIP (이미 존재): ${c.name} → PWA id=${existing[0].id}`);
      continue;
    }

    // business_no unique 충돌 방지
    const { rows: bizCheck } = await DST.query(
      `SELECT id FROM contractors WHERE business_no = $1`, [bizNo]
    );
    const finalBizNo = bizCheck.length > 0 ? `${bizNo}-${Date.now()}` : bizNo;

    const { rows: inserted } = await DST.query(
      `INSERT INTO contractors
         (municipality_id, company_name, business_no, ceo_name, status,
          contract_start, contract_end, created_at)
       VALUES ($1, $2, $3, $4, 'SETUP', $5, $6, NOW())
       RETURNING id`,
      [
        PAJU_MUNICIPALITY_ID,
        c.name,
        finalBizNo,
        c.representative || null,
        c.contract_from || null,
        c.contract_to || null,
      ]
    );

    contractorIdMap[c.id] = inserted[0].id;
    log(`  INSERT: ${c.name} → PWA id=${inserted[0].id}  (bizNo: ${finalBizNo})`);
  }

  log(`STEP 1 완료: 업체 ${Object.keys(contractorIdMap).length}개 처리`);

  // ── STEP 2: 직책 이전 ────────────────────────────────────────────
  log('STEP 2: 직책(contractor_positions) 이전 시작');

  const { rows: srcPositions } = await SRC.query(
    `SELECT contractor_id, name, category, display_order, active FROM contractor_positions ORDER BY contractor_id, display_order`
  );

  let posInserted = 0, posSkipped = 0;
  for (const p of srcPositions) {
    const pwaContractorId = contractorIdMap[p.contractor_id];
    if (!pwaContractorId) { log(`  WARN: contractor_id=${p.contractor_id} 매핑 없음, 건너뜀`); continue; }

    const { rows: existing } = await DST.query(
      `SELECT id FROM contractor_positions WHERE contractor_id = $1 AND name = $2`,
      [pwaContractorId, p.name]
    );
    if (existing.length > 0) { posSkipped++; continue; }

    // category 매핑: Streamlit은 MANAGER/FIELD/ADMIN 그대로 사용
    const category = ['MANAGER', 'FIELD', 'ADMIN'].includes(p.category) ? p.category : 'FIELD';

    await DST.query(
      `INSERT INTO contractor_positions (contractor_id, name, category, sort_order, active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
      [pwaContractorId, p.name, category, p.display_order, p.active]
    );
    posInserted++;
  }

  log(`STEP 2 완료: 직책 INSERT ${posInserted}개, SKIP ${posSkipped}개`);

  // ── STEP 3: 직급 이전 ────────────────────────────────────────────
  log('STEP 3: 직급(contractor_ranks) 이전 시작');

  const { rows: srcRanks } = await SRC.query(
    `SELECT contractor_id, name, level, display_order, active FROM contractor_ranks ORDER BY contractor_id, display_order`
  );

  let rankInserted = 0, rankSkipped = 0;
  for (const r of srcRanks) {
    const pwaContractorId = contractorIdMap[r.contractor_id];
    if (!pwaContractorId) { log(`  WARN: contractor_id=${r.contractor_id} 매핑 없음, 건너뜀`); continue; }

    const { rows: existing } = await DST.query(
      `SELECT id FROM contractor_ranks WHERE contractor_id = $1 AND name = $2`,
      [pwaContractorId, r.name]
    );
    if (existing.length > 0) { rankSkipped++; continue; }

    await DST.query(
      `INSERT INTO contractor_ranks (contractor_id, name, level, sort_order, active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
      [pwaContractorId, r.name, r.level ?? 99, r.display_order, r.active]
    );
    rankInserted++;
  }

  log(`STEP 3 완료: 직급 INSERT ${rankInserted}개, SKIP ${rankSkipped}개`);

  // ── 최종 결과 요약 ───────────────────────────────────────────────
  const { rows: result } = await DST.query(
    `SELECT c.id, c.company_name, c.status, c.business_no,
       (SELECT COUNT(*) FROM contractor_positions WHERE contractor_id = c.id) AS pos_count,
       (SELECT COUNT(*) FROM contractor_ranks     WHERE contractor_id = c.id) AS rank_count
     FROM contractors c WHERE c.municipality_id = $1 ORDER BY c.company_name`,
    [PAJU_MUNICIPALITY_ID]
  );

  console.log('\n=== 마이그레이션 결과 ===');
  for (const r of result) {
    console.log(`  [${r.id}] ${r.company_name}  status=${r.status}  bizNo=${r.business_no}  직책=${r.pos_count}개  직급=${r.rank_count}개`);
  }
  console.log('========================\n');

  await SRC.end();
  await DST.end();
  log('완료');
}

main().catch((e) => { console.error('오류:', e.message); process.exit(1); });
