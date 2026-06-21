# AntiGravity OMR Check — Requirements v1.0

## v1 Requirements

### UPLOAD — Sheet Upload Flow
- [ ] **UPLOAD-01**: User can drag-and-drop a JPG/PNG/HEIC image onto the upload zone
- [ ] **UPLOAD-02**: User can click "Browse files" to open a file picker and select an image
- [ ] **UPLOAD-03**: User can take a photo with their phone camera and upload it directly (mobile `<input capture>`)
- [ ] **UPLOAD-04**: System validates that the uploaded file is a supported image format and under 20 MB
- [ ] **UPLOAD-05**: User can see a list of their saved answer keys in the upload sidebar and select one
- [ ] **UPLOAD-06**: User can initiate checking via a single "Check sheet" action after selecting image + key

### KEY — Answer Key Management
- [ ] **KEY-01**: User can create a new named answer key specifying number of questions (10-50) and choices per question (4 or 5)
- [ ] **KEY-02**: User can enter correct answers (A/B/C/D[/E]) per question in the key editor
- [ ] **KEY-03**: User can save the answer key and it persists across sessions
- [ ] **KEY-04**: User can edit an existing answer key
- [ ] **KEY-05**: User can delete an answer key

### PROC — Processing Engine
- [ ] **PROC-01**: System calls the Python OMR engine to process the uploaded image via FastAPI
- [ ] **PROC-02**: System performs perspective correction on the uploaded sheet image
- [ ] **PROC-03**: System detects and reads filled answer bubbles from the corrected image
- [ ] **PROC-04**: System checks detected answers against selected answer key
- [ ] **PROC-05**: System computes confidence score (ratio of detected bubbles to expected bubbles)
- [ ] **PROC-06**: System completes single-sheet processing in under 5 seconds end-to-end

### RESULT — Result Display
- [ ] **RESULT-01**: User sees score (correct / total), percentage, and grade badge (A+/A/B/C/D/F)
- [ ] **RESULT-02**: User sees a question grid where each cell shows the student's answer and is colour-coded (green=correct, red=wrong, grey=skipped)
- [ ] **RESULT-03**: User sees section-by-section score breakdown bars (if answer key has sections defined)
- [ ] **RESULT-04**: User sees confidence score and whether detection was high/medium/low quality
- [ ] **RESULT-05**: User can manually override the detected answer for any question
- [ ] **RESULT-06**: User can download the result as a PDF (annotated sheet image + score summary)
- [ ] **RESULT-07**: User can navigate to "Check next sheet" maintaining the same answer key
- [ ] **RESULT-08**: User can share result via a shareable link

### ANALYTICS — Class Analytics
- [ ] **ANALYTICS-01**: User can view class analytics after checking multiple sheets for the same answer key (exam)
- [ ] **ANALYTICS-02**: Analytics shows class average, highest score, lowest score, and pass rate
- [ ] **ANALYTICS-03**: Analytics shows a per-question correct-rate bar chart (visually distinguishing easy/medium/hard questions)
- [ ] **ANALYTICS-04**: Analytics highlights questions below 50% correct rate as needing re-teaching
- [ ] **ANALYTICS-05**: User can export all results for one exam as a CSV file

### BATCH — Batch Upload
- [ ] **BATCH-01**: User can upload a folder/ZIP of up to 500 sheet images at once
- [ ] **BATCH-02**: System processes all sheets in the batch against the selected answer key
- [ ] **BATCH-03**: User sees per-sheet processing progress during batch job
- [ ] **BATCH-04**: User can download a CSV of all batch results (student index, score, grade, per-question answers)

### AUTH — Authentication
- [ ] **AUTH-01**: User can sign up with email and password
- [ ] **AUTH-02**: User can log in and remain logged in across browser sessions
- [ ] **AUTH-03**: User can log out from any page
- [ ] **AUTH-04**: User can reset password via email link

### HIST — History
- [ ] **HIST-01**: User can view a history list of their past sheet checks (date, answer key name, score)
- [ ] **HIST-02**: User can search history by date range or score range
- [ ] **HIST-03**: User can re-open any past result to view its full breakdown

### USAGE — Usage Tracking
- [ ] **USAGE-01**: User can see their monthly sheet usage (sheets used / 500 limit) in the upload sidebar
- [ ] **USAGE-02**: System prevents checking when monthly limit is reached and shows upgrade prompt

### UI — Interface Quality
- [ ] **UI-01**: All screens match the AntiGravity design system (Plus Jakarta Sans, DM Mono, brand green #059669)
- [ ] **UI-02**: Upload → Processing → Result flow is animated and smooth (scan-line animation, step indicators)
- [ ] **UI-03**: Application is mobile-responsive (teachers can use it on phone Chrome/Safari)
- [ ] **UI-04**: Application works on desktop Chrome on Windows without plugins

---

## v2 Requirements (Deferred)

- Native iOS/Android app for classroom photo-capture
- OCR for student name on bubble sheet
- Multi-teacher school accounts + admin dashboard
- Printing blank OMR sheets from within app
- School MIS/SIS integration (export to Digi-Locker, etc.)
- AI question difficulty tagging across semesters
- Payment/subscription billing (Razorpay)

---

## Out of Scope

- Native mobile app — v2 priority; web camera upload covers v1 mobile use-case
- Handwritten answer parsing (free-form text answers) — requires different ML model
- Multiple correct answers per question — v1 supports single-answer MCQ only
- Internet Explorer supportability — not required
- Real payment processing — free tier only in v1 (no billing in MVP)
- Multi-language UI (Hindi etc.) — English-only for v1

---

## Traceability

| Phase | Requirements |
|-------|-------------|
| Phase 1 — Project Scaffold | AUTH-01..04, UI-01, UI-04 |
| Phase 2 — Answer Key Manager | KEY-01..05 |
| Phase 3 — Upload & Processing Engine | UPLOAD-01..06, PROC-01..06, UI-02 |
| Phase 4 — Result View | RESULT-01..08 |
| Phase 5 — Analytics & Batch | ANALYTICS-01..05, BATCH-01..04 |
| Phase 6 — History & Usage | HIST-01..03, USAGE-01..02 |
| Phase 7 — Polish & Deployment | UI-03, UI-04, all performance/quality NFRs |
