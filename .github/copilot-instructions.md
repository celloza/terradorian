# Copilot Coding Agent Instructions — Terradorian

## Project Summary

Terradorian is a Terraform drift-detection dashboard. It ingests Terraform plan JSON files, detects create/update/delete changes, stores them with a hybrid Cosmos DB + Blob Storage approach, and displays drift trends in a web UI. There are no automated tests in this repo.

## Tech Stack

| Layer | Technology | Path |
|-------|-----------|------|
| Frontend | Next.js 16 (App Router), React 19, Tailwind CSS v4, shadcn/ui (new-york style) | `web/` |
| Backend | Azure Functions Python v2 (Blueprint model), Pydantic | `api/` |
| Database | Azure Cosmos DB (NoSQL) | via `api/shared/db.py` |
| Blob Storage | Azure Blob Storage | via `api/shared/storage.py` |
| Infrastructure | Bicep (`infra/`), Terraform (`terraform/`), ARM template (`infra/azuredeploy.json`) | `infra/`, `terraform/` |
| CI/CD | GitHub Actions (`.github/workflows/build-release.yml`) | triggered on release publish |
| Deployment | `tools/deploy.ps1` (PowerShell), deploys via GitHub Release + Azure restart |

**Runtimes**: Node.js 20+, Python 3.12, Azure Functions Core Tools v4.

## Build & Validation Commands

### Frontend (`web/`)

Always run commands from the `web/` directory.

```bash
cd web
npm ci          # Install deps — always use npm ci (not npm install) for reproducible builds
npm run build   # Next.js production build (standalone output)
npm run lint    # ESLint — runs "eslint" via flat config (eslint.config.mjs)
npm run dev     # Dev server on http://localhost:3000
```

**Critical notes**:
- Always run `npm ci` before `npm run build` or `npm run lint`.
- `npm run lint` currently exits with code 1 due to **179 pre-existing lint issues** (104 errors, 75 warnings). The dominant error types are `@typescript-eslint/no-explicit-any` and `@typescript-eslint/no-unused-vars`. Do NOT attempt to fix these pre-existing errors unless explicitly asked. Do NOT introduce new lint errors.
- `npm run build` succeeds independently of lint. The build is the primary validation for frontend changes.
- The `next.config.ts` sets `output: "standalone"` — this is required for Azure deployment. Do not remove it.

### Backend (`api/`)

Always run commands from the `api/` directory. The backend requires a Python virtual environment.

```bash
cd api
python -m venv .venv
.venv/Scripts/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
func start                    # Starts Azure Functions on http://localhost:7071
```

**Critical notes**:
- Always activate the `.venv` before running Python or `func start`.
- If `func` is not on PATH, use `../tools/node_modules/.bin/func start` (Azure Functions Core Tools installed locally in `tools/`).
- There is no Python linter or formatter configured. Validate changes by verifying imports: `python -c "from function_app import app"` (from `api/` with venv active).
- The backend requires Docker containers running (Cosmos DB emulator + Azurite) for `func start` to serve requests successfully. Without them, the backend starts but API calls will fail.

### No Automated Tests

This repo has **no test suites** (no pytest, no Jest, no Vitest). The `manual_tests/` directory contains ad-hoc developer scripts, not runnable tests. Do not attempt to run them as tests.

**Validation strategy**: After making changes, validate by:
1. `cd web && npm run build` — must succeed for frontend changes.
2. `cd api && .venv/Scripts/python -c "from function_app import app"` — must succeed for backend changes.
3. `cd web && npm run lint` — check that no NEW errors are introduced (the baseline is 179 problems).

## Repository Layout

