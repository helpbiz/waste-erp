-- muni-user-delegation 2026-08-15 — 지자체 그룹 신설. Additive only(값 추가만, 기존 enum 값 무변경).

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'MUNI_USER';
