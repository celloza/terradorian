import azure.functions as func
import json
import uuid
import secrets
import hashlib
from datetime import datetime
from azure.cosmos import exceptions
from pydantic import ValidationError
from models import CreateProjectSchema, CreateComponentSchema, UpdateProjectSettingsSchema, UpdateComponentSchema, ApproveIngestionSchema, RejectIngestionSchema
from shared.db import get_container

bp = func.Blueprint()

@bp.route(route="create_project", auth_level=func.AuthLevel.ANONYMOUS, methods=["POST"])
def create_project(req: func.HttpRequest) -> func.HttpResponse:
    try:
        req_body = req.get_json()
        project_data = CreateProjectSchema(**req_body)
    except (ValueError, ValidationError) as e:
        return func.HttpResponse(f"Invalid Request: {e}", status_code=400)

    doc_dict = project_data.model_dump()
    doc_dict['id'] = str(uuid.uuid4())
    doc_dict['created_at'] = datetime.utcnow().isoformat()
    if not doc_dict.get('environments'):
        doc_dict['environments'] = ["dev"]
    if not doc_dict.get('default_branch'):
        doc_dict['default_branch'] = "develop"
    
    try:
        container = get_container("projects", "/id")
        container.create_item(doc_dict)
    except Exception as e:
        return func.HttpResponse(f"Error creating project: {e}", status_code=500)

    return func.HttpResponse(
        body=json.dumps({"id": doc_dict['id'], "name": doc_dict['name']}),
        status_code=201,
        mimetype="application/json"
    )

@bp.route(route="add_environment", auth_level=func.AuthLevel.ANONYMOUS, methods=["POST"])
def add_environment(req: func.HttpRequest) -> func.HttpResponse:
    try:
        req_body = req.get_json()
        project_id = req_body.get('project_id')
        environment = req_body.get('environment')
        if not project_id or not environment:
            return func.HttpResponse("Missing project_id or environment", status_code=400)
    except ValueError:
        return func.HttpResponse("Invalid JSON", status_code=400)

    try:
        container = get_container("projects", "/id")
        project_doc = container.read_item(item=project_id, partition_key=project_id)
        
        current_envs = project_doc.get('environments', [])
        if environment not in current_envs:
            current_envs.append(environment)
            project_doc['environments'] = current_envs
            container.upsert_item(project_doc)
            
        return func.HttpResponse(
            body=json.dumps({"environments": current_envs}),
            status_code=200,
            mimetype="application/json"
        )
    except exceptions.CosmosResourceNotFoundError:
        return func.HttpResponse("Project not found", status_code=404)
    except Exception as e:
        return func.HttpResponse(f"Error: {e}", status_code=500)

@bp.route(route="create_component", auth_level=func.AuthLevel.ANONYMOUS, methods=["POST"])
def create_component(req: func.HttpRequest) -> func.HttpResponse:
    try:
        req_body = req.get_json()
        comp_data = CreateComponentSchema(**req_body)
    except (ValueError, ValidationError) as e:
        return func.HttpResponse(f"Invalid Request: {e}", status_code=400)

    doc_dict = comp_data.model_dump()
    doc_dict['id'] = str(uuid.uuid4())
    doc_dict['created_at'] = datetime.utcnow().isoformat()
    doc_dict['pat_hashes'] = []
    if not doc_dict.get('excluded_environments'):
        doc_dict['excluded_environments'] = []
    
    try:
        container = get_container("components", "/id")
        container.create_item(doc_dict)
    except Exception as e:
        return func.HttpResponse(f"Error creating component: {e}", status_code=500)

    return func.HttpResponse(
        body=json.dumps({"id": doc_dict['id'], "name": doc_dict['name']}),
        status_code=201,
        mimetype="application/json"
    )

