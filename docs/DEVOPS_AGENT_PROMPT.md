You are an expert DevOps engineer tasked with configuring an Azure DevOps pipeline to communicate with the Terradorian Ingestion API.

## Context
We need to upload Terraform Plans (JSON format) to our Terradorian Dashboard.
The API Endpoint is hosted on an Azure Function App which requires **Application Authentication (PAT)**.

## Mandatory Inputs
Your configuration **MUST** handle these 4 values. If any are missing, the API will reject the request (401).

| Value | Variable Name | Why it is REQUIRED |
| :--- | :--- | :--- |
| **API URL** | `API_URL` | The Function App endpoint (`https://.../api/manual_ingest`). |
| **PAT** | `PROJECT_PAT` | **Security**. A Personal Access Token generated from the Terradorian Dashboard. Passed in `Authorization` header. |
| **Component Name** | `COMPONENT_NAME` | **Routing**. Human-readable name of the component (e.g. "frontend"). |
| **Environment** | `ENVIRONMENT` | **Data Organization**. Defines if this plan is for `dev`, `stage`, or `prod`. |

## Task
## Task
Create a pipeline step (Bash or PowerShell) that:
1.  **Extract Plan JSON**: Convert your Terraform plan binary to JSON.
2.  **Authenticate**: Use a **Bearer Token** (User PAT).
3.  **Identify Component**: Provide the `component_name` (e.g. "frontend-app") or `component_id`.
4.  **Upload**: POST the JSON to the `manual_ingest` endpoint.
## Body Schema
```json
{
{
  "component_name": "<COMPONENT_NAME>",
  "environment": "<ENVIRONMENT>",
  "terraform_plan": <raw-json-object-from-terraform-show>
}
}
```

## Example Script (Bash)
```bash
#!/bin/bash
set -e

# 1. Convert Plan
terraform show -json tf.plan > plan_output.json

# 2. Construct Payload (using jq to safely insert json)
jq -n \
  --arg cname "$COMPONENT_NAME" \
  --arg env "$ENVIRONMENT" \
  --slurpfile plan plan_output.json \
  '{component_name: $cname, environment: $env, terraform_plan: $plan[0]}' > payload.json

# 3. Upload
# Note: "Bearer" prefix is standard for PATs
curl -X POST "$API_URL/api/manual_ingest" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $PROJECT_PAT" \
  -d @payload.json \
  --fail
```

## Example Script (PowerShell)
```powershell
# 1. Convert Plan
terraform show -json tf.plan | Out-File -Encoding UTF8 plan_output.json

# 2. Read Content
$planJson = Get-Content -Raw -Path plan_output.json | ConvertFrom-Json

# 3. Construct Payload
$payload = @{
    "component_name" = $env:COMPONENT_NAME
    "environment" = $env:ENVIRONMENT
    "terraform_plan" = $planJson
} | ConvertTo-Json -Depth 100

# 4. Upload
$headers = @{
    "Authorization" = "Bearer $env:PROJECT_PAT"
}

Invoke-RestMethod -Uri "$env:API_URL/api/manual_ingest" -Method Post -Headers $headers -Body $payload -ContentType "application/json"
```

Use this information to configure the pipeline task.
