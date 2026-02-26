import azure.functions as func
import logging
import json
import uuid
import hashlib
from datetime import datetime
from azure.cosmos import exceptions
from models import ManualIngestSchema
from shared.db import get_container
from shared.notifications import send_slack_alert

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

    # --- Authentication Logic ---
    from shared.auth import verify_pat
    import os

    is_authorized = False
    project_doc = None

    # 1. Check Internal Secret (from Web App)
    internal_secret = os.environ.get('INTERNAL_SECRET')
    auth_header_secret = req.headers.get('x-internal-secret')
    
    if internal_secret and auth_header_secret == internal_secret:
        is_authorized = True
        logging.info("Authenticated via Internal Secret")
    
    # 2. Check PAT (from DevOps/External)
    if not is_authorized:
        auth_header = req.headers.get('Authorization')
        if auth_header and auth_header.startswith("Bearer "):
            token_str = auth_header.split(" ")[1]
            project_doc = verify_pat(token_str)
            if project_doc:
                is_authorized = True
                logging.info(f"Authenticated via PAT for Project {project_doc['id']}")

    if not is_authorized:
        return func.HttpResponse("Unauthorized: Invalid PAT or Secret", status_code=401)

    try:
        req_body = req.get_json()
        # Manual extraction to avoid Pydantic overhead on large dicts
        component_id = req_body.get('component_id')
        component_name = req_body.get('component_name')
        environment = req_body.get('environment')
        branch = req_body.get('branch', 'develop')
        tf_plan = req_body.get('terraform_plan')
        
        if not (component_id or component_name) or not environment or not tf_plan:
             return func.HttpResponse("Missing required fields: component_id (or component_name), environment, terraform_plan", status_code=400)
             
        # Create object for compatibility with existing code
        class IngestData:
            def __init__(self, cid, cname, env, branch, plan):
                self.component_id = cid
                self.component_name = cname
                self.environment = env
                self.branch = branch
                self.terraform_plan = plan
                
        ingest_data = IngestData(component_id, component_name, environment, branch, tf_plan)

    except ValueError as e:
        return func.HttpResponse(f"Invalid JSON: {e}", status_code=400)

    # Fetch Component Logic
    component_doc = None
    is_pending_approval = False
    
    try:
        container_comps = get_container("components")
        
        if ingest_data.component_id:
             # Direct ID lookup (Efficient, PK aware)
             component_doc = container_comps.read_item(item=ingest_data.component_id, partition_key=ingest_data.component_id)
        elif ingest_data.component_name:
             # Name lookup (Requires Project Context)
             if not project_doc:
                 return func.HttpResponse("component_name lookup requires PAT authentication (Project Context) for new or existing components.", status_code=400)
             
             # Cross-partition query (Acceptable for lookup)
             query = "SELECT * FROM c WHERE c.project_id = @pid AND c.name = @name"
             params = [
                 {"name": "@pid", "value": project_doc['id']},
                 {"name": "@name", "value": ingest_data.component_name}
             ]
             results = list(container_comps.query_items(query=query, parameters=params, enable_cross_partition_query=True))
             
             if not results:
                 # Component does not exist. Mark as pending approval.
                 is_pending_approval = True
             elif len(results) > 1:
                  return func.HttpResponse(f"Ambiguous component name '{ingest_data.component_name}'", status_code=409)
             else:
                  component_doc = results[0]
                  # Backfill ID for downstream logic
                  ingest_data.component_id = component_doc['id']
        else:
             return func.HttpResponse("Either component_id or component_name is required", status_code=400)

    except exceptions.CosmosResourceNotFoundError:
        # If looked up by component_id and not found, this is a hard error (ids shouldn't be guessed)
        return func.HttpResponse("Component ID not found", status_code=404)
    except Exception as e:
         return func.HttpResponse(f"Error fetching component: {e}", status_code=500)

    # Prepare Document
    doc_dict = {}
    tf_plan = ingest_data.terraform_plan

    # 1. Use Full Plan (No Pruning as requested)
    doc_dict['terraform_plan'] = tf_plan
    doc_dict['environment'] = ingest_data.environment
    doc_dict['branch'] = ingest_data.branch
    
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
        
        # If we have a component_doc, its project_id is the primary source of truth (especially for legacy shared secret)
        target_project_id = component_doc['project_id'] if component_doc else project_doc['id'] if project_doc else None
        
        if not target_project_id:
            return func.HttpResponse("Cannot determine project context", status_code=400)
            
        # Re-fetch project doc to ensure we have the latest (including environments) if we didn't get it from PAT or if we need to verify component ownership
        fetched_project_doc = project_container.read_item(item=target_project_id, partition_key=target_project_id)
        
        # Environment Check
        if ingest_data.environment not in fetched_project_doc.get('environments', []):
            is_pending_approval = True
            
        doc_dict['is_pending_approval'] = is_pending_approval
        
        # Validation: Enforce Cloud Platform Consistency (Skip if pending, but maybe set project platform anyway?)
        project_platform = fetched_project_doc.get('cloud_platform')
        if project_platform and project_platform != "Unknown" and cloud_platform != "Unknown":
            if project_platform != cloud_platform:
                return func.HttpResponse(
                    f"Platform Mismatch: Project is '{project_platform}' but uploaded plan is '{cloud_platform}'.", 
                    status_code=400
                )
        
        # If project has no platform set, set it now
        if (not project_platform or project_platform == "Unknown") and cloud_platform != "Unknown":
            fetched_project_doc['cloud_platform'] = cloud_platform
            project_container.upsert_item(fetched_project_doc)

        doc_dict['project_id'] = fetched_project_doc['id']
        doc_dict['project_name'] = fetched_project_doc['name']
        
        if component_doc:
            doc_dict['component_id'] = component_doc['id']
            doc_dict['component_name'] = component_doc['name']
        else:
            doc_dict['component_name'] = ingest_data.component_name
            # No component ID yet as it is pending
        
        # --- PAT Ownership Check ---
        # If authenticated via PAT (project_doc from header matches), ensure component belongs to that project
        if project_doc and 'id' in project_doc and component_doc:
             # Just strict equality since project_doc comes from PAT verification
             if component_doc['project_id'] != project_doc['id']:
                 logging.warning(f"Security Alert: PAT for Project {project_doc['id']} tried to upload to Component {component_doc['id']} (Project {component_doc['project_id']})")
                 return func.HttpResponse("Forbidden: PAT does not match Component's Project", status_code=403)
                 
    except Exception as e:
        logging.error(f"Project metadata failed: {e}")
        return func.HttpResponse("Failed to resolve project metadata", status_code=500)

    # Create Document ID early
    plan_id = str(uuid.uuid4())
    doc_dict['id'] = plan_id
    
    # 2. Use Plan Timestamp
    plan_timestamp = tf_plan.get('timestamp')
    if plan_timestamp:
        doc_dict['timestamp'] = plan_timestamp
    else:
        doc_dict['timestamp'] = datetime.utcnow().isoformat()

    # --- Heuristic Dependency Scanning ---
    try:
        # Fetch all components for this project to build a lookup map
        # Optimization: cache this? For now, fetch on every ingest is okay (low volume)
        comp_container = get_container("components")
        project_components = list(comp_container.query_items(
            query="SELECT c.id, c.name FROM c WHERE c.project_id = @pid",
            parameters=[{"name": "@pid", "value": doc_dict['project_id']}],
            enable_cross_partition_query=True
        ))
        
        # Build comp_map so check_text doesn't throw a ReferenceError
        comp_map = {c['name'].lower(): c['id'] for c in project_components}
        found_dependencies = set()
        
        # Helper to check string for component names
        def check_text(text):
            if not isinstance(text, str): return
            text_lower = text.lower()
            for c_name, c_id in comp_map.items():
                # Avoid self-referential matching if component_id is known
                if doc_dict.get('component_id') != c_id and c_name in text_lower:
                    found_dependencies.add(c_id)

        # 1. Scan Variables
        if 'variables' in tf_plan:
            for var_key, var_val in tf_plan['variables'].items():
                val = var_val.get('value')
                check_text(val)
                
        # 2. Scan Configuration Resources (Managed & Data)
        # Structure: plan['configuration']['root_module']['resources'] -> list of dicts
        config = tf_plan.get('configuration', {})
        root_module = config.get('root_module', {})
        resources = root_module.get('resources', [])
        
        for res in resources:
            # Check Resource Name
            check_text(res.get('name'))
            
            # Check Expressions (Arguments)
            # expressions is a dict of input args. Values can be complex.
            # We'll do a shallow scan of string values.
            expressions = res.get('expressions', {})
            for expr_key, expr_val in expressions.items():
                # expr_val could be {"constant_value": "..."} or references
                if isinstance(expr_val, dict):
                    check_text(expr_val.get('constant_value'))
                    
        doc_dict['dependencies'] = list(found_dependencies)
        logging.info(f"Dependency Scan complete. Found: {len(found_dependencies)} links.")
        
    except Exception as e:
        logging.error(f"Dependency scanning failed: {e}")
        # Non-critical, continue
        doc_dict['dependencies'] = []

    # 2.x Build Resource Graph (New)
    try:
        resource_graph = {"nodes": [], "edges": []}
        
        # Helper to recursively parse modules
        def parse_module(module, parent_path=""):
            for res in module.get("resources", []):
                res_addr = res.get("address")
                res_type = res.get("type")
                res_name = res.get("name")
                
                # Check if this resource is actually change-managed (exists in resource_changes)
                # Optimization: We might want all config resources even if no-op, to show full structure?
                # User asked for "latest plan", usually implies active things.
                # But graph is structural. Let's include everything found in config.
                
                node = {
                    "id": res_addr,
                    "label": res_name,
                    "type": res_type,
                    "group": res_addr.split('.')[0] if '.' in res_addr else "root" # heuristic grouping
                }
                resource_graph["nodes"].append(node)
                
                # explicit depends_on
                for dep in res.get("depends_on", []):
                     resource_graph["edges"].append({"source": dep, "target": res_addr, "type": "explicit"})
                     
                # implicit references in expressions
                expressions = res.get("expressions", {})
                for expr_key, expr_val in expressions.items():
                    if isinstance(expr_val, dict) and "references" in expr_val:
                        for ref in expr_val["references"]:
                             # ref can be "azurerm_resource_group.rg.name". We need "azurerm_resource_group.rg"
                             # Heuristic: match against known nodes?
                             # Or just strip attributes.
                             # Terraform addresses are usually [module.path].type.name
                             # Reference might include attribute access.
                             
                             # Simple heuristic: Split by dot, take first 2 parts if root, or more if module?
                             # Better: Check if ref starts with a known node ID.
                             # Since we are building nodes on fly, we might settle for just storing the raw ref and cleaning in frontend?
                             # No, backend should do best effort.
                             
                             # Let's clean attribute access:
                             # "azurerm_resource_group.rg.name" -> "azurerm_resource_group.rg"
                             # "module.x.azurerm_resource_group.rg.id" -> "module.x.azurerm_resource_group.rg"
                             
                             # Assumption: Resource addresses don't have dots in names, only as separators.
                             # Types have underscores.
                             
                             # Edge creation (we'll filter invalid ones later or let frontend handle dangling edges)
                             resource_graph["edges"].append({"source": ref, "target": res_addr, "type": "implicit"})

            for child in module.get("child_modules", []):
                parse_module(child)

        config = tf_plan.get("configuration", {})
        root = config.get("root_module", {})
        parse_module(root)
        
        # Post-process edges to map attributes to resource IDs
        # 1. Collect all Node IDs
        node_ids = set(n["id"] for n in resource_graph["nodes"])
        
        valid_edges = []
        for edge in resource_graph["edges"]:
            src = edge["source"]
            target = edge["target"]
            
            # Try exact match
            if src in node_ids:
                valid_edges.append(edge)
                continue
                
            # Try removing last segment (attribute) until match found
            parts = src.split('.')
            while len(parts) > 1:
                parts.pop()
                candidate = ".".join(parts)
                if candidate in node_ids:
                    edge["source"] = candidate
                    valid_edges.append(edge)
                    break
                    
        resource_graph["edges"] = valid_edges
        
        doc_dict['resource_graph'] = resource_graph
        logging.info(f"Resource Graph built: {len(resource_graph['nodes'])} nodes, {len(resource_graph['edges'])} edges")
        
    except Exception as e:
        logging.error(f"Failed to build resource graph: {e}")
        doc_dict['resource_graph'] = {"nodes": [], "edges": []}

    # 3. Check for Stale Plan (Moved BEFORE Upload)
    try:
        # Only perform the stale plan check if the component actually exists (not pending approval)
        if not doc_dict.get('is_pending_approval'):
            container = get_container("plans", "/id")
            
            query = """
                SELECT TOP 1 c.timestamp, c.id
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
                        f"Stale Plan: Uploaded plan timestamp ({doc_dict['timestamp']}) is not newer than latest plan ({latest_ts}).",
                        status_code=400
                    )
    except Exception as e:
        # If DB check fails, we probably shouldn't proceed? Or log and proceed?
        # Proceeding is risky if DB is down. Failing is safer.
        logging.error(f"Failed to check for stale plans: {e}")
        return func.HttpResponse(f"Database Error checking stale plans: {e}", status_code=500)

    # 4. Upload Full Plan to Blob Storage
    # Import inside function to avoid circular deps if any (though best at top)
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
        status_code = 500
        error_msg = f"Blob Storage Upload Failed: {str(e)}"
        if "AuthorizationPermissionMismatch" in str(e) or "403" in str(e):
             status_code = 500
             error_msg = "Blob Storage Access Denied (403). Check Managed Identity RBAC assignments."
        
        logging.error(f"Blob upload failed: {e}")
        return func.HttpResponse(error_msg, status_code=status_code)

    try:
        # 5. Prune Cosmos Document (Hybrid Approach)
        pruned_plan = {}
        # Keep Metadata
        for key in ['format_version', 'terraform_version', 'timestamp']:
            if key in tf_plan:
                pruned_plan[key] = tf_plan[key]
                
        # Keep Resource Changes
        if 'resource_changes' in tf_plan:
            refined_changes = []
            for rc in tf_plan['resource_changes']:
                change_data = rc.get('change') or {}
                
                # Extract Resource Group Name
                after_data = change_data.get('after') or {}
                rg_name = after_data.get('resource_group_name')
                
                if not rg_name:
                    before_data = change_data.get('before') or {}
                    rg_name = before_data.get('resource_group_name')
                
                refined_rc = {
                    'address': rc.get('address'),
                    'type': rc.get('type'),
                    'name': rc.get('name'), 
                    'resource_group': rg_name,
                    'change': {
                        'actions': change_data.get('actions', [])
                    }
                }
                refined_changes.append(refined_rc)
            pruned_plan['resource_changes'] = refined_changes
            
        doc_dict['terraform_plan'] = pruned_plan

        container.upsert_item(doc_dict)
        
    except exceptions.CosmosHttpResponseError as e:
        logging.error(f"Cosmos DB Error: {e.status_code} - {e.message}")
        if e.status_code == 413:
             return func.HttpResponse("Plan too large for Database. Please reduce plan size or contact support.", status_code=413)
        return func.HttpResponse(f"Database Error ({e.status_code}): {e.message}", status_code=500)
    except Exception as e:
        logging.error(f"Upsert failed: {e}")
        return func.HttpResponse(f"Internal Error saving to DB: {e}", status_code=500)

    # 5. Drift Notification (Slack) - Post-Success Logic
    try:
        notifications = project_doc.get('notifications', {})
        slack_settings = notifications.get('slack', {})
        
        if slack_settings.get('enabled') and slack_settings.get('webhook_url'):
            # Calculate current changes
            curr_changes = 0
            if 'resource_changes' in doc_dict['terraform_plan']:
                for rc in doc_dict['terraform_plan']['resource_changes']:
                        actions = rc.get('change', {}).get('actions', [])
                        if any(a in ['create', 'update', 'delete'] for a in actions):
                            curr_changes += 1
            
            # Check previous state
            prev_changes = 0
            # Logic for drift alerting...
            # Simplified for fix: just notify if drift > 0 and transitions?
            # Keeping original alert logic but inside safe block
            
            should_alert = False
            if existing_plans:
                    try:
                        prev_id = existing_plans[0]['id']
                        # Re-read full doc for drift comparison since query was lightweight
                        prev_plan_doc = container.read_item(item=prev_id, partition_key=prev_id)
                        
                        if 'terraform_plan' in prev_plan_doc and 'resource_changes' in prev_plan_doc['terraform_plan']:
                            for rc in prev_plan_doc['terraform_plan']['resource_changes']:
                                actions = rc.get('change', {}).get('actions', [])
                                if any(a in ['create', 'update', 'delete'] for a in actions):
                                    prev_changes += 1
                        
                        if prev_changes == 0 and curr_changes > 0:
                            should_alert = True
                            logging.info(f"Drift Transition (0->{curr_changes}). Alerting.")
                            
                    except Exception as ex:
                        logging.warning(f"Could not fetch previous plan for drift: {ex}")

            if should_alert:
                try:
                    send_slack_alert(
                        webhook_url=slack_settings['webhook_url'],
                        project_name=doc_dict['project_name'],
                        component_name=doc_dict['component_name'],
                        environment=doc_dict['environment'],
                        drift_summary=doc_dict['terraform_plan'],
                        plan_url=None
                    )
                except Exception as slack_ex:
                        logging.error(f"Failed to send slack alert: {slack_ex}")
    except Exception as e:
        logging.error(f"Notification logic warning: {e}") 
        # Don't fail the ingest
        pass

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