```
├── api/                        # Azure Functions Python backend
│   ├── function_app.py         # Entry point — registers all Blueprints
│   ├── models.py               # Pydantic schemas for all API request bodies
│   ├── requirements.txt        # Python dependencies
│   ├── host.json               # Azure Functions host config
│   ├── local.settings.json     # Local dev settings (Cosmos emulator connection, CORS)
│   ├── blueprints/             # Azure Function Blueprints (route handlers)
│   │   ├── ingest.py           # Plan ingestion (manual_ingest, ingest_plan)
│   │   ├── web_api.py          # CRUD for projects, components, plans, PATs
│   │   ├── settings_api.py     # Project settings & auth config
│   │   ├── health.py           # Health check endpoint
│   │   ├── reporting.py        # Scheduled email reports (timer trigger)
│   │   └── slack_report.py     # Slack webhook reporting
│   └── shared/                 # Shared utilities
│       ├── db.py               # Cosmos DB client (get_container helper)
│       ├── storage.py          # Blob Storage client (upload/delete plan blobs)
│       ├── auth.py             # PAT verification logic
│       └── notifications.py    # Notification helpers
├── web/                        # Next.js 16 frontend
│   ├── app/                    # App Router pages
│   │   ├── layout.tsx          # Root layout (imports providers, Toaster)
│   │   ├── page.tsx            # Home page
│   │   ├── providers.tsx       # SessionProvider (NextAuth) + SWR
│   │   ├── login/              # Login page
│   │   ├── projects/           # Projects list page
│   │   ├── p/[id]/             # Project detail pages (dashboard, explore, graph, overview, settings)
│   │   ├── admin/settings/     # Admin settings page
│   │   └── api/[...proxy]/     # API proxy route — forwards /api/* to backend Function App
│   ├── components/             # React components (dashboard, modals, charts, sidebar)
│   │   └── ui/                 # shadcn/ui primitives (button, dialog, card, etc.)
│   ├── lib/
│   │   ├── api.ts              # Frontend API client (all fetch calls + SWR URL getters)
│   │   └── utils.ts            # cn() utility for Tailwind class merging
│   ├── auth.ts                 # NextAuth v5 config (Credentials + Entra ID providers)
│   ├── middleware.ts           # Auth middleware (JWT token verification, route protection)
│   ├── next.config.ts          # Next.js config (standalone output)
│   ├── eslint.config.mjs       # ESLint flat config (next/core-web-vitals + typescript)
│   ├── postcss.config.mjs      # PostCSS config (Tailwind CSS v4)
│   ├── components.json         # shadcn/ui config (path aliases: @/components, @/lib, @/hooks)
│   └── tsconfig.json           # TypeScript config (path alias: @/* → ./*)
├── infra/                      # Azure Bicep & ARM infrastructure
│   ├── main.bicep              # Root Bicep template
│   └── modules/                # Bicep modules (cosmos, function, webapp, keyvault, etc.)
├── terraform/                  # Terraform IaC (alternative to Bicep)
├── tools/
│   ├── deploy.ps1              # Automated deploy script (version bump, release, restart)
│   ├── deploy.config.json      # Deploy config (Azure subscription, resource group, app names)
│   └── package.json            # Local Azure Functions Core Tools (npm)
├── docs/                       # Documentation (SETUP, ARCHITECTURE, API, CONTRIBUTING, etc.)
├── samples/                    # Sample Terraform plan JSONs for testing ingestion
├── manual_tests/               # Ad-hoc developer scripts (NOT runnable test suites)
└── .github/workflows/
    └── build-release.yml       # CI: builds api.zip + web.zip on release, uploads as release assets
```

## Architecture Essentials

- **API proxy**: The frontend routes all `/api/*` requests through `web/app/api/[...proxy]/route.ts`, which forwards them to the backend Function App URL (configured via `API_URL` env var, default `http://localhost:7071/api`). The proxy injects an `x-internal-secret` header for auth.
- **Hybrid storage**: Full plan JSON → Blob Storage; pruned metadata → Cosmos DB. See `api/blueprints/ingest.py`.
- **Blueprints**: Each API area is a separate Blueprint registered in `function_app.py`. To add a new endpoint, create or edit a file in `api/blueprints/` and register it in `function_app.py`.
- **UI components**: Built with shadcn/ui. Add new primitives via `npx shadcn@latest add <component>` from the `web/` directory. Existing primitives are in `web/components/ui/`.
- **Path alias**: `@/*` maps to the `web/` root in TypeScript (e.g., `@/components/sidebar` → `web/components/sidebar.tsx`).

## CI/CD Pipeline

The GitHub Actions workflow (`.github/workflows/build-release.yml`) triggers on `release: published` events:
1. **build-api**: Installs Python 3.12 deps into `.python_packages/`, creates `api.zip`.
2. **build-web**: Runs `npm ci` → `npm run build` → packages standalone output into `web.zip`.
3. **release**: Attaches `api.zip` and `web.zip` to the GitHub Release.

The workflow does NOT run lint or tests. The primary CI validation is that `npm run build` and `pip install` succeed.

## Commit Convention

All commits must follow: `<type>: <description>` (lowercase, no period).
Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`.

## Key Warnings

- Do NOT remove `output: "standalone"` from `web/next.config.ts` — required for Azure deployment.
- Do NOT modify `api/local.settings.json` connection strings unless asked — they contain emulator defaults.
- The frontend uses `next-auth` v5 beta with a forced legacy cookie name (`next-auth.session-token`) in `web/auth.ts`. Do not change cookie configuration without understanding the implications (documented in `docs/AZURE_DEPLOYMENT_GUIDE.md`).
- When adding new API endpoints, always register the Blueprint in `api/function_app.py`.

## Trust These Instructions

These instructions are validated and accurate. Only search the codebase if information here is incomplete or found to be in error during execution.