@bp.route(route="generate_pat", auth_level=func.AuthLevel.ANONYMOUS, methods=["POST"])
def generate_pat(req: func.HttpRequest) -> func.HttpResponse:
    try:
        req_body = req.get_json()
        project_id = req_body.get('project_id')
    except ValueError:
        return func.HttpResponse("Invalid JSON", status_code=400)

    if not project_id:
        return func.HttpResponse("project_id required", status_code=400)

    # Generate Token
    random_part = secrets.token_hex(16)
    pat = f"tdp_{project_id}_{random_part}"
    pat_hash = hashlib.sha256(pat.encode()).hexdigest()
    
    try:
        container = get_container("projects", "/id")
        # Upsert logic to append hash
        proj_doc = container.read_item(item=project_id, partition_key=project_id)
        
        # Legacy support (optional, but let's just use new tokens list)
        if 'tokens' not in proj_doc:
            proj_doc['tokens'] = []
        
        new_token = {
            "id": str(uuid.uuid4()),
            "hash": pat_hash,
            "prefix": pat[:10] + "...",
            "created_at": datetime.utcnow().isoformat()
        }
            
        proj_doc['tokens'].append(new_token)
        container.upsert_item(proj_doc)
        
    except exceptions.CosmosResourceNotFoundError:
        return func.HttpResponse("Project not found", status_code=404)
    except Exception as e:
        return func.HttpResponse(f"Error: {e}", status_code=500)

    # Return raw PAT once
    return func.HttpResponse(
        body=json.dumps({"pat": pat, "message": "Store this token securely. It will not be shown again."}),
        status_code=201,
        mimetype="application/json"
    )
    
@bp.route(route="list_projects", auth_level=func.AuthLevel.ANONYMOUS, methods=["GET"])
def list_projects(req: func.HttpRequest) -> func.HttpResponse:
    try:
        container = get_container("projects", "/id")
        items = list(container.query_items(
            query="SELECT c.id, c.name, c.description, c.created_at, c.environments, c.notifications, c.environments_config, c.default_branch FROM c",
            enable_cross_partition_query=True
        ))
        
        return func.HttpResponse(
            body=json.dumps(items),
            status_code=200,
            mimetype="application/json"
        )
    except Exception as e:
        return func.HttpResponse(f"Error: {e}", status_code=500)

@bp.route(route="list_components", auth_level=func.AuthLevel.ANONYMOUS, methods=["GET"])
def list_components(req: func.HttpRequest) -> func.HttpResponse:
    project_id = req.params.get('project_id')
    if not project_id:
        return func.HttpResponse("project_id param required", status_code=400)
        
    try:
        container = get_container("components", "/id")
        items = list(container.query_items(
            query="SELECT c.id, c.name, c.project_id, c.excluded_environments FROM c WHERE c.project_id = @pid",
            parameters=[{"name": "@pid", "value": project_id}],
            enable_cross_partition_query=True
        ))
        
        return func.HttpResponse(
            body=json.dumps(items),
            status_code=200,
            mimetype="application/json"
        )
    except Exception as e:
        return func.HttpResponse(f"Error: {e}", status_code=500)

@bp.route(route="update_component", auth_level=func.AuthLevel.ANONYMOUS, methods=["POST"])
def update_component(req: func.HttpRequest) -> func.HttpResponse:
    try:
        req_body = req.get_json()
        comp_data = UpdateComponentSchema(**req_body)
    except (ValueError, ValidationError) as e:
        return func.HttpResponse(f"Invalid Request: {e}", status_code=400)

    try:
        container = get_container("components", "/id")
        comp_doc = container.read_item(item=comp_data.component_id, partition_key=comp_data.component_id)
        
        if comp_data.excluded_environments is not None:
            comp_doc['excluded_environments'] = comp_data.excluded_environments

        if comp_data.name:
            comp_doc['name'] = comp_data.name

        container.upsert_item(comp_doc)
        
        return func.HttpResponse(
            body=json.dumps(comp_doc),
            status_code=200,
            mimetype="application/json"
        )
    except exceptions.CosmosResourceNotFoundError:
        return func.HttpResponse("Component not found", status_code=404)
    except Exception as e:
        return func.HttpResponse(f"Error: {e}", status_code=500)
    
