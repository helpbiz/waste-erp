-- Migration: add is_payroll_manager to users, attachment_urls to announcements
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_payroll_manager" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "announcements" ADD COLUMN IF NOT EXISTS "attachment_urls" TEXT;
