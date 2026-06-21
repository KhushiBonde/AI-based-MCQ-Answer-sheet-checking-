# AntiGravity OMR Check — Roadmap v1.0

**Milestone:** M1 — Web Application MVP
**Goal:** Transform the existing Python CLI OMR engine into a full market-ready web product matching the AntiGravity UI Reference design system.

---

## Phases Overview

| # | Phase | Goal | Requirements | Plans |
|---|-------|------|--------------|-------|
| 1 | Project Scaffold & Auth | Working app skeleton with auth | AUTH-01..04, UI-01, UI-04 | 3 |
| 2 | Answer Key Manager | CRUD for named answer keys | KEY-01..05 | 2 |
| 3 | Upload & OMR Processing | End-to-end sheet check flow | UPLOAD-01..06, PROC-01..06, UI-02 | 4 |
| 4 | Result View | Full result screen with override + export | RESULT-01..08 | 3 |
| 5 | Analytics & Batch Upload | Class insights + bulk processing | ANALYTICS-01..05, BATCH-01..04 | 3 |
| 6 | History & Usage Tracking | Past checks + quota display | HIST-01..03, USAGE-01..02 | 2 |
| 7 | Polish, Mobile & Deployment | Production-ready, deployed | UI-03, UI-04 + all NFRs | 3 |

---

## Phase 1 — Project Scaffold & Auth

**Goal:** Create working project skeleton (FastAPI backend + Vite/React frontend) with Supabase auth, navigation shell, and AntiGravity design system wired up. A developer can sign up, log in, and see the placeholder dashboard.

**Requirements:** AUTH-01, AUTH-02, AUTH-03, AUTH-04, UI-01, UI-04

**Plans:**
1. **Backend scaffold** — FastAPI project, Supabase client, health endpoint, CORS, env config
2. **Frontend scaffold** — Vite + React project, AntiGravity CSS design tokens, topbar/nav shell
3. **Auth flows** — Sign-up, login, logout, password reset screens wired to Supabase Auth

**Success criteria:**
1. `GET /health` returns `{"status":"ok"}` from FastAPI server
2. Navigating to `/login` shows the AntiGravity-branded login form
3. User can sign up with email/password and land on a blank dashboard
4. User can log out and be redirected to login
5. Password reset email is sent on "Forgot password" click
6. All UI uses Plus Jakarta Sans + brand green #059669 CSS tokens

**UI hint:** yes

---

## Phase 2 — Answer Key Manager

**Goal:** Teachers can create, view, edit, and delete named answer keys. Keys persist in Supabase. The upload sidebar shows the key list and selection state as in the UI Reference.

**Requirements:** KEY-01, KEY-02, KEY-03, KEY-04, KEY-05

**Plans:**
1. **DB schema + API** — Supabase `answer_keys` table, FastAPI CRUD endpoints (GET/POST/PUT/DELETE)
2. **Answer Key UI** — "Answer Keys" screen: list cards, create/edit modal (question grid), delete confirm

**Success criteria:**
1. Teacher can create an answer key named "Math Test 1" with 20 questions, 4 choices, entering A-D answers
2. Key appears in the upload sidebar immediately after creation
3. Teacher can edit Q3's answer from B to C and save
4. Teacher can delete a key and it's removed from the list
5. Keys persist after page refresh (stored in Supabase)

**UI hint:** yes

---

## Phase 3 — Upload & OMR Processing Engine

**Goal:** Full upload-to-grade flow works end-to-end. Teacher uploads a sheet, selects a key, the Python engine processes it, and results are stored. Animated processing screen shows real-time step progress.

**Requirements:** UPLOAD-01..06, PROC-01..06, UI-02

**Plans:**
1. **FastAPI processing endpoint** — `/api/check` accepts multipart image + key_id, calls Python engine, returns result JSON + annotated image; stores in DB
2. **Upload UI screen** — Drag-and-drop zone, file picker, camera capture, answer key sidebar, "Check sheet" button
3. **Processing screen** — Animated scan-line, step-by-step indicators (image loaded → perspective corrected → detecting bubbles → checking → done)
4. **Image storage** — Upload original + annotated result image to Supabase Storage; store URLs in DB

**Success criteria:**
1. Drag-dropping a JPG sheet shows a thumbnail preview in the upload zone
2. "Check sheet" button is disabled until both an image and an answer key are selected
3. Clicking "Check sheet" transitions to the processing screen with animated scan-line
4. Processing completes in < 5 seconds for a standard 20-Q sheet
5. Result JSON (score, grade, per-question answers, confidence) is returned from the API
6. Processing screen shows correct/wrong step states and auto-navigates to result screen

**UI hint:** yes

