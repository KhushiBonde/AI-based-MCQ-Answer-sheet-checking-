<!-- GSD:project-start source:PROJECT.md -->
## Project

**AntiGravity OMR Check**

AntiGravity OMR Check is an AI-powered MCQ answer-sheet grading platform built for teachers in Indian K-12 schools. A teacher photographs a bubble-sheet (OMR) answer sheet with their phone or uploads it via the web, and the system returns a grade, per-question breakdown, and class-wide analytics within 1-3 seconds. The existing Python CLI engine handles CV-based bubble detection; this milestone wraps it in a production-grade web application with the AntiGravity brand design system.

**Core Value:** A teacher must be able to upload a single hand-written bubble-sheet photo and receive an accurate grade in under 5 seconds — with zero training required.

### Constraints

- **Tech**: Backend must be Python (FastAPI) to re-use existing OMR engine directly — no port
- **Design**: Must precisely match AntiGravity UI Reference HTML color tokens, fonts, and component shapes
- **Performance**: Single-sheet check must complete in < 5 seconds end-to-end (including upload)
- **Compatibility**: Chrome on Windows + mobile Chrome/Safari; no IE support needed
- **MVP scope**: No real payment flow — Starter plan badge shown, 500/month hardcoded limit
<!-- GSD:project-end -->

<!-- GSD:stack-start source:STACK.md -->
## Technology Stack

Technology stack not yet documented. Will populate after codebase mapping or first phase.
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
