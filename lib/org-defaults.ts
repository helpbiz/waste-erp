export const DEFAULT_POSITIONS = [
  { name: '대표', category: 'ADMIN', sortOrder: 1 },
  { name: '이사', category: 'ADMIN', sortOrder: 2 },
  { name: '팀장', category: 'MANAGER', sortOrder: 3 },
  { name: '반장', category: 'MANAGER', sortOrder: 4 },
  { name: '기사', category: 'FIELD', sortOrder: 5 },
  { name: '환경미화원', category: 'FIELD', sortOrder: 6 },
  { name: '사무원', category: 'ADMIN', sortOrder: 7 },
  { name: '현장소장', category: 'MANAGER', sortOrder: 8 },
] as const;

export const DEFAULT_RANKS = [
  { name: '1급', level: 1, sortOrder: 1 },
  { name: '2급', level: 2, sortOrder: 2 },
  { name: '3급', level: 3, sortOrder: 3 },
  { name: '4급', level: 4, sortOrder: 4 },
  { name: '5급', level: 5, sortOrder: 5 },
] as const;
