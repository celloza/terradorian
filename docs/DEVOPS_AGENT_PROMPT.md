You are an expert DevOps engineer tasked with configuring an Azure DevOps pipeline to communicate with the Terradorian Ingestion API.

## Context
We need to upload Terraform Plans (JSON format) to our Terradorian Dashboard.
The API Endpoint is hosted on an Azure Function App which requires **Application Authentication (PAT)**.

## Mandatory Inputs
Your configuration **MUST** handle these 4 values. If any are missing, the API will reject the request (401).

| Value | Variable Name | Why it is REQUIRED |
| :--- | :--- | :--- |
| **API URL** | `API_URL` | The Function App endpoint (`https://.../api/manual_ingest`). |
| **PAT** | `FUNCTION_KEY` | **Security**. A Personal Access Token generated from the Terradorian Dashboard. Passed in `Authorization` header. |
| **Component ID** | `COMPONENT_ID` | **Routing**. Identifies which component in the dashboard owns this plan. |
| **Environment** | `ENVIRONMENT` | **Data Organization**. Defines if this plan is for `dev`, `stage`, or `prod`. |

## Task
Create a pipeline step (Bash or PowerShell) that:
1.  Converts the Terraform binary plan to JSON.
2.  Constructs the payload with **all required fields**.
3.  Posts to the API with the **Authentication Header**.

## Body Schema
```json
{
  "component_id": "<COMPONENT_ID>",
  "environment": "<ENVIRONMENT>",
  "terraform_plan": <raw-json-object-from-terraform-show>
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
  --arg cid "$COMPONENT_ID" \
  --arg env "$ENVIRONMENT" \
  --slurpfile plan plan_output.json \
  '{component_id: $cid, environment: $env, terraform_plan: $plan[0]}' > payload.json

# 3. Upload
# Note: "Bearer" prefix is standard for PATs
curl -X POST "$API_URL/api/manual_ingest" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $FUNCTION_KEY" \
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
    component_id = $env:COMPONENT_ID
    environment = $env:ENVIRONMENT
    terraform_plan = $planJson
} | ConvertTo-Json -Depth 100

# 4. Upload
$headers = @{
    "Authorization" = "Bearer $env:FUNCTION_KEY"
}

Invoke-RestMethod -Uri "$env:API_URL/api/manual_ingest" -Method Post -Headers $headers -Body $payload -ContentType "application/json"
```

Use this information to configure the pipeline task.
