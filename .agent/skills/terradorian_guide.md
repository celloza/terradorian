---
name: terradorian_guide
description: A guide for developing and maintaining the Terradorian dashboard project. Contains context on architecture, testing, and common tasks.
---

# Terradorian Development Guide

Use this skill to understand the specific conventions, architecture, and workflows of the Terradorian project.

## Project Structure
- `web/`: Next.js frontend (UI).
- `api/`: Azure Functions backend (Python).
- `docs/`: Project documentation.
- `manual_tests/`: Scratchpad scripts for verifying backend logic (`reproduce_500.py`, etc.).
- `samples/`: Sample Terraform plan JSONs for testing.

## Key Architectual Patterns
- **Hybrid Storage**: Terraform plans are split. Full JSON goes to Azure Blob Storage; Metadata & Pruned changes go to Azure Cosmos DB.
- **Stale Plan Check**: The backend rejects uploads if a newer plan already exists (based on plan timestamp).
- **Auto Resource Group Extraction**: The backend extracts `resource_group_name` from `resource_changes` during ingestion to help the UI grouping.

## Common Tasks

### 1. Running the Stack
Ensure Docker is running (Cosmos DB + Azurite).
```bash
# Terminal 1: Frontend
cd web
npm run dev

# Terminal 2: Backend
cd api
.\.venv\Scripts\activate
func start
```

### 2. Testing Ingestion
Use the UI or a script in `manual_tests/` to upload a plan from `samples/`.
**Important**: If you get a "Stale Plan" error, you are likely uploading the same file again. You must edit the `timestamp` in the JSON or use a fresh plan.

### 3. Debugging 500 Errors
If ingestion fails with 500/RemoteDisconnected:
- Check if the Cosmos DB emulator is running.
- Ensure the payload isn't too large for the *pruned* record (the fix was to strip `before`/`after` states).
- Use `manual_tests/reproduce_500.py` to isolate the backend call.

### 4. Database Access
- Cosmos DB keys found in `api/local.settings.json` (or defaults for emulator).
- Use `api/shared/db.py` for connecting in scripts.

## Known Issues / TODOs
- `delete_plan` does not yet delete the corresponding blob from Blob Storage.
- `ingest_plan` (verified ingest) is currently less mature than `manual_ingest`.

## Maintenance
**CRITICAL**: When modifying the source code, you MUST update the corresponding documentation:
1.  **Architecture Changes**: Update `docs/ARCHITECTURE.md` if you change data flow, storage logic, or key components.
2.  **New Endpoints/Features**: Update `docs/API.md` and `docs/SETUP.md`.
3.  **This Guide**: If you change project structure or introduce new patterns, update this file (`.agent/skills/terradorian_guide.md`) so future agents are aware of the changes.