---

## Phase 4 — Result View

**Goal:** Result screen displays full graded breakdown: score banner, question grid, section bars, confidence score, manual override, PDF download, and "Check next" flow.

**Requirements:** RESULT-01..08

**Plans:**
1. **Result screen UI** — Score banner (grade badge, correct/wrong/skip chips), question grid (5-col, colour-coded cells), section score bars, confidence display
2. **Manual override + share** — Per-question edit modal, re-grade on save, shareable URL token
3. **PDF generation** — Server-side PDF endpoint (ReportLab): annotated sheet image + score table; download button

**Success criteria:**
1. Result screen shows "16 / 20", "A" grade badge, and 16 green / 3 red / 1 grey question cells
2. Clicking a wrong answer cell opens an override modal; saving updates the score in UI and DB
3. "Download PDF" triggers a PDF file download within 3 seconds
4. "Check next sheet" resets the upload zone keeping the same answer key selected
5. Shareable URL opens the same result for anyone with the link (no login required to view)

**UI hint:** yes

---

## Phase 5 — Analytics Dashboard & Batch Upload

**Goal:** Class analytics screen shows aggregate stats for all sheets checked against one answer key. Batch upload enables processing 2-500 sheets at once with CSV export.

**Requirements:** ANALYTICS-01..05, BATCH-01..04

**Plans:**
1. **Analytics screen** — Metrics row (avg/high/low/pass), per-question bar chart, re-teaching table; data sourced from all results for a given key
2. **Batch upload UI + API** — Folder/ZIP upload, progress indicators per sheet, background job queue (FastAPI BackgroundTasks), CSV download

**Success criteria (Analytics):**
1. After checking 5+ sheets for "Math Test 1", navigating to Analytics shows correct class average
2. Q8 shows a red bar if < 50% correct rate
3. Re-teaching table lists questions with < 50% rate sorted by difficulty
4. "Export CSV" downloads a valid CSV with all student scores

**Success criteria (Batch):**
1. User can select a ZIP of 5 sheet images; all are processed and show progress
2. Batch job completes and a CSV with 5 rows is downloadable
3. Processing a 50-sheet batch completes without timeout (uses background job)

**UI hint:** yes

---

## Phase 6 — History & Usage Tracking

**Goal:** History screen lets teachers find and re-open past results. Usage bar in upload sidebar reflects real monthly usage from DB.

**Requirements:** HIST-01..03, USAGE-01..02

**Plans:**
1. **History screen + API** — Paginated list of past checks (date, key name, score), search by date/score, click to re-open result
2. **Usage tracking** — DB counter for monthly checks, real-time display in sidebar, enforce 500/month limit with upgrade prompt

**Success criteria:**
1. After 3 checks, History shows 3 rows with correct dates and scores
2. Searching "April 2025" filters to only April results
3. Clicking a history row opens the full result view for that check
4. Sidebar usage bar shows "3 of 500 used · 1%"
5. After 500 checks, next upload attempt shows an upgrade prompt instead of processing

**UI hint:** yes

---

## Phase 7 — Polish, Mobile Responsiveness & Deployment

**Goal:** The app is production-ready, mobile-responsive, containerized, and deployed. Performance, accessibility, and error handling are production-quality.

**Requirements:** UI-03, UI-04 + all NFRs

**Plans:**
1. **Mobile responsiveness** — Media queries for upload/result/analytics screens; camera capture on mobile; sidebar collapses on small screens
2. **Error handling + loading states** — All API error states handled gracefully; skeleton loaders; toast notifications for success/failure
3. **Docker + deployment** — Dockerfile for FastAPI backend; Vite static build served via Nginx; docker-compose for local dev; deployment script

**Success criteria:**
1. Upload screen on 375px mobile shows a full-width zone with "Take photo" button
2. Result and analytics screens are readable on mobile without horizontal scroll
3. `docker-compose up` starts both backend and frontend with no manual steps
4. All API errors (network down, invalid image, bad key) show a clear user-facing message
5. Lighthouse performance score ≥ 85 on desktop

**UI hint:** yes

---

## Requirement Traceability

| Req ID | Phase |
|--------|-------|
| AUTH-01..04 | Phase 1 |
| KEY-01..05 | Phase 2 |
| UPLOAD-01..06 | Phase 3 |
| PROC-01..06 | Phase 3 |
| RESULT-01..08 | Phase 4 |
| ANALYTICS-01..05 | Phase 5 |
| BATCH-01..04 | Phase 5 |
| HIST-01..03 | Phase 6 |
| USAGE-01..02 | Phase 6 |
| UI-01..02 | Phase 1, 3 |
| UI-03..04 | Phase 7 |