@bp.route(route="list_plans", auth_level=func.AuthLevel.ANONYMOUS, methods=["GET"])
def list_plans(req: func.HttpRequest) -> func.HttpResponse:
    project_id = req.params.get('project_id')
    component_id = req.params.get('component_id')
    environment = req.params.get('environment')
    branch = req.params.get('branch')
    
    try:
        container = get_container("plans", "/id")
        
        select_fields = "c.id, c.project_id, c.component_name, c.component_id, c.environment, c.branch, c.timestamp, c.terraform_version, c.providers, c.cloud_platform, c.dependencies, c.resource_graph, {'resource_changes': c.terraform_plan.resource_changes} AS terraform_plan"

        # If filtering to a single component, simple query with limit
        if component_id:
            where_clauses = ["c.component_id = @cid", "(NOT IS_DEFINED(c.is_pending_approval) OR c.is_pending_approval = false)"]
            parameters = [{"name": "@cid", "value": component_id}]
            if project_id:
                where_clauses.append("c.project_id = @pid")
                parameters.append({"name": "@pid", "value": project_id})
            if environment:
                where_clauses.append("c.environment = @env")
                parameters.append({"name": "@env", "value": environment})
            if branch:
                where_clauses.append("c.branch = @branch")
                parameters.append({"name": "@branch", "value": branch})

            query = f"SELECT {select_fields} FROM c WHERE {' AND '.join(where_clauses)} ORDER BY c.timestamp DESC OFFSET 0 LIMIT 50"
            items = list(container.query_items(query=query, parameters=parameters, enable_cross_partition_query=True))
            return func.HttpResponse(body=json.dumps(items), status_code=200, mimetype="application/json")

        # Otherwise, find distinct components then fetch latest 50 per component
        comp_where = ["(NOT IS_DEFINED(c.is_pending_approval) OR c.is_pending_approval = false)"]
        comp_params = []
        if project_id:
            comp_where.append("c.project_id = @pid")
            comp_params.append({"name": "@pid", "value": project_id})
        if environment:
            comp_where.append("c.environment = @env")
            comp_params.append({"name": "@env", "value": environment})
        if branch:
            comp_where.append("c.branch = @branch")
            comp_params.append({"name": "@branch", "value": branch})

        comp_query = f"SELECT DISTINCT VALUE c.component_id FROM c WHERE {' AND '.join(comp_where)}"
        component_ids = list(container.query_items(query=comp_query, parameters=comp_params, enable_cross_partition_query=True))

        all_items = []
        for cid in component_ids:
            if not cid:
                continue
            per_comp_where = comp_where + ["c.component_id = @cid"]
            per_comp_params = comp_params + [{"name": "@cid", "value": cid}]
            per_comp_query = f"SELECT {select_fields} FROM c WHERE {' AND '.join(per_comp_where)} ORDER BY c.timestamp DESC OFFSET 0 LIMIT 50"
            items = list(container.query_items(query=per_comp_query, parameters=per_comp_params, enable_cross_partition_query=True))
            all_items.extend(items)

        # Sort combined results newest first
        all_items.sort(key=lambda x: x.get('timestamp', ''), reverse=True)
        
        return func.HttpResponse(
            body=json.dumps(all_items),
            status_code=200,
            mimetype="application/json"
        )
    except Exception as e:
        return func.HttpResponse(f"Error: {e}", status_code=500)

@bp.route(route="get_plan", auth_level=func.AuthLevel.ANONYMOUS, methods=["GET"])
def get_plan(req: func.HttpRequest) -> func.HttpResponse:
    plan_id = req.params.get('plan_id')
    if not plan_id:
        return func.HttpResponse("plan_id param required", status_code=400)
    
    try:
        container = get_container("plans", "/id")
        item = container.read_item(item=plan_id, partition_key=plan_id)
        
        return func.HttpResponse(
            body=json.dumps(item),
            status_code=200,
            mimetype="application/json"
        )
    except exceptions.CosmosResourceNotFoundError:
        return func.HttpResponse("Plan not found", status_code=404)
    except Exception as e:
        return func.HttpResponse(f"Error: {e}", status_code=500)

