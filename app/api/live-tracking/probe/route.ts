/**
 * POST /api/live-tracking/probe
 * 슈퍼관리자 전용 — 저장된 외부 GPS API를 실제로 호출해 원본 JSON 응답을 반환
 * 응답 형식 파악용 (운영 미사용)
 *
 * etrace: pos_last_seq.jsp + pos_json.jsp (POST body auth)
 * 기타:   gisBaseUrl GET + Bearer/queryParam auth
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { decryptField } from '@/lib/crypto';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (session.role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const contractorIdParam = body.contractorId;

  const cId = contractorIdParam ? BigInt(contractorIdParam) : (session.contractorId ? BigInt(session.contractorId) : null);
  if (!cId) return NextResponse.json({ error: 'no_contractor' }, { status: 400 });

  const config = await prisma.liveTrackingConfig.findUnique({ where: { contractorId: cId } });
  if (!config?.gisBaseUrl && config?.gisProvider !== 'etrace') {
    return NextResponse.json({ error: 'gis_base_url_not_set' }, { status: 400 });
  }

  const apiKey = config.apiKeyEnc ? await decryptField(config.apiKeyEnc) : null;

  /* ETRACE: POST body auth, SEQ 기반 */
  if (config.gisProvider === 'etrace') {
    const base = (config.gisBaseUrl ?? 'http://ems25.etrace.co.kr/intf').replace(/\/$/, '');
    if (!apiKey) return NextResponse.json({ error: 'api_key_not_set' }, { status: 400 });

    let seqResult: unknown = null;
    let posResult: unknown = null;
    let errorMsg: string | null = null;

    try {
      const seqRes = await fetch(`${base}/pos_last_seq.jsp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: apiKey }),
        signal: AbortSignal.timeout(10_000),
        redirect: 'follow',
      });
      const seqText = await seqRes.text();
      try { seqResult = JSON.parse(seqText); } catch { seqResult = seqText; }

      const seq = (seqResult as { output?: { SEQ?: number } })?.output?.SEQ;
      if (seq) {
        const posRes = await fetch(`${base}/pos_json.jsp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: apiKey, input: { SEQ: seq - 1 } }),
          signal: AbortSignal.timeout(10_000),
          redirect: 'follow',
        });
        const posText = await posRes.text();
        try { posResult = JSON.parse(posText); } catch { posResult = posText; }
      }
    } catch (e) {
      errorMsg = e instanceof Error ? e.message : 'unknown error';
    }

    return NextResponse.json({
      ok: !errorMsg,
      provider: 'etrace',
      lastSeqResponse: seqResult,
      positionsResponse: posResult,
      error: errorMsg,
      tip: 'VEH_PLATES(차량번호), LAT(위도), LON(경도) 필드 확인. 차량번호가 Vehicle 테이블의 vehicleNo와 일치해야 합니다.',
    });
  }

  /* 일반 GET 방식 */
  const url = config.gisBaseUrl!.replace(/\/$/, '');
  const headers: Record<string, string> = { 'Accept': 'application/json' };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
    headers['X-API-KEY'] = apiKey;
  }
  const urlWithKey = apiKey ? `${url}${url.includes('?') ? '&' : '?'}apiKey=${encodeURIComponent(apiKey)}` : url;

  let rawBody: unknown = null;
  let statusCode = 0;
  let errorMsg: string | null = null;

  try {
    const res = await fetch(urlWithKey, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(10000),
    });
    statusCode = res.status;
    const text = await res.text();
    try { rawBody = JSON.parse(text); } catch { rawBody = text; }
  } catch (e) {
    errorMsg = e instanceof Error ? e.message : 'unknown error';
  }

  return NextResponse.json({
    ok: !errorMsg && statusCode >= 200 && statusCode < 300,
    url: urlWithKey,
    status: statusCode,
    response: rawBody,
    error: errorMsg,
    tip: '응답 JSON 구조를 확인해 위도/경도/차량번호 필드명을 알려주세요.',
  });
}
