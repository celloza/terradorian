# Copilot Coding Agent Instructions — Terradorian

This document is the authoritative operating guide for AI agents in this repository. Follow it exactly. Do not improvise framework, runtime, or deployment patterns outside what is defined here.

Terradorian is a Terraform drift-detection dashboard. It ingests Terraform plan JSON, classifies create/update/delete drift, stores full plan payloads in Blob Storage with pruned metadata in Cosmos DB, and presents drift trends and operational context in a web UI.

## Core Context Routing

Always read the root `.agent/` folder before proposing architecture changes or writing code.

Required read order:
1. `.agent/workflows/onboard.md`
2. `.agent/skills/terradorian_guide.md`
3. `.agent/skills/setup_env.md`
4. `.agent/workflows/deploy-azure.md`
5. `.agent/workflows/git-commit.md`

Always read these documentation files before implementation:
1. `docs/ARCHITECTURE.md` for storage model and data flow.
2. `docs/API.md` for endpoint contracts and expected payloads.
3. `docs/SETUP.md` for local runtime assumptions.
4. `docs/AZURE_DEPLOYMENT_GUIDE.md` before changing auth, cookies, or deployment behavior.

`.agent/` contains repository-specific workflow policy: onboarding sequence, local environment bootstrapping with emulators, release/deploy automation, and commit message conventions. Treat these files as design constraints, not optional guidance.

## Architecture & Tech Stack

Terradorian is a Terraform drift-detection platform with a split web/API architecture and hybrid storage.

Primary stack:
- Frontend: TypeScript, Next.js App Router (`next` 16.1.4), React 19, Tailwind CSS v4, shadcn/ui components.
- Backend: Python 3.12 Azure Functions v2 Blueprint model (`azure-functions`), Pydantic.
- Data: Azure Cosmos DB (metadata and pruned drift records) and Azure Blob Storage (full plan JSON payloads).
- Infrastructure as Code: Bicep (`infra/`) and Terraform (`terraform/`), plus ARM template artifact.
- CI/CD: GitHub Actions release pipeline in `.github/workflows/build-release.yml`.

Cross-cutting implementation rules:
- Keep the frontend API-proxy pattern intact. The route handler forwards `/api/*` requests to `API_URL` and injects `x-internal-secret` when `INTERNAL_SECRET` is configured.
- Keep backend endpoint composition in the Azure Functions Blueprint model. Register new blueprints in `api/function_app.py`.
- Preserve Next.js standalone deployment mode. `web/next.config.ts` must retain `output: "standalone"`.
- Respect existing auth integration patterns (NextAuth + internal secret header + optional functions key fallback).

Framework guardrails:
- Always use Next.js + React for web changes. Never introduce Vue, Angular, Svelte, Remix, Astro, or a parallel frontend runtime.
- Always use Python Azure Functions for backend endpoints. Never introduce FastAPI, Flask, Django, Express, or a second API host.
- Always use existing package managers and manifests (`web/package.json`, `api/requirements.txt`). Do not add alternate build systems.

## Build & Validation Determinism

Source of truth: `.github/workflows/build-release.yml`.

Pipeline triggers:
- `release.published`
- `workflow_dispatch`

Global pipeline environment:
- `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true`

Exact CI build sequence:

API artifact job (`build-api`):
```bash
cd api
mkdir -p .python_packages/lib/site-packages
pip install -r requirements.txt --target=".python_packages/lib/site-packages" --platform manylinux2014_x86_64 --only-binary=:all: --implementation cp --python-version 3.12
rm -rf .python_packages/lib/site-packages/azure/functions
rm -rf .python_packages/lib/site-packages/azure_functions-*.dist-info
echo "${GITHUB_REF_NAME}" > version.txt
zip -r ../api.zip . -x ".venv/*" "__pycache__/*" "*.git*" "*.pyc"
```

Web artifact job (`build-web`):
```bash
cd web
npm ci
npm version --no-git-tag-version ${GITHUB_REF_NAME} || echo "Could not set npm version, continuing..."
npm run build
mkdir -p package/.next/static
mkdir -p package/public
cp -r .next/standalone/. package/
cp -r public/* package/public/
cp -r .next/static/* package/.next/static/
echo "{\"version\": \"${GITHUB_REF_NAME}\"}" > package/version.json
cd package
zip -r ../../web.zip .
```