@bp.route(route="list_tokens", auth_level=func.AuthLevel.ANONYMOUS, methods=["GET"])
def list_tokens(req: func.HttpRequest) -> func.HttpResponse:
    project_id = req.params.get('project_id')
    if not project_id:
        return func.HttpResponse("project_id param required", status_code=400)
        
    try:
        container = get_container("projects")
        proj_doc = container.read_item(item=project_id, partition_key=project_id)
        
        tokens = proj_doc.get("tokens", [])
        # Return only safe metadata
        safe_tokens = [
            {"id": t["id"], "prefix": t.get("prefix", "???"), "created_at": t.get("created_at")} 
            for t in tokens
        ]
        
        return func.HttpResponse(
            body=json.dumps(safe_tokens),
            status_code=200,
            mimetype="application/json"
        )
    except exceptions.CosmosResourceNotFoundError:
        return func.HttpResponse("Project not found", status_code=404)
    except Exception as e:
        return func.HttpResponse(f"Error: {e}", status_code=500)

@bp.route(route="revoke_token", auth_level=func.AuthLevel.ANONYMOUS, methods=["POST"])
def revoke_token(req: func.HttpRequest) -> func.HttpResponse:
    try:
        req_body = req.get_json()
        project_id = req_body.get('project_id')
        token_id = req_body.get('token_id')
    except ValueError:
        return func.HttpResponse("Invalid JSON", status_code=400)

    if not project_id or not token_id:
        return func.HttpResponse("project_id and token_id required", status_code=400)

    try:
        container = get_container("projects")
        proj_doc = container.read_item(item=project_id, partition_key=project_id)
        
        tokens = proj_doc.get("tokens", [])
        new_tokens = [t for t in tokens if t["id"] != token_id]
        
        if len(new_tokens) == len(tokens):
            return func.HttpResponse("Token not found", status_code=404)

        proj_doc['tokens'] = new_tokens
        container.upsert_item(proj_doc)
        
        return func.HttpResponse(status_code=204)
        
    except exceptions.CosmosResourceNotFoundError:
        return func.HttpResponse("Project not found", status_code=404)
    except Exception as e:
        return func.HttpResponse(f"Error: {e}", status_code=500)

@bp.route(route="delete_component", auth_level=func.AuthLevel.ANONYMOUS, methods=["DELETE"])
def delete_component(req: func.HttpRequest) -> func.HttpResponse:
    try:
        req_body = req.get_json()
        component_id = req_body.get('component_id')
        project_id = req_body.get('project_id')
    except ValueError:
        return func.HttpResponse("Invalid JSON", status_code=400)

    if not component_id or not project_id:
        return func.HttpResponse("component_id and project_id required", status_code=400)

    try:
        # 1. Delete Component
        comp_container = get_container("components", "/id")
        try:
            comp_container.delete_item(item=component_id, partition_key=component_id)
        except exceptions.CosmosResourceNotFoundError:
            return func.HttpResponse("Component not found", status_code=404)

        # 2. Cascade Delete Plans
        # Note: In a real prod system, this might be done via a background job or stored procedure for atomicity
        plans_container = get_container("plans", "/id")
        plans = list(plans_container.query_items(
            query="SELECT c.id FROM c WHERE c.component_id = @cid",
            parameters=[{"name": "@cid", "value": component_id}],
            enable_cross_partition_query=True
        ))
        
        for plan in plans:
            try:
                plans_container.delete_item(item=plan['id'], partition_key=plan['id'])
            except exceptions.CosmosResourceNotFoundError:
                continue

        return func.HttpResponse(status_code=204)

    except Exception as e:
        return func.HttpResponse(f"Error: {e}", status_code=500)


