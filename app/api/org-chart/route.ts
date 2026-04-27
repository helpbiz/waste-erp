/**
 * GET /api/org-chart — 조직도 트리 + 부서별 사용자
 *  - 가시범위 contractor의 Department 트리
 *  - 각 부서: head + members
 *  - 부서 미지정 사용자 목록 별도 반환
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';

export const runtime = 'nodejs';

type DeptNode = {
  id: string;
  name: string;
  parentId: string | null;
  sortOrder: number;
  head: { id: string; name: string; positionLabel: string | null } | null;
  members: Array<{ id: string; name: string; employeeNo: string | null; positionLabel: string | null; positionCategory: string | null; profilePhotoUrl: string | null }>;
  children: DeptNode[];
};

export async function GET() {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  let contractorId: bigint | null = null;
  if (session.role === 'SUPER_ADMIN') {
    const c = await prisma.contractor.findFirst({ where: { status: 'ACTIVE' } });
    contractorId = c?.id ?? null;
  } else if (session.contractorId) {
    contractorId = BigInt(session.contractorId);
  } else if (session.role === 'MUNI_ADMIN' && session.municipalityId) {
    const c = await prisma.contractor.findFirst({
      where: { municipalityId: BigInt(session.municipalityId), status: 'ACTIVE' },
    });
    contractorId = c?.id ?? null;
  }
  if (!contractorId) {
    return NextResponse.json({ contractorName: null, tree: [], unassigned: [] });
  }

  const [contractor, depts, users] = await Promise.all([
    prisma.contractor.findUnique({ where: { id: contractorId }, select: { companyName: true } }),
    prisma.department.findMany({
      where: { contractorId, active: true },
      include: { head: { include: { position: { select: { label: true } } } } },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    }),
    prisma.user.findMany({
      where: { contractorId, status: 'ACTIVE' },
      include: {
        position: { select: { label: true, category: true } },
        profilePhoto: { select: { contentRef: true } },
      },
      orderBy: { name: 'asc' },
    }),
  ]);

  /* 부서별 멤버 분류 */
  const memberMap = new Map<string, DeptNode['members']>();
  const unassigned: DeptNode['members'] = [];
  for (const u of users) {
    const m = {
      id: u.id.toString(),
      name: u.name,
      employeeNo: u.employeeNo,
      positionLabel: u.position?.label ?? null,
      positionCategory: u.position?.category ?? null,
      profilePhotoUrl: u.profilePhoto?.contentRef ?? null,
    };
    if (u.departmentId) {
      const k = u.departmentId.toString();
      const arr = memberMap.get(k) ?? [];
      arr.push(m);
      memberMap.set(k, arr);
    } else {
      unassigned.push(m);
    }
  }

  /* 부서 노드 객체 생성 */
  const nodeMap = new Map<string, DeptNode>();
  for (const d of depts) {
    nodeMap.set(d.id.toString(), {
      id: d.id.toString(),
      name: d.name,
      parentId: d.parentId?.toString() ?? null,
      sortOrder: d.sortOrder,
      head: d.head ? {
        id: d.head.id.toString(),
        name: d.head.name,
        positionLabel: d.head.position?.label ?? null,
      } : null,
      members: memberMap.get(d.id.toString()) ?? [],
      children: [],
    });
  }

  /* 트리 연결 */
  const roots: DeptNode[] = [];
  for (const node of nodeMap.values()) {
    if (node.parentId && nodeMap.has(node.parentId)) {
      nodeMap.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  /* 정렬 */
  function sortTree(nodes: DeptNode[]) {
    nodes.sort((a, b) => a.sortOrder - b.sortOrder);
    nodes.forEach((n) => sortTree(n.children));
  }
  sortTree(roots);

  return NextResponse.json({
    contractorName: contractor?.companyName ?? null,
    tree: roots,
    unassigned,
  });
}
