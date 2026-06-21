-- ============================================================
-- Migration: 001_initial_schema
-- AntiGravity OMR Check — v1 Database Schema
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. ANSWER KEYS
--    Stores teacher-created answer keys.
--    Each row is owned by one auth.users record.
-- ────────────────────────────────────────────────────────────
create table if not exists public.answer_keys (
    id                   uuid primary key default gen_random_uuid(),
    user_id              uuid not null references auth.users(id) on delete cascade,
    name                 text not null,
    question_count       integer not null check (question_count between 1 and 100),
    choices_per_question integer not null check (choices_per_question between 2 and 5),
    -- answers is a JSON array of integers [0=A, 1=B, 2=C, 3=D, 4=E]
    answers              jsonb  not null default '[]',
    created_at           timestamptz not null default now(),
    updated_at           timestamptz not null default now()
);

-- Auto-update updated_at whenever the row changes
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create trigger answer_keys_updated_at
    before update on public.answer_keys
    for each row execute function public.set_updated_at();

-- Indexes
create index if not exists answer_keys_user_id_idx on public.answer_keys(user_id);

-- RLS – Row Level Security
alter table public.answer_keys enable row level security;

create policy "Users can view their own keys"
    on public.answer_keys for select
    using (auth.uid() = user_id);

create policy "Users can insert their own keys"
    on public.answer_keys for insert
    with check (auth.uid() = user_id);

create policy "Users can update their own keys"
    on public.answer_keys for update
    using (auth.uid() = user_id);

create policy "Users can delete their own keys"
    on public.answer_keys for delete
    using (auth.uid() = user_id);


-- ────────────────────────────────────────────────────────────
-- 2. CHECK RESULTS
--    Stores one row per graded answer sheet.
-- ────────────────────────────────────────────────────────────
create table if not exists public.check_results (
    id              uuid primary key default gen_random_uuid(),
    user_id         uuid not null references auth.users(id) on delete cascade,
    key_id          uuid references public.answer_keys(id) on delete set null,
    key_name        text,            -- denormalised; preserved even if key deleted

    -- Scores
    total           integer not null,
    correct         integer not null,
    wrong           integer not null,
    unattempted     integer not null default 0,
    percentage      numeric(5,2) not null,
    grade           text not null,
    confidence      integer not null default 0,  -- 0-100

    -- Per-question breakdown: [{q:1, student_answer:2, correct_answer:0, correct:false}, …]
    per_question    jsonb not null default '[]',

    -- Section breakdown (optional): [{name:"...", correct:5, total:8}, …]
    sections        jsonb not null default '[]',

    -- Storage URLs for original + annotated images
    original_image_url   text,
    annotated_image_url  text,

    created_at      timestamptz not null default now()
);

create index if not exists check_results_user_id_idx  on public.check_results(user_id);
create index if not exists check_results_key_id_idx   on public.check_results(key_id);
create index if not exists check_results_created_at_idx on public.check_results(created_at desc);

alter table public.check_results enable row level security;

create policy "Users can view their own results"
    on public.check_results for select
    using (auth.uid() = user_id);

create policy "Users can insert their own results"
    on public.check_results for insert
    with check (auth.uid() = user_id);

create policy "Users can update their own results"
    on public.check_results for update
    using (auth.uid() = user_id);

create policy "Users can delete their own results"
    on public.check_results for delete
    using (auth.uid() = user_id);


-- ────────────────────────────────────────────────────────────
-- 3. USAGE TRACKING
--    One row per user per month — incremented on each check.
-- ────────────────────────────────────────────────────────────
create table if not exists public.usage_counters (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid not null references auth.users(id) on delete cascade,
    month       text not null,  -- format: "YYYY-MM"
    check_count integer not null default 0,
    unique (user_id, month)
);

create index if not exists usage_counters_user_month_idx on public.usage_counters(user_id, month);

alter table public.usage_counters enable row level security;

create policy "Users can view their own usage"
    on public.usage_counters for select
    using (auth.uid() = user_id);

-- Only the service role (backend) should write usage
create policy "Service role inserts usage"
    on public.usage_counters for insert
    with check (true);

create policy "Service role updates usage"
    on public.usage_counters for update
    using (true);


-- ────────────────────────────────────────────────────────────
-- 4. STORAGE BUCKET
--    Run this separately if not using Supabase CLI:
--    Dashboard → Storage → New Bucket → "omr-sheets" (private)
-- ────────────────────────────────────────────────────────────
-- insert into storage.buckets (id, name, public)
-- values ('omr-sheets', 'omr-sheets', false)
-- on conflict (id) do nothing;