@bp.route(route="delete_environment", auth_level=func.AuthLevel.ANONYMOUS, methods=["DELETE"])
def delete_environment(req: func.HttpRequest) -> func.HttpResponse:
    try:
        req_body = req.get_json()
        project_id = req_body.get('project_id')
        environment = req_body.get('environment')
    except ValueError:
        return func.HttpResponse("Invalid JSON", status_code=400)

    if not project_id or not environment:
        return func.HttpResponse("project_id and environment required", status_code=400)

    try:
        # 1. Update Project Environments List
        proj_container = get_container("projects", "/id")
        project_doc = proj_container.read_item(item=project_id, partition_key=project_id)
        
        current_envs = project_doc.get('environments', [])
        
        if len(current_envs) <= 1:
            return func.HttpResponse("Cannot delete the last remaining environment in a project.", status_code=400)
            
        if environment in current_envs:
            new_envs = [e for e in current_envs if e != environment]
            project_doc['environments'] = new_envs
            proj_container.upsert_item(project_doc)
        else:
            return func.HttpResponse("Environment not found in project", status_code=404)

        # 2. Cascade Delete Plans
        plans_container = get_container("plans", "/id")
        plans = list(plans_container.query_items(
            query="SELECT c.id FROM c WHERE c.project_id = @pid AND c.environment = @env",
            parameters=[
                {"name": "@pid", "value": project_id},
                {"name": "@env", "value": environment}
            ],
            enable_cross_partition_query=True
        ))
        
        for plan in plans:
            try:
                plans_container.delete_item(item=plan['id'], partition_key=plan['id'])
            except exceptions.CosmosResourceNotFoundError:
                continue

        return func.HttpResponse(status_code=204)

    except exceptions.CosmosResourceNotFoundError:
        return func.HttpResponse("Project not found", status_code=404)
    except Exception as e:
        return func.HttpResponse(f"Error: {e}", status_code=500)

@bp.route(route="delete_branch_plans", auth_level=func.AuthLevel.ANONYMOUS, methods=["DELETE"])
def delete_branch_plans(req: func.HttpRequest) -> func.HttpResponse:
    """Delete all plans for a specific branch within a project."""
    import logging
    from shared.storage import delete_plan_blob

    try:
        req_body = req.get_json()
        project_id = req_body.get('project_id')
        branch = req_body.get('branch')
    except ValueError:
        return func.HttpResponse("Invalid JSON", status_code=400)

    if not project_id or not branch:
        return func.HttpResponse("project_id and branch required", status_code=400)

    try:
        plans_container = get_container("plans", "/id")
        plans = list(plans_container.query_items(
            query="SELECT c.id, c.blob_url FROM c WHERE c.project_id = @pid AND c.branch = @branch",
            parameters=[
                {"name": "@pid", "value": project_id},
                {"name": "@branch", "value": branch}
            ],
            enable_cross_partition_query=True
        ))

        deleted_count = 0
        for plan in plans:
            blob_url = plan.get("blob_url")
            if blob_url:
                delete_plan_blob(blob_url)
            try:
                plans_container.delete_item(item=plan['id'], partition_key=plan['id'])
                deleted_count += 1
            except exceptions.CosmosResourceNotFoundError:
                continue

        return func.HttpResponse(
            body=json.dumps({"message": f"Deleted {deleted_count} plans for branch '{branch}'.", "deleted_count": deleted_count}),
            status_code=200,
            mimetype="application/json"
        )

    except Exception as e:
        logging.error(f"Error deleting branch plans: {e}")
        return func.HttpResponse(f"Error: {e}", status_code=500)

