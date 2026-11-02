# FSKTM Postgraduate Management System

A web-based system for postgraduate administration, appointments, and project evaluation for coursework programmes at the Faculty of Computer Science and Information Technology (FSKTM), Universiti Malaya.

The portal brings student records, supervisor and panel appointments, project marks, official letters, documents, announcements, and frequently asked questions into one place. Students, lecturers, programme coordinators, and Postgraduate Office staff use role-specific workspaces backed by shared records and approval workflows.

This README covers the combined team project, including modules developed by different team members. Individual module ownership remains separate, while the modules work together as one system.

## Users and Roles

| Role | Main responsibilities |
| --- | --- |
| Student | View personal academic information and deadlines, apply for a supervisor, track requests and appointments, upload required documents, request and download letters, read announcements, and ask the FAQ chatbot. |
| Lecturer | Review supervisor requests and panel nominations, manage assigned supervision and panel work, nominate eligible academic team members, enter project evaluation marks, and access authorised files and appointment letters. |
| Programme Coordinator | Review and approve supervisor and panel requests, monitor records and required documents within assigned programmes, and act under authorised temporary programme cover. |
| Office Staff/Admin | Maintain registry records and staff accounts, manage semesters, timelines, capacity and evaluation configuration, monitor workflows and marks, issue letters, review documents, publish announcements, and maintain FAQ content. |

A Technical Administrator uses Django Admin for technical administration. This account is separate from Office Staff/Admin and cannot sign in to the portal.

## System Modules

| Module | What it provides |
| --- | --- |
| **Dashboard and Academic Timeline** | Role-specific summaries and actions, semester calendars, appointment intake periods, evaluation deadlines, and Office timeline import/export and deadline extensions. |
| **Registry and Account Management** | Student academic records, spreadsheet imports and invitations, staff accounts, activation and sign-in management, lecturer duties, and programme coordinator assignments. |
| **Supervisor Appointments** | Student applications with supporting documents, lecturer review and coordinator approval, primary and supporting supervisor appointments, workload/capacity checks, research changes, and appointment replacement or closure. |
| **Panel Appointments** | Supervisor nominations, selected panel-member acceptance or rejection, coordinator approval, assigned panel records, workload monitoring, and replacement or closure. |
| **Marks and Project Evaluation** | Evaluation periods and rubrics, tasks linked to eligible appointments, lecturer drafts and submissions, completion monitoring, and authorised Office corrections or reopening with recorded reasons. |
| **Workflow and Approval Tracking** | Request progress, current approval responsibility, elapsed waiting days, decision reasons, immutable workflow and lifecycle audits, reconciliation, progress dossiers, and authorised reports/exports. |
| **Letter Management** | Office-managed templates and recipient lists, student letter requests, approval and numbered PDF issuance, bilingual wording, appointment letters, and revocation or reissue. |
| **File Repository and Document Management** | Permission-controlled uploads and downloads, previews, versions, document checks and returns, sharing, tags, archives, and required-document tracking and reminders. |
| **Announcements and Notifications** | Audience-targeted announcements, scheduled publication and expiry, attachments, in-app workflow notices and read status, deadline reminders, and optional email alerts and weekly summaries. |
| **FAQ and Chatbot** | Office-maintained questions and answers, keyword and multilingual meaning search, suggested matches, reference-document passages, feedback, and unanswered-question review. |
| **Profile and Settings** | Personal account information, contact updates, password changes, and notification preferences. |

Academic participant lifecycle management supports student deferral, withdrawal and graduation, and lecturer retirement, with eligibility checks carried through appointments and evaluation tasks. Coordinator delegation and semester capacity policies support continuity of administrative work.

## How the Modules Work Together

