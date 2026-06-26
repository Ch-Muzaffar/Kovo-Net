-- Migration: Add 'topic' to post_tags tag_type constraint
-- Run this in Supabase SQL Editor if you have an existing deployment

ALTER TABLE public.post_tags DROP CONSTRAINT IF EXISTS post_tags_tag_type_check;
ALTER TABLE public.post_tags ADD CONSTRAINT post_tags_tag_type_check 
  CHECK (tag_type IN ('department', 'profession', 'user', 'skill', 'hobby', 'topic'));