@bp.route(route="test_slack_notification", auth_level=func.AuthLevel.ANONYMOUS, methods=["POST"])
def test_slack_notification(req: func.HttpRequest) -> func.HttpResponse:
    """Send a test message to the configured Slack webhook."""
    import logging
    from shared.notifications import send_slack_test

    try:
        req_body = req.get_json()
        project_id = req_body.get('project_id')
        webhook_url = req_body.get('webhook_url')
    except ValueError:
        return func.HttpResponse("Invalid JSON", status_code=400)

    if not project_id or not webhook_url:
        return func.HttpResponse("project_id and webhook_url required", status_code=400)

    try:
        proj_container = get_container("projects", "/id")
        project_doc = proj_container.read_item(item=project_id, partition_key=project_id)
        project_name = project_doc.get('name', 'Unknown Project')

        success = send_slack_test(webhook_url, project_name)
        if success:
            return func.HttpResponse(
                body=json.dumps({"message": "Test notification sent successfully"}),
                status_code=200,
                mimetype="application/json"
            )
        else:
            return func.HttpResponse("Failed to send test notification. Check the webhook URL.", status_code=400)

    except exceptions.CosmosResourceNotFoundError:
        return func.HttpResponse("Project not found", status_code=404)
    except Exception as e:
        logging.error(f"Test slack notification error: {e}")
        return func.HttpResponse(f"Error: {e}", status_code=500)

@bp.route(route="update_project_settings", auth_level=func.AuthLevel.ANONYMOUS, methods=["POST"])
def update_project_settings(req: func.HttpRequest) -> func.HttpResponse:
    try:
        req_body = req.get_json()
        settings_data = UpdateProjectSettingsSchema(**req_body)
    except (ValueError, ValidationError) as e:
        return func.HttpResponse(f"Invalid Request: {e}", status_code=400)

    try:
        container = get_container("projects")
        # Read existing project
        project_doc = container.read_item(item=settings_data.project_id, partition_key=settings_data.project_id)
        
        # Update Fields
        if settings_data.description is not None:
            project_doc['description'] = settings_data.description

        if settings_data.environments is not None:
            project_doc['environments'] = settings_data.environments

        if settings_data.notifications:
            # We dump the notifications model to dict. 
            # Note: This replaces the entire notifications object. Partial updates would require deeper merging logic.
            # For settings pages, usually we save the whole state, so replacement is fine.
            project_doc['notifications'] = settings_data.notifications.model_dump()

        if settings_data.environments_config is not None:
            project_doc['environments_config'] = settings_data.environments_config

        if settings_data.default_branch is not None:
            project_doc['default_branch'] = settings_data.default_branch

        container.upsert_item(project_doc)
        
        return func.HttpResponse(
            body=json.dumps({"message": "Settings updated", "notifications": project_doc.get('notifications')}),
            status_code=200,
            mimetype="application/json"
        )
        
    except exceptions.CosmosResourceNotFoundError:
        return func.HttpResponse("Project not found", status_code=404)
    except Exception as e:
        return func.HttpResponse(f"Error: {e}", status_code=500)

@bp.route(route="list_pending_ingestions", auth_level=func.AuthLevel.ANONYMOUS, methods=["GET"])
def list_pending_ingestions(req: func.HttpRequest) -> func.HttpResponse:
    project_id = req.params.get('project_id')
    if not project_id:
        return func.HttpResponse("project_id param required", status_code=400)
        
    try:
        container = get_container("plans", "/id")
        
        query = "SELECT c.id, c.project_id, c.component_name, c.environment, c.branch, c.timestamp FROM c WHERE c.project_id = @pid AND c.is_pending_approval = true ORDER BY c.timestamp DESC"
        parameters = [{"name": "@pid", "value": project_id}]
            
        items = list(container.query_items(
            query=query,
            parameters=parameters,
            enable_cross_partition_query=True
        ))
        
        return func.HttpResponse(
            body=json.dumps(items),
            status_code=200,
            mimetype="application/json"
        )
    except Exception as e:
        return func.HttpResponse(f"Error: {e}", status_code=500)