1. **Prepare records and rules.** The Office maintains student/staff records, assigns responsibilities, and configures semesters, capacity, intake periods, document requirements, evaluation periods, and rubrics.
2. **Appoint a supervisor.** An eligible student submits a supervisor application. The lecturer reviews it, and the Programme Coordinator gives the final decision. Approval establishes the appointment and research profile used by subsequent workflows.
3. **Appoint a panel member.** The student's supervisor nominates an eligible lecturer. The selected lecturer reviews the nomination before coordinator approval creates the panel appointment.
4. **Evaluate the project.** The Office generates evaluation tasks for eligible appointments. Assigned lecturers save drafts and submit marks; authorised Office staff monitor completion and handle reasoned corrections or reopening.
5. **Issue letters and maintain documents.** Students request official letters for Office review. Approved appointments can produce appointment letters when a usable template is available; incomplete letters wait for Office completion. The File Repository handles supporting files, versions, and required-document checks.
6. **Keep participants informed.** Dashboards expose relevant actions and deadlines, while announcements and notifications communicate updates. The FAQ chatbot helps users find published guidance or relevant reference passages.

Access depends on role, programme, record ownership, and actual academic relationships. Backend permissions enforce these boundaries, including the information students may see about appointment processing.

The system supports postgraduate administrative and project workflows. Course registration/enrolment transactions, credit accumulation, course scheduling, and general coursework results are outside its scope; the Registry stores the academic information these administrative workflows need.

## Technology Stack

| Layer | Technologies |
| --- | --- |
| Frontend | React 19, TypeScript, Vite, React Router, Tailwind CSS, Lucide icons, Motion |
| Backend | Django 5.2 LTS, Django REST Framework, SimpleJWT |
| Database | PostgreSQL |
| Documents and exports | ReportLab, openpyxl, ExcelJS, PDFium, Pillow |
| FAQ search | Keyword search and a multilingual model through FastEmbed, with keyword-only fallback |
| Deployment | Frontend production build and Django API behind a same-origin Nginx reverse proxy |

Authentication uses short-lived access tokens held in frontend memory and rotating refresh tokens in HttpOnly cookies.

## Project Layout

```text
.
|-- frontend/
|   `-- src/          # Portal components, routing, API services, and shared utilities
|-- backend/
|   |-- accounts/      # Authentication, registry, staff, lifecycle, and delegation
|   |-- academics/     # Semesters, operational periods, and capacity policies
|   |-- appointments/  # Supervisor/panel workflows and research records
|   |-- dashboard/     # Timelines, monitoring, reports, and progress
|   |-- marks/         # Evaluation configuration, tasks, submissions, and audits
|   |-- letters/       # Templates, requests, issued PDFs, and appointment letters
|   |-- documents/     # File repository, checks, sharing, and versions
|   |-- announcements/ # Announcements, notifications, and reminders
|   |-- faq/           # Knowledge base, chatbot search, and reference documents
|   `-- config/        # Django settings and API routing
|-- deploy/          # Deployment configuration and guidance
|-- scripts/         # Operational helpers and FAQ source parsing
|-- docs/            # Setup guides, academic references, specifications, and plans
|-- PROJECT_REQUIREMENTS.md
|-- ARCHITECTURE_AND_CODING_DESIGN.md
`-- PROJECT_STATUS.md
```

## Local Development

### Prerequisites

- Python 3.12 or newer
- Node.js 22.22.0 or newer and npm (see `frontend/package.json`)
- PostgreSQL 16 or newer, running locally with an empty project database

The commands below use PowerShell and start from the repository root. Use two terminals to run the backend and frontend.

### 1. Configure and start the backend

```powershell
Set-Location backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade "pip>=26.2,<27"
python -m pip install -r requirements.txt
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

