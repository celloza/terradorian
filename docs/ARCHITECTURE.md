# Architecture Overview

Terradorian is a dashboard for visualizing and managing Terraform plans and drift detection. It uses a **Hybrid Storage** approach to handle large Terraform plans efficiently while keeping the dashboard responsive.

## High-Level Architecture

*   **Frontend**: Next.js 14 (App Router), React, Tailwind CSS, Shadcn UI.
    *   Hosted in `web/`.
*   **Backend**: Azure Functions (Python v2 model).
    *   Hosted in `api/`.
    *   Uses `azure-functions`, `azure-cosmos`, and `azure-storage-blob`.
*   **Database**: Azure Cosmos DB (NoSQL API).
    *   Stores Project/Component metadata.
    *   Stores **pruned** Terraform plans (metadata + lightweight resource changes).
*   **Blob Storage**: Azure Blob Storage.
    *   Stores the **full, unpruned** Terraform plan JSONs.
    *   Used for archival and deep inspection if needed.

## Key Concepts

### Hybrid Plan Storage
To avoid Cosmos DB document size limits (2MB) and connection issues with the emulator:
1.  **Ingestion**: When a plan is uploaded (via `manual_ingest`):
    *   The **Full JSON** is uploaded to Blob Storage: `plans/{project_id}/{component_id}/{environment}/{plan_id}.json`.
    *   A **Pruned Record** is created for Cosmos DB.
2.  **Pruning Logic**:
    *   The `resource_changes` array is stripped of the heavy `before` and `after` states (except for specific fields like `resource_group_name`).
    *   Only `address`, `type`, `name`, `change.actions`, and `resource_group` are kept in the DB.
    *   The DB record includes a `blob_url` pointing to the full file.

### Data Model (Cosmos DB)

*   **`projects` container**: Stores project definitions (ID, name, environments).
*   **`components` container**: Stores component definitions (ID, project_id, name).
*   **`plans` container**: Stores the pruned plan records.
    *   Partition Key: `/id` (currently, might be optimized to `/component_id` in future).

### Drift Detection
*   Drift is calculated by analyzing the `change.actions` in the most recent plan.
*   "Drift Over Time" is visualized using a line chart of historical plans.
