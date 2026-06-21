-- Migration: Add Sections to Answer Keys
-- Description: Allows templates to define multiple parts (e.g. Section A, Section B)

ALTER TABLE public.answer_keys ADD COLUMN IF NOT EXISTS sections jsonb DEFAULT '[]';
