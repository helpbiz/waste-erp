/**
 * POST /api/live-tracking/probe
 * 슈퍼관리자 전용 — 저장된 외부 GPS API를 실제로 호출해 원본 JSON 응답을 반환
 * 응답 형식 파악용 (운영 미사용)
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
  const contractorId = body.contractorId ? BigInt(body.contractorId) : null;

  /* contractorId 지정 시 해당 업체 설정, 없으면 세션 업체 */
  const cId = contractorId ?? (session.contractorId ? BigInt(session.contractorId) : null);
  if (!cId) return NextResponse.json({ error: 'no_contractor' }, { status: 400 });

  const config = await prisma.liveTrackingConfig.findUnique({ where: { contractorId: cId } });
  if (!config?.gisBaseUrl) return NextResponse.json({ error: 'gis_base_url_not_set' }, { status: 400 });

  const apiKey = config.apiKeyEnc ? await decryptField(config.apiKeyEnc) : null;

  /* URL 구성 — 일반적인 쿼리 파라미터 방식과 Authorization 헤더 방식 모두 시도 */
  const url = config.gisBaseUrl.replace(/\/$/, '');

  /* 헤더 방식 */
  const headers: Record<string, string> = { 'Accept': 'application/json' };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
    headers['X-API-KEY'] = apiKey;
  }

  /* 쿼리 파라미터 방식: ?apiKey=... 또는 ?key=... */
  const urlWithKey = apiKey ? `${url}${url.includes('?') ? '&' : '?'}apiKey=${encodeURIComponent(apiKey)}` : url;

  let rawBody: unknown = null;
  let statusCode = 0;
  let errorMsg: string | null = null;
  let finalUrl = urlWithKey;

  try {
    const res = await fetch(urlWithKey, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(10000),
    });
    statusCode = res.status;
    const text = await res.text();
    try { rawBody = JSON.parse(text); } catch { rawBody = text; }
    finalUrl = urlWithKey;
  } catch (e) {
    errorMsg = e instanceof Error ? e.message : 'unknown error';
  }

  return NextResponse.json({
    ok: !errorMsg && statusCode >= 200 && statusCode < 300,
    url: finalUrl,
    status: statusCode,
    response: rawBody,
    error: errorMsg,
    tip: '응답 JSON 구조를 확인해 위도/경도/차량번호 필드명을 알려주세요. 그러면 파싱 로직을 추가합니다.',
  });
}