@bp.route(route="approve_ingestion", auth_level=func.AuthLevel.ANONYMOUS, methods=["POST"])
def approve_ingestion(req: func.HttpRequest) -> func.HttpResponse:
    try:
        req_body = req.get_json()
        data = ApproveIngestionSchema(**req_body)
    except (ValueError, ValidationError) as e:
        return func.HttpResponse(f"Invalid Request: {e}", status_code=400)
        
    try:
        plans_container = get_container("plans", "/id")
        plan_doc = plans_container.read_item(item=data.plan_id, partition_key=data.plan_id)
        
        if not plan_doc.get("is_pending_approval"):
            return func.HttpResponse("Plan is not pending approval", status_code=400)
            
        project_id = plan_doc.get("project_id")
        proj_container = get_container("projects", "/id")
        proj_doc = proj_container.read_item(item=project_id, partition_key=project_id)
        
        # 1. Update Environment if missing
        env = plan_doc.get("environment")
        if env and env not in proj_doc.get("environments", []):
            envs = proj_doc.get("environments", [])
            envs.append(env)
            proj_doc["environments"] = envs
            proj_container.upsert_item(proj_doc)
            
        # 2. Update Component if missing
        comp_name = plan_doc.get("component_name")
        comp_container = get_container("components", "/id")
        
        query = "SELECT * FROM c WHERE c.project_id = @pid AND c.name = @name"
        parameters = [
            {"name": "@pid", "value": project_id},
            {"name": "@name", "value": comp_name}
        ]
        results = list(comp_container.query_items(query=query, parameters=parameters, enable_cross_partition_query=True))
        
        if results:
            comp_doc = results[0]
            plan_doc["component_id"] = comp_doc["id"]
        else:
            new_comp_id = str(uuid.uuid4())
            new_comp = {
                "id": new_comp_id,
                "project_id": project_id,
                "name": comp_name,
                "excluded_environments": []
            }
            comp_container.upsert_item(new_comp)
            plan_doc["component_id"] = new_comp_id
            
        # 3. Mark plan as approved
        plan_doc["is_pending_approval"] = False
        plans_container.upsert_item(plan_doc)
        
        return func.HttpResponse(
            body=json.dumps({"message": "Approved successfully"}),
            status_code=200,
            mimetype="application/json"
        )
    except exceptions.CosmosResourceNotFoundError:
        return func.HttpResponse("Resource not found", status_code=404)
    except Exception as e:
        return func.HttpResponse(f"Error: {e}", status_code=500)

@bp.route(route="reject_ingestion", auth_level=func.AuthLevel.ANONYMOUS, methods=["POST"])
def reject_ingestion(req: func.HttpRequest) -> func.HttpResponse:
    try:
        req_body = req.get_json()
        data = RejectIngestionSchema(**req_body)
    except (ValueError, ValidationError) as e:
        return func.HttpResponse(f"Invalid Request: {e}", status_code=400)
        
    try:
        plans_container = get_container("plans", "/id")
        plans_container.delete_item(item=data.plan_id, partition_key=data.plan_id)
        
        return func.HttpResponse(
            body=json.dumps({"message": "Rejected successfully"}),
            status_code=200,
            mimetype="application/json"
        )
    except exceptions.CosmosResourceNotFoundError:
        return func.HttpResponse("Plan not found", status_code=404)
    except Exception as e:
        return func.HttpResponse(f"Error: {e}", status_code=500)


