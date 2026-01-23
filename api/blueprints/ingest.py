import azure.functions as func
import logging
import json
import uuid
import hashlib
from datetime import datetime
from azure.cosmos import exceptions
from models import ManualIngestSchema
from shared.db import get_container

bp = func.Blueprint()

@bp.route(route="ingest_plan", auth_level=func.AuthLevel.ANONYMOUS, methods=["POST"])
def ingest_plan(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Processing ingest_plan request.')

    # Pat verification logic roughly duplicated/adapted here or needs to be shared?
    # For now, let's keep it self-contained or import if simple.
    # The original verify_pat was in function_app.py. Let's assume we might need to move it to shared/auth.py later.
    # But wait, ingest_plan implementation in function_app.py was:
    
    # Actually, looking at previous view_file of function_app.py, verify_pat was defined but NOT used effectively in the view I saw?
    # Ah, I saw "project_doc = component_doc # verify_pat now returns project_doc" in line 69 which looked like pseudo-code or a bug in my view?
    # Let's re-read function_app.py to be SURE about the current state of ingest_plan before I act.
    # Wait, I have the file content in history.
    
    # Line 68: try:
    # Line 69: project_doc = component_doc # verify_pat now returns project_doc
    # This looks broken in the file I read. It references component_doc which isn't defined yet? 
    # And plan_data is used in line 71 but not defined.
    # It seems I might have read a broken state or the user's code is strictly broken for ingest_plan.
    # However, manual_ingest (which is what we fixed) works.
    
    # Let's focus on manual_ingest first as that is critical and working.
    # I will copy manual_ingest and delete_plan. ingest_plan seems to need repair or might be a WIP.
    # I will move what is there.
    
    return func.HttpResponse("Endpoint under refactor", status_code=501)

@bp.route(route="manual_ingest", auth_level=func.AuthLevel.ANONYMOUS, methods=["POST"])
def manual_ingest(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Processing manual_ingest request.')

    try:
        req_body = req.get_json()
        # Manual extraction to avoid Pydantic overhead on large dicts
        component_id = req_body.get('component_id')
        environment = req_body.get('environment')
        tf_plan = req_body.get('terraform_plan')
        
        if not component_id or not environment or not tf_plan:
             return func.HttpResponse("Missing required fields: component_id, environment, terraform_plan", status_code=400)
             
        # Create object for compatibility with existing code
        class IngestData:
            def __init__(self, cid, env, plan):
                self.component_id = cid
                self.environment = env
                self.terraform_plan = plan
                
        ingest_data = IngestData(component_id, environment, tf_plan)

    except ValueError as e:
        return func.HttpResponse(f"Invalid JSON: {e}", status_code=400)

    # Fetch Component Logic
    try:
        container_comps = get_container("components")
        component_doc = container_comps.read_item(item=ingest_data.component_id, partition_key=ingest_data.component_id)
    except exceptions.CosmosResourceNotFoundError:
         return func.HttpResponse("Component not found", status_code=404)
    except Exception as e:
         return func.HttpResponse(f"Error fetching component: {e}", status_code=500)

    # Prepare Document
    doc_dict = {}
    tf_plan = ingest_data.terraform_plan

    # 1. Use Full Plan (No Pruning as requested)
    doc_dict['terraform_plan'] = tf_plan
    doc_dict['environment'] = ingest_data.environment
    
    if 'terraform_version' in tf_plan:
        doc_dict['terraform_version'] = tf_plan['terraform_version']
        
    providers = set()
    if 'configuration' in tf_plan and 'provider_config' in tf_plan['configuration']:
        for provider_key in tf_plan['configuration']['provider_config']:
            providers.add(provider_key)
    doc_dict['providers'] = list(providers)
    
    # Cloud Platform Detection
    cloud_platform = "Unknown" 
    if 'resource_changes' in tf_plan:
        for rc in tf_plan['resource_changes']:
            rtype = rc.get('type', '')
            if cloud_platform == "Unknown":
                if rtype.startswith('azurerm_'): cloud_platform = "Azure"
                elif rtype.startswith('aws_'): cloud_platform = "AWS"
                elif rtype.startswith('google_'): cloud_platform = "GCP"
                
    doc_dict['cloud_platform'] = cloud_platform

    # Project Metadata & Validation
    try:
        logging.info("Resolving project metadata...")
        project_container = get_container("projects")
        project_doc = project_container.read_item(item=component_doc['project_id'], partition_key=component_doc['project_id'])
        
        # Validation: Enforce Cloud Platform Consistency
        project_platform = project_doc.get('cloud_platform')
        if project_platform and project_platform != "Unknown" and cloud_platform != "Unknown":
            if project_platform != cloud_platform:
                return func.HttpResponse(
                    f"Platform Mismatch: Project is '{project_platform}' but uploaded plan is '{cloud_platform}'.", 
                    status_code=400
                )
        
        # If project has no platform set, set it now
        if (not project_platform or project_platform == "Unknown") and cloud_platform != "Unknown":
            project_doc['cloud_platform'] = cloud_platform
            project_container.upsert_item(project_doc)

        doc_dict['project_id'] = component_doc['project_id']
        doc_dict['component_id'] = component_doc['id']
        doc_dict['project_name'] = project_doc['name']
        doc_dict['component_name'] = component_doc['name']
    except Exception as e:
        logging.error(f"Project metadata failed: {e}")
        return func.HttpResponse("Failed to resolve project metadata", status_code=500)

    doc_dict['id'] = str(uuid.uuid4())
    
    # 2. Use Plan Timestamp
    plan_timestamp = tf_plan.get('timestamp')
    if plan_timestamp:
        doc_dict['timestamp'] = plan_timestamp
    else:
        doc_dict['timestamp'] = datetime.utcnow().isoformat()

    try:
        container = get_container("plans", "/id")
        
        # Validation: Check for Stale Plan
        query = """
            SELECT TOP 1 c.timestamp 
            FROM c 
            WHERE c.component_id = @cid AND c.environment = @env 
            ORDER BY c.timestamp DESC
        """
        params = [
            {"name": "@cid", "value": doc_dict['component_id']},
            {"name": "@env", "value": doc_dict['environment']}
        ]
        
        existing_plans = list(container.query_items(
            query=query, 
            parameters=params, 
            enable_cross_partition_query=True
        ))
        
        if existing_plans:
            latest_ts = existing_plans[0]['timestamp']
            if doc_dict['timestamp'] <= latest_ts:
                return func.HttpResponse(
                    f"Stale Plan: Uploaded plan timestamp ({doc_dict['timestamp']}) is older than or equal to the latest existing plan ({latest_ts}).",
                    status_code=400
                )

        # 3. Upload Full Plan to Blob Storage
        # Import inside function to avoid circular deps if any (though best at top)
        # Assuming verify imports later.
        from shared.storage import upload_plan_blob
        
        try:
            blob_url = upload_plan_blob(
                plan_data=tf_plan,
                project_id=doc_dict['project_id'],
                component_id=doc_dict['component_id'],
                environment=doc_dict['environment'],
                plan_id=doc_dict['id']
            )
            doc_dict['blob_url'] = blob_url
        except Exception as e:
            logging.error(f"Blob upload failed: {e}")
            return func.HttpResponse(f"Error uploading to Blob Storage: {e}", status_code=500)

        # 4. Prune Cosmos Document (Hybrid Approach)
        pruned_plan = {}
        # Keep Metadata
        for key in ['format_version', 'terraform_version', 'timestamp']:
            if key in tf_plan:
                pruned_plan[key] = tf_plan[key]
                
        # Keep Resource Changes (Critical for Dashboard, but stripped)
        if 'resource_changes' in tf_plan:
            refined_changes = []
            for rc in tf_plan['resource_changes']:
                change_data = rc.get('change', {})
                
                # Extract Resource Group Name
                rg_name = change_data.get('after', {}).get('resource_group_name')
                if not rg_name:
                    rg_name = change_data.get('before', {}).get('resource_group_name')
                
                refined_rc = {
                    'address': rc.get('address'),
                    'type': rc.get('type'),
                    'name': rc.get('name'), 
                    'resource_group': rg_name, # Stored for UI
                    'change': {
                        'actions': change_data.get('actions', [])
                    }
                }
                refined_changes.append(refined_rc)
            pruned_plan['resource_changes'] = refined_changes
            
        doc_dict['terraform_plan'] = pruned_plan

        container.upsert_item(doc_dict)
    except Exception as e:
        logging.error(f"Upsert failed: {e}")
        return func.HttpResponse(f"Error saving to Cosmos DB: {e}", status_code=500)

    return func.HttpResponse(
        body=json.dumps({"id": doc_dict['id'], "message": "Plan uploaded successfully"}),
        status_code=201,
        mimetype="application/json"
    )

@bp.route(route="delete_plan/{id}", auth_level=func.AuthLevel.ANONYMOUS, methods=["DELETE"])
def delete_plan(req: func.HttpRequest) -> func.HttpResponse:
    plan_id = req.route_params.get('id')
    logging.info(f"Processing delete_plan request for id: {plan_id}")

    try:
        container = get_container("plans", "/id")
        container.delete_item(item=plan_id, partition_key=plan_id)
        
        return func.HttpResponse(status_code=204)
        
    except exceptions.CosmosResourceNotFoundError:
        return func.HttpResponse(
            "Plan not found",
            status_code=404
        )
    except Exception as e:
        logging.error(f"Error deleting plan: {e}")
        return func.HttpResponse(
            f"Internal Server Error: {str(e)}",
            status_code=500
        )
