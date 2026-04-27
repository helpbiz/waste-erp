// Design Ref: §2.1 lib/report/template-loader — DB ReportTemplate.spec 로드
// Plan SC: F-02 단일 양식 재사용, 후속 양식은 code/contractorId/municipalityId 매칭

import { prisma } from '@/lib/db';
import type { ReportSpec } from './spec-types';

export type LoadTemplateInput = {
  contractorId: bigint;
  municipalityId?: bigint | null;
  code: string;          // "F-02"
};

export async function loadReportTemplate(input: LoadTemplateInput): Promise<{
  id: bigint;
  name: string;
  spec: ReportSpec;
  version: number;
}> {
  /* 우선순위: contractor+municipality 커스텀 → contractor 표준 */
  const candidates = await prisma.reportTemplate.findMany({
    where: {
      contractorId: input.contractorId,
      code: input.code,
      active: true,
      OR: [
        { municipalityId: input.municipalityId ?? null },
        { municipalityId: null },
      ],
    },
    orderBy: [
      { municipalityId: { sort: 'asc', nulls: 'last' } }, // NULL last → 커스텀 우선
      { version: 'desc' },
    ],
    take: 1,
  });

  const tpl = candidates[0];
  if (!tpl) {
    throw new Error(`report_template_not_found:${input.code}`);
  }

  return {
    id: tpl.id,
    name: tpl.name,
    spec: tpl.spec as unknown as ReportSpec,
    version: tpl.version,
  };
}
