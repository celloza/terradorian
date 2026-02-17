import azure.functions as func
import json
import uuid
import secrets
import hashlib
from datetime import datetime
from azure.cosmos import exceptions
from pydantic import ValidationError
from models import CreateProjectSchema, CreateComponentSchema, UpdateProjectSettingsSchema, UpdateComponentSchema
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
            query="SELECT c.id, c.name, c.description, c.created_at, c.environments, c.notifications FROM c",
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
    
    try:
        container = get_container("plans", "/id")
        
        query = "SELECT c.id, c.project_id, c.component_name, c.component_id, c.environment, c.timestamp, c.terraform_version, c.providers, c.cloud_platform, c.dependencies, c.resource_graph, {'resource_changes': c.terraform_plan.resource_changes} AS terraform_plan FROM c"
        where_clauses = []
        parameters = []
        
        if project_id:
            where_clauses.append("c.project_id = @pid")
            parameters.append({"name": "@pid", "value": project_id})
            
        if environment:
            where_clauses.append("c.environment = @env")
            parameters.append({"name": "@env", "value": environment})

        if component_id:
            where_clauses.append("c.component_id = @cid")
            parameters.append({"name": "@cid", "value": component_id})
            
        if where_clauses:
            query += " WHERE " + " AND ".join(where_clauses)
            
        query += " ORDER BY c.timestamp DESC OFFSET 0 LIMIT 100"
            
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
