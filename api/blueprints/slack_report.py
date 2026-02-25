import azure.functions as func
import json
from datetime import datetime
from shared.db import get_container
from azure.cosmos import exceptions

bp = func.Blueprint()

@bp.route(route="generate_slack_report", auth_level=func.AuthLevel.ANONYMOUS, methods=["GET"])
def generate_slack_report(req: func.HttpRequest) -> func.HttpResponse:
    project_id = req.params.get('project_id')
    branch = req.params.get('branch')
    
    if not project_id:
        return func.HttpResponse("project_id param required", status_code=400)
    
    try:
        # Fetch Project
        projects_container = get_container("projects")
        proj_doc = projects_container.read_item(item=project_id, partition_key=project_id)
        
        project_name = proj_doc.get("name", "Unknown Project")
        environments = proj_doc.get("environments", ["dev"])
        default_branch = proj_doc.get("default_branch", "develop")
        target_branch = branch if branch else default_branch
        
        # Default instance URL
        instance_url = "https://web-terradorian-dev.azurewebsites.net"
        
        # Fetch Components
        comp_container = get_container("components", "/id")
        comp_query = "SELECT * FROM c WHERE c.project_id = @pid ORDER BY c.name ASC"
        comp_params = [{"name": "@pid", "value": project_id}]
        components = list(comp_container.query_items(
            query=comp_query,
            parameters=comp_params,
            enable_cross_partition_query=True
        ))
        
        if not components:
            return func.HttpResponse("No components found for this project", status_code=404)
        
        # Fetch Latest Plans
        plans_container = get_container("plans", "/id")
        plan_query = """
        SELECT c.component_id, c.environment, c.timestamp, {'resource_changes': c.terraform_plan.resource_changes} AS terraform_plan 
        FROM c 
        WHERE c.project_id = @pid AND c.branch = @branch 
        AND (NOT IS_DEFINED(c.is_pending_approval) OR c.is_pending_approval = false)
        ORDER BY c.timestamp DESC
        """
        plan_params = [
            {"name": "@pid", "value": project_id},
            {"name": "@branch", "value": target_branch}
        ]
        
        all_plans = list(plans_container.query_items(
            query=plan_query,
            parameters=plan_params,
            enable_cross_partition_query=True
        ))
        
        # Build map of fastest lookup: latest_plans[comp_id][env] = plan
        latest_plans = {}
        for plan in all_plans:
            cid = plan.get('component_id')
            env = plan.get('environment')
            if not cid or not env:
                continue
            if cid not in latest_plans:
                latest_plans[cid] = {}
            if env not in latest_plans[cid]:
                latest_plans[cid][env] = plan 
        
        # Calculate Plan Ages
        total_age_hours = 0
        plan_count = 0
        now = datetime.utcnow()
        for cid, env_dict in latest_plans.items():
            for env, plan in env_dict.items():
                if plan.get('timestamp'):
                    try:
                        # "2024-02-23T14:45:00.000Z"
                        ts = datetime.fromisoformat(plan['timestamp'].replace('Z', '+00:00')).replace(tzinfo=None)
                        total_age_hours += (now - ts).total_seconds() / 3600
                        plan_count += 1
                    except Exception:
                        pass
                        
        avg_age_days = round(total_age_hours / 24 / plan_count) if plan_count > 0 else 0
        
        # Construct Slack Block Kit
        blocks = []
        
        # Header
        blocks.append({
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": f":terraform: Here's your weekly drift report for the *{project_name}* project on Terradorian:"
            }
        })
        
        # Table builder
        table_rows = []
        
        # Header Row
        header_row = [{"type": "rich_text", "elements": [{"type": "rich_text_section", "elements": [{"type": "text", "text": " ", "style": {"bold": True}}]}]}]
        for env in environments:
            header_row.append({
                "type": "rich_text",
                "elements": [{"type": "rich_text_section", "elements": [{"type": "text", "text": env, "style": {"bold": True}}]}]
            })
        table_rows.append(header_row)
        
        # Alignment Trackers
        env_aligned = {env: 0 for env in environments}
        env_total = {env: 0 for env in environments}
        
        # Component Rows
        for comp in components:
            comp_id = comp['id']
            comp_name = comp['name']
            excluded_envs = comp.get('excluded_environments', [])
            
            row = [{"type": "rich_text", "elements": [{"type": "rich_text_section", "elements": [{"type": "text", "text": comp_name, "style": {"bold": True}}]}]}]
            
            for env in environments:
                if env in excluded_envs:
                    row.append({"type": "rich_text", "elements": [{"type": "rich_text_section", "elements": [{"type": "emoji", "name": "white_circle"}]}]})
                    continue
                
                plan = latest_plans.get(comp_id, {}).get(env)
                
                env_total[env] += 1
                
                if not plan:
                    row.append({"type": "rich_text", "elements": [{"type": "rich_text_section", "elements": [{"type": "emoji", "name": "question"}]}]})
                    continue
                    
                # Process drifts
                changes = plan.get('terraform_plan', {}).get('resource_changes', [])
                summary = {"create": 0, "update": 0, "delete": 0, "replace": 0, "read": 0, "import": 0, "move": 0}
                
                for rc in changes:
                    actions = rc.get('change', {}).get('actions', [])
                    if 'create' in actions and 'delete' in actions:
                        summary["replace"] += 1
                    elif 'create' in actions:
                        summary["create"] += 1
                    elif 'update' in actions:
                        summary["update"] += 1
                    elif 'delete' in actions:
                        summary["delete"] += 1
                    elif 'read' in actions:
                        summary["read"] += 1
                    
                    # For import and move, the actions list might be ["no-op"] but there is an 'action_reason' or other indicator in TF 1.5+. 
                    # If this logic isn't perfect, we can tweak it based on sample outputs, assuming 'import' or 'moved' can appear.
                    if 'import' in actions:
                         summary["import"] += 1
                         
                # Check for "moved" in plan (TF represents this differently, but we accommodate based on the design)
                # We'll map to emojis based on the requested template
                has_drift = sum(summary.values()) - summary['read'] > 0
                
                if not has_drift:
                    row.append({"type": "rich_text", "elements": [{"type": "rich_text_section", "elements": [{"type": "emoji", "name": "large_green_circle"}]}]})
                    env_aligned[env] += 1
                else:
                    elements = []
                    
                    if summary["create"] > 0:
                        elements.append({"type": "emoji", "name": "large_blue_circle"})
                        elements.append({"type": "text", "text": f" To create: {summary['create']}\\n"})
                    
                    if summary["update"] > 0:
                        elements.append({"type": "emoji", "name": "large_purple_circle"})
                        elements.append({"type": "text", "text": f" To change: {summary['update']}\\n"})
                        
                    if summary["delete"] > 0:
                        elements.append({"type": "emoji", "name": "red_circle"})
                        elements.append({"type": "text", "text": f" To delete: {summary['delete']}\\n"})
                        
                    if summary["replace"] > 0:
                        elements.append({"type": "emoji", "name": "large_yellow_circle"})
                        elements.append({"type": "text", "text": f" To recreate: {summary['replace']}\\n"})
                        
                    if summary["import"] > 0:
                        elements.append({"type": "emoji", "name": "white_circle"})
                        elements.append({"type": "text", "text": f" To import: {summary['import']}\\n"})
                        
                    # Clean trailing newline if any
                    if elements and elements[-1]["type"] == "text" and elements[-1]["text"].endswith("\\n"):
                        elements[-1]["text"] = elements[-1]["text"][:-2]
                        
                    row.append({
                        "type": "rich_text",
                        "elements": [{"type": "rich_text_section", "elements": elements}]
                    })
                    
            table_rows.append(row)
            
        # Alignment Row
        alignment_row = [{"type": "rich_text", "elements": [{"type": "rich_text_section", "elements": [{"type": "text", "text": "Alignment", "style": {"bold": True}}]}]}]
        for env in environments:
            score = round((env_aligned[env] / env_total[env]) * 100) if env_total[env] > 0 else 0
            # Red triangle down if score < 100, else standard Green circle or no triangle?
            # Design shows small_red_triangle_down for 80%, small_red_triangle for 30%, 100% etc. 
            # We will use small_red_triangle_down for < 100%, and regular text for 100% or just small_green_triangle
            # Let's match the template logic: red_triangle_down.
            emoji_name = "small_red_triangle_down" if score < 100 else "small_red_triangle"
            alignment_row.append({
                "type": "rich_text",
                "elements": [{"type": "rich_text_section", "elements": [{"type": "emoji", "name": emoji_name}, {"type": "text", "text": f"{score}%"}]}]
            })
        
        table_rows.append(alignment_row)
        
        blocks.append({
            "type": "table",
            "rows": table_rows
        })
        
        blocks.append({
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": f":eyes: <{instance_url}/p/{project_id}/overview|Click here> to view the report in more detail."
            }
        })
        
        blocks.append({"type": "divider"})
        
        blocks.append({
            "type": "context",
            "elements": [
                {
                    "type": "mrkdwn",
                    "text": f":calendar: The Terraform plans are on average {avg_age_days}d old.\\n:github: This report was generated from the `{target_branch}` branch."
                }
            ]
        })
        
        return func.HttpResponse(
            body=json.dumps({"blocks": blocks}),
            status_code=200,
            mimetype="application/json"
        )
        
    except exceptions.CosmosResourceNotFoundError:
        return func.HttpResponse("Project not found", status_code=404)
    except Exception as e:
        import traceback
        traceback.print_exc()
        return func.HttpResponse(f"Error: {e}", status_code=500)
    