@bp.route(route="export_plans", auth_level=func.AuthLevel.ANONYMOUS, methods=["GET"])
def export_plans(req: func.HttpRequest) -> func.HttpResponse:
    """
    Downloads a ZIP file containing the latest full terraform plan JSON
    for each component in the specified environment(s) and branch.
    Query params: project_id (required), environment (required, comma-separated), branch (optional).
    """
    import zipfile
    import io
    import logging
    from shared.storage import download_plan_blob

    project_id = req.params.get('project_id')
    environment_param = req.params.get('environment')
    branch = req.params.get('branch')

    if not project_id or not environment_param:
        return func.HttpResponse("project_id and environment params required", status_code=400)

    environments = [e.strip() for e in environment_param.split(',') if e.strip()]

    try:
        container = get_container("plans", "/id")

        # Build query: latest plan per component for given environment(s) + branch
        where_clauses = [
            "c.project_id = @pid",
            "(NOT IS_DEFINED(c.is_pending_approval) OR c.is_pending_approval = false)"
        ]
        parameters = [{"name": "@pid", "value": project_id}]

        if len(environments) == 1:
            where_clauses.append("c.environment = @env")
            parameters.append({"name": "@env", "value": environments[0]})
        else:
            env_placeholders = []
            for i, env in enumerate(environments):
                param_name = f"@env{i}"
                env_placeholders.append(param_name)
                parameters.append({"name": param_name, "value": env})
            where_clauses.append(f"c.environment IN ({', '.join(env_placeholders)})")

        if branch:
            where_clauses.append("c.branch = @branch")
            parameters.append({"name": "@branch", "value": branch})

        query = f"SELECT c.id, c.component_id, c.component_name, c.environment, c.timestamp, c.blob_url, c.resource_graph FROM c WHERE {' AND '.join(where_clauses)} ORDER BY c.timestamp DESC"

        items = list(container.query_items(
            query=query,
            parameters=parameters,
            enable_cross_partition_query=True
        ))

        # Pick latest plan per component+environment
        latest = {}
        for item in items:
            key = f"{item.get('component_id', '')}-{item.get('environment', '')}"
            if key not in latest:
                latest[key] = item

        if not latest:
            return func.HttpResponse("No plans found for the given filters", status_code=404)

        # Build ZIP in memory
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
            for plan in latest.values():
                blob_url = plan.get('blob_url')
                comp_name = plan.get('component_name') or plan.get('component_id') or 'unknown'
                env = plan.get('environment') or 'unknown'
                # Sanitize filename
                safe_name = "".join(c if c.isalnum() or c in ('-', '_') else '_' for c in comp_name)
                safe_env = "".join(c if c.isalnum() or c in ('-', '_') else '_' for c in env)
                filename = f"{safe_name}_{safe_env}.json"

                if blob_url:
                    blob_data = download_plan_blob(blob_url)
                    if blob_data:
                        zf.writestr(filename, blob_data)
                    else:
                        logging.warning(f"Blob not found for plan {plan['id']}, skipping")
                else:
                    logging.warning(f"No blob_url for plan {plan['id']}, skipping")

                # Generate .dot graph file from resource_graph
                graph = plan.get('resource_graph')
                if graph and graph.get('nodes'):
                    dot_lines = [f'digraph "{comp_name} ({env})" {{', '  rankdir = "LR";']
                    # Group nodes by type for subgraph clustering
                    groups: dict[str, list] = {}
                    for node in graph['nodes']:
                        g = node.get('group') or node.get('type') or 'other'
                        groups.setdefault(g, []).append(node)
                    for idx, (group_name, nodes) in enumerate(sorted(groups.items())):
                        dot_lines.append(f'  subgraph "cluster_{idx}" {{')
                        dot_lines.append(f'    label = "{group_name}";')
                        for node in nodes:
                            node_id = node['id'].replace('"', '\\"')
                            label = node.get('label', node['id']).replace('"', '\\"')
                            dot_lines.append(f'    "{node_id}" [label="{label}"];')
                        dot_lines.append('  }')
                    # Deduplicate edges
                    seen_edges: set[tuple[str, str]] = set()
                    for edge in graph.get('edges', []):
                        pair = (edge['source'], edge['target'])
                        if pair not in seen_edges:
                            seen_edges.add(pair)
                            src = edge['source'].replace('"', '\\"')
                            tgt = edge['target'].replace('"', '\\"')
                            dot_lines.append(f'  "{src}" -> "{tgt}";')
                    dot_lines.append('}')
                    zf.writestr(f"{safe_name}_{safe_env}.dot", '\n'.join(dot_lines))

        zip_bytes = zip_buffer.getvalue()

        return func.HttpResponse(
            body=zip_bytes,
            status_code=200,
            mimetype="application/zip",
            headers={
                "Content-Disposition": f"attachment; filename=terraform-plans-export.zip"
            }
        )

    except Exception as e:
        logging.error(f"Export plans error: {e}")
        return func.HttpResponse(f"Error: {e}", status_code=500)
