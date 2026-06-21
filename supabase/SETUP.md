# Supabase Setup Guide

## Step 1 — Create a Supabase project

1. Go to https://supabase.com and sign in
2. Click **New project**, choose **Free plan**
3. Set a database password (save it!)
4. Wait ~2 minutes for project to initialise

## Step 2 — Get credentials

In your project dashboard → **Settings → API**:

| Key | Where used |
|-----|-----------|
| **Project URL** | `SUPABASE_URL` in `backend/.env` |
| **anon (public)** key | `SUPABASE_ANON_KEY` in `backend/.env` |
| **service_role** key | `SUPABASE_SERVICE_KEY` in `backend/.env` |

## Step 3 — Run the database migration

1. Go to **SQL Editor** in your Supabase dashboard
2. Click **New query**
3. Paste the contents of `supabase/migrations/001_initial_schema.sql`
4. Click **Run**

This creates:
- `answer_keys` table (with RLS)
- `check_results` table (with RLS)  
- `usage_counters` table (with RLS)

## Step 4 — Create Storage bucket

1. Go to **Storage** in your Supabase dashboard
2. Click **New bucket**
3. Name: `omr-sheets`
4. **Uncheck** "Public bucket" (keep it private)
5. Click **Create bucket**

## Step 5 — Configure Auth

In **Authentication → Providers**:
- ✅ **Email** provider should already be enabled
- Optional: Enable email confirmation for production

## Step 6 — Copy credentials to backend

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env`:
```
SUPABASE_URL=https://xxxxxxxxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_KEY=eyJhbGc...
CORS_ORIGINS=http://localhost:5173
```

## Step 7 — Run the backend

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Test: http://localhost:8000/health → `{"status":"ok"}`  
Docs: http://localhost:8000/api/docs

## Done ✅

You can now:
- Sign up at http://localhost:5173/login
- Create answer keys at http://localhost:5173/keys
- Upload sheets at http://localhost:5173/check (Phase 3 needed for processing)
