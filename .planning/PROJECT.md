# AntiGravity OMR Check

## What This Is

AntiGravity OMR Check is an AI-powered MCQ answer-sheet grading platform built for teachers in Indian K-12 schools. A teacher photographs a bubble-sheet (OMR) answer sheet with their phone or uploads it via the web, and the system returns a grade, per-question breakdown, and class-wide analytics within 1-3 seconds. The existing Python CLI engine handles CV-based bubble detection; this milestone wraps it in a production-grade web application with the AntiGravity brand design system.

## Core Value

A teacher must be able to upload a single hand-written bubble-sheet photo and receive an accurate grade in under 5 seconds — with zero training required.

## Requirements

### Validated

- ✓ Bubble detection via OpenCV (Otsu threshold + contour analysis) — existing
- ✓ Perspective correction (scan-and-warp) — existing
- ✓ Answer checking + grading report (score, %, grade A-F) — existing
- ✓ Batch CLI processing with CSV output — existing
- ✓ Answer key JSON management (create/load) — existing

### Active

- [ ] FastAPI backend wrapping the existing Python OMR engine
- [ ] React + Vite frontend matching the AntiGravity UI Reference design system
- [ ] Upload screen: drag-and-drop + camera photo upload, answer key selection sidebar
- [ ] Processing screen: animated scan-line progress during AI processing
- [ ] Result screen: question-by-question breakdown (green/red/grey cells), grade badge, PDF/CSV download
- [ ] Class analytics dashboard: avg score, pass rate, per-question correct-rate bar chart, re-teaching table
- [ ] Answer key CRUD: create, edit, delete named answer keys (up to 50 Q, 5 choices)
- [ ] Batch upload: upload a folder of sheets, get a CSV with all results
- [ ] User authentication (email/password sign-up, login, session persistence)
- [ ] Usage tracking: monthly sheet quota display (free tier: 500 sheets/month)
- [ ] History view: past checks searchable by date or score
- [ ] PDF result download with annotated sheet image + score summary
- [ ] Confidence score shown per result (quality of detection)
- [ ] Manual override: teacher can correct detected answers per question
- [ ] Mobile-responsive design (photo upload from phone camera)

### Out of Scope

- Native mobile app (iOS/Android) — Phase 2 per PRD; web-first now
- Payment/subscription billing — hardcoded free tier for v1
- Multi-teacher classroom collaboration — single-user per account for v1
- OCR for handwritten names on sheets — PRD defers to v2
- Printing blank OMR sheets from the app — out of scope for v1
- Integration with school MIS/SIS systems — future enterprise feature

## Context

**Existing engine:** Python 3.x CLI in `src/`. Modules: `scanner.py` (perspective warp), `detector.py` (bubble detection), `checker.py` (answer comparison + grading), `utils.py` (image I/O + drawing), `batch_checker.py` (CSV batch), `main.py` (CLI entry point). Answer keys stored as JSON files (`dataset/answer_key.json` example). Supports 4-5 choice MCQ with 10-50 questions per sheet.

**Tech constraints from TRD:**
- Backend: FastAPI (Python) — keeps same language as existing engine, easy integration
- Frontend: React + Vite + Vanilla CSS (matches UI Reference design system)
- Image processing: OpenCV, NumPy (existing deps), Pillow for encoding
- Storage: Local filesystem for MVP (Supabase Storage for production uploads)
- Auth: Supabase Auth (email/password)
- DB: Supabase Postgres (users, answer keys, check history, batch jobs)
- PDF: ReportLab or WeasyPrint for server-side PDF generation
- Deployment: Docker container; frontend served as static build

**Design system (from UI Reference HTML):**
- Fonts: Plus Jakarta Sans (UI), DM Mono (data/codes)
- Brand: `#059669` (emerald green) — "green = correct answer = trust"
- Danger: `#DC2626`, Warning: `#D97706`, Info: `#1A56DB`
- 4 screens: Upload, Processing, Result, Analytics
- UX principles: Zero training, Trust through transparency, Mobile first

**Target user:** Indian school teacher, possibly low digital literacy, often using an Android phone or low-end Chrome on Windows.

## Constraints

- **Tech**: Backend must be Python (FastAPI) to re-use existing OMR engine directly — no port
- **Design**: Must precisely match AntiGravity UI Reference HTML color tokens, fonts, and component shapes
- **Performance**: Single-sheet check must complete in < 5 seconds end-to-end (including upload)
- **Compatibility**: Chrome on Windows + mobile Chrome/Safari; no IE support needed
- **MVP scope**: No real payment flow — Starter plan badge shown, 500/month hardcoded limit

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| FastAPI backend (not Django/Flask) | Async I/O, OpenAPI auto-docs, minimal boilerplate; aligns with existing Python engine | — Pending |
| React + Vite frontend | Fast HMR, lightweight; no SSR needed for this tool | — Pending |
| Supabase for Auth + DB + Storage | Handles auth, Postgres, file storage in one service; free tier sufficient for v1 | — Pending |
| Vanilla CSS (no Tailwind) | UI Reference HTML already provides the full design system in CSS variables; no need to add a framework | — Pending |
| Server-side PDF generation | Annotated result images need OpenCV on the server anyway; ReportLab keeps it Python | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-12 after initialization from PRD v1.0, TRD v1.0, UI Reference v1.0*