Edit the ignored `backend/.env` before continuing. Set a generated `DJANGO_SECRET_KEY` and the PostgreSQL connection values (`PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, and `PGDATABASE`). Create the database named by `PGDATABASE` in PostgreSQL if it does not already exist. Keep `DJANGO_DEBUG=True` for local development.

```powershell
python manage.py migrate
python manage.py check
python manage.py runserver 8000
```

Django serves APIs under `http://localhost:8000/api/`; `http://localhost:8000/api/health/` provides a health check. Protected APIs require authentication.

### 2. Configure and start the frontend

In a second terminal, from the repository root:

```powershell
Set-Location frontend
npm ci
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

For development against the complete backend, set these values in the ignored `frontend/.env`:

```ini
VITE_API_BASE_URL="/api"
VITE_USE_MOCKS="false"
VITE_USE_REGISTRY_BACKEND="true"
```

```powershell
npm run dev
```

Open `http://localhost:3000` (or the port Vite reports if 3000 is occupied). Vite proxies `/api` to `http://localhost:8000`. If Django uses another port, set `API_PORT` in the frontend terminal before starting Vite. Keep `FRONTEND_URL` and `CORS_ALLOWED_ORIGINS` in `backend/.env` consistent with the frontend address.

Dashboard/Timeline, Supervisor Appointments, Panel Appointments, Marks, and Workflow Tracking always use Django. Some other services retain development mock fallbacks; setting `VITE_USE_MOCKS=false` disables those fallbacks when checking the integrated system.

### 3. Optional local demo data

To populate fictional accounts and appointment fixtures, set `ENABLE_DEMO_ACCOUNTS=True` and all four `DEMO_*_PASSWORD` variables in the ignored `backend/.env`, then run from `backend/` with its virtual environment active:

```powershell
python manage.py seed_users
```

For a fresh local database, additional starter content is available:

```powershell
python manage.py seed_letters
python manage.py import_faq
```

`seed_letters` updates templates matched by name, so use it on a fresh demo database before customising templates. The FAQ importer preserves existing Office edits on reruns. FAQ content imported as Needs checking must be reviewed before publication.

For development-only login prefills, create the ignored `frontend/.env.development.local` using the demo variables in `frontend/.env.example`. Enable the flag and fill in the same per-role passwords used by the backend. Production builds remove the demo console. Never commit credentials or place production secrets in `VITE_` variables.

To create a separate Technical Administrator for Django Admin, run `python manage.py createsuperuser`. This does not create a portal Office account.

## Verification

From `backend/`, with its virtual environment active and PostgreSQL configured:

```powershell
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py test
```

Django tests require permission to create a separate test database. FAQ tests use a fake encoder by default and do not download the search model.

From `frontend/`:

```powershell
npm run lint
npm run build
npm run test:production-security
```

`lint` runs TypeScript checks. Focused frontend checks live alongside source files in `frontend/src/`, and browser suites live in `frontend/tests/`; consult the relevant reports in `docs/` and [PROJECT_STATUS.md](PROJECT_STATUS.md) for commands, coverage, and known limitations.

## Operations and Deployment

- The first use of FAQ meaning search downloads its model into the ignored `backend/faq_model_cache/`. If unavailable, keyword search remains available. `python manage.py rebuild_faq_index` prepares search vectors ahead of use.
- Scheduled announcements, deadline reminders, weekly summaries, and FAQ question retention use Django management commands. Configure a host scheduler for unattended operation; see [backend operational commands](backend/README.md#scheduled-commands).
- Local email links print in the Django console when SMTP credentials are blank. Configure email delivery for activation links, password resets, and optional email notifications outside local development.
- Follow the [Nginx deployment guide](deploy/nginx/README.md) for production configuration, static assets, HTTPS, and Content Security Policy. Local development setup does not establish production readiness.

## Further Documentation

- [Five-module testing: start here](docs/FIVE_MODULE_TESTING_START_HERE.md) — sequential manual testing, prepared local accounts, expected results, and the full case list.
- [Project Requirements](PROJECT_REQUIREMENTS.md) — detailed scope, features, and business rules.
- [Architecture and Coding Design](ARCHITECTURE_AND_CODING_DESIGN.md) — system structure, permissions, data models, and implementation conventions.
- [Project Status](PROJECT_STATUS.md) — completed work, verification evidence, known issues, and next steps.
- [Database Setup](docs/DATABASE_SETUP.md) — PostgreSQL configuration, demo accounts, and troubleshooting; use the Node.js minimum above for the current frontend.
- [Backend Reference](backend/README.md) — API details and management commands.
- [Functional Requirements](docs/Functional%20Requirements.pdf) and [Use Case Description](docs/Use%20Case%20Description.pdf) — academic reference documents. Their older scope wording and confirmation-letter content await updates from editable source files; consult the maintained Markdown documents for current implementation details.
