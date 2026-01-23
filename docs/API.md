# API Reference

The backend uses **Azure Functions Blueprints**.

## Base URL
Local: `http://localhost:7071/api`

## Endpoints

### Ingestion

#### `POST /manual_ingest`
Manually ingests a Terraform plan JSON.

*   **Body**:
    ```json
    {
      "component_id": "uuid",
      "environment": "dev",
      "terraform_plan": { ... } // Full JSON content
    }
    ```
*   **Behavior**:
    1.  Validates payload.
    2.  Checks for **Stale Plans** (rejects if `timestamp` <= latest existing plan).
    3.  Uploads full JSON to **Blob Storage**.
    4.  Prunes JSON (strips `before`/`after` states, extracting `resource_group`).
    5.  Saves pruned record to **Cosmos DB**.

### Plans

#### `GET /list_plans`
Lists plans for a project or component.

*   **Query Params**:
    *   `project_id` (optional)
    *   `component_id` (optional)
    *   `env` (optional)
*   **Returns**: List of plan metadata objects (without the heavy `resource_changes` payload usually, or a lightweight version).

#### `DELETE /delete_plan/{id}`
Deletes a specific plan from Cosmos DB (Note: Currently does not delete from Blob Storage - TODO).

### Project Management

*   `POST /create_project`: Create a new project.
*   `POST /create_component`: Create a new component.
*   `GET /list_projects`: List all projects.
*   `GET /list_components?project_id={id}`: List components for a project.

### Environment Management
*   `POST /add_environment`: Add a new environment (e.g., 'staging') to a project.
    *   Body: `{ "project_id": "...", "environment": "staging" }`

### Authentication (PATs)
*   `POST /generate_pat`: Generate a new Personal Access Token for a component.
    *   Body: `{ "project_id": "..." }`
    *   Returns: `{ "pat": "tdp_..." }` (One-time view).
*   `GET /list_tokens?project_id={id}`: List active PATs (metadata only).
*   `POST /revoke_token`: Revoke a PAT.
    *   Body: `{ "project_id": "...", "token_id": "..." }`

