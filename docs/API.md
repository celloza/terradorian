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
    *   `days` (optional, default: `7`)
        *   Positive integer number of trailing days to include.
        *   Use `all` to disable date filtering.
*   **Returns**: List of plan metadata objects (without the heavy `resource_changes` payload usually, or a lightweight version).

#### `DELETE /delete_plan/{id}`
Deletes a specific plan from Cosmos DB and removes its corresponding raw JSON payload from Azure Blob Storage.

#### `DELETE /delete_all_plans?project_id={id}`
A bulk deletion endpoint that iterates through all plans associated with a given `project_id`. It systematically removes every plan's raw JSON payload from Azure Blob Storage and deletes the record from Cosmos DB.

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

### Authentication Settings
*   `GET /settings/auth/public`: Returns non-sensitive authentication metadata for login UX.
    *   Returns fields: `auth_mode`, `client_id`, `tenant_id`, `has_client_secret`.
*   `GET /settings/auth`: Returns full authentication settings (protected).
    *   Returns fields: `auth_mode`, `client_id`, `client_secret`, `tenant_id`.
    *   Requires internal request header `x-internal-secret`.
    *   `auth_mode` values:
        *   `nextauth` (default): app-managed login (owner credentials + optional Entra provider).
        *   `easyauth`: Azure App Service EasyAuth (Microsoft Entra) is enforced by platform and middleware.
*   `POST /settings/auth`: Save authentication mode and Entra settings.
    *   Requires internal request header `x-internal-secret`.
    *   Body example:
    ```json
    {
      "auth_mode": "easyauth",
      "client_id": "00000000-0000-0000-0000-000000000000",
      "client_secret": "<optional-in-easyauth>",
      "tenant_id": "00000000-0000-0000-0000-000000000000"
    }
    ```