Release job behavior:
- Downloads `api.zip` and `web.zip` artifacts.
- Uploads both artifacts to the GitHub Release via `softprops/action-gh-release@v2`.

Validation policy derived from CI:
- Treat `cd web && npm ci && npm run build` as the required deterministic frontend validation path.
- Treat API package installation command from CI as the required deterministic backend build path.
- Do not claim test success from CI. No test command exists in the pipeline.
- Do not claim lint gating from CI. No lint step exists in the pipeline.

Local prerequisites for runtime (non-CI, from repo workflows):
- Docker-based Cosmos DB emulator and Azurite are required for end-to-end local API behavior.
- Azure Functions Core Tools v4 are required for `func start`.

## Project Layout & Infrastructure Drift

Logical layout:
- `web/` is the only frontend application.
- `api/` is the only backend service.
- `infra/` is the Bicep deployment definition (networking, storage, cosmos, key vault, app insights, app service plan, function app, web app).
- `terraform/` is an alternative IaC implementation with provider pinning and environment variables.
- `tools/deploy.ps1` automates version bump, release creation, CI wait, and Azure app restarts.

IaC drift and blast-radius guardrails:
- Never hand-edit Terraform state files (`terraform.tfstate`, backups). State corruption risk is high.
- Terraform backend is currently `backend "local" {}`. Assume state is local and sensitive; do not migrate backend, rename state files, or refactor state layout unless explicitly requested.
- Avoid cross-editing Bicep and Terraform for the same change in one task unless explicitly requested. They represent parallel deployment paths and can drift.
- In Bicep, maintain module boundaries and shared identity flow. Networking outputs feed private endpoints and app subnet wiring; careless changes can sever service connectivity.
- Preserve the generated internal secret linkage between web and function app in infrastructure definitions.
- Keep provider/runtime pins stable unless a version upgrade is explicitly scoped and validated.

Deployment safety rules:
- Use `tools/deploy.ps1` for release-based deployment workflow unless the user explicitly asks for manual steps.
- Do not alter Azure resource names, environment naming conventions, or subscription/tenant targeting logic without explicit instruction.
- Do not modify local emulator connection assumptions in `api/local.settings.json` unless the task is environment reconfiguration.

## Operational Rules for Future Agents

- Trust this file first, then `.agent/`, then `docs/`.
- Prefer deterministic commands and patterns already used by CI and deployment scripts.
- Make minimal, scoped changes. Preserve existing architecture and runtime choices.
- If a request conflicts with these instructions, ask for explicit confirmation before deviating.

## Preserved Warnings, Learnings, and Gotchas

These are historical repo learnings that complement (not replace) the sections above and remain active unless explicitly superseded.

- The frontend authentication setup uses NextAuth v5 beta and a legacy cookie compatibility choice (`next-auth.session-token`) in `web/auth.ts`. Do not change cookie behavior without checking `docs/AZURE_DEPLOYMENT_GUIDE.md` and confirming deployment impact.
- Historical lint baseline in the frontend includes pre-existing issues. Do not run broad lint-cleanup refactors unless explicitly requested; focus on avoiding new lint violations in touched code.
- In ingestion workflows, stale-plan behavior is expected: uploads may be rejected when a newer plan timestamp already exists. Do not classify stale-plan responses as regressions without timestamp verification.
- If `func` is unavailable on PATH in local development, use the local Core Tools binary from `tools/node_modules/.bin/func`.
- Follow semantic commit format from `.agent/workflows/git-commit.md`: `<type>: <description>` with lowercase type/description and no trailing period.

Documentation maintenance rule:
- If you change architecture, storage flow, or service boundaries, update `docs/ARCHITECTURE.md`.
- If you add or modify API behavior, update `docs/API.md` (and `docs/SETUP.md` when setup steps change).
- If you introduce new recurring workflow constraints, update `.agent/skills/terradorian_guide.md`.
