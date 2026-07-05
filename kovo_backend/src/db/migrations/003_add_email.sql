-- ═══════════════════════════════════════════════════════════════════════
-- Migration 003: Add email column to user_profiles
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════

-- Add email column (nullable for existing users)
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS email TEXT;

-- Create unique index for email (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_email
  ON public.user_profiles (LOWER(email))
  WHERE email IS NOT NULL;
