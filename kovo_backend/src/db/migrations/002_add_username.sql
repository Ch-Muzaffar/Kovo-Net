-- ═══════════════════════════════════════════════════════════════════════
-- Migration 002: Add username column to user_profiles
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════

-- Add username column (nullable for existing users)
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS username TEXT;

-- Create unique index for username (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_username
  ON public.user_profiles (LOWER(username))
  WHERE username IS NOT NULL;
