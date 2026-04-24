import azure.functions as func
import logging
import smtplib
import os
import json
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
from shared.db import get_container
from shared.notifications import send_slack_blocks, send_slack_stale_alert
from models import NotificationSettings

bp = func.Blueprint()

@bp.timer_trigger(schedule="0 0 * * * *", arg_name="myTimer", run_on_startup=False,
              use_monitor=False) 
def timer_report(myTimer: func.TimerRequest) -> None:
    if myTimer.past_due:
        logging.info('The timer is past due!')

    logging.info('Python timer trigger function executed.')
    
    # 1. Fetch all projects
    try:
        container_projects = get_container("projects")
        projects = list(container_projects.read_all_items())
        
        container_plans = get_container("plans")
        container_components = get_container("components")
        
        current_time = datetime.utcnow()
        current_day = current_time.strftime("%A")
        current_hour = current_time.hour
        
        # Format Hour
        hour_str = f"{current_hour:02d}:00"
        
        for project in projects:
            try:
                notifications = project.get('notifications')
                if not notifications: continue
                
                email_settings = notifications.get('email', {})
                if not email_settings.get('enabled'): continue
                
                schedule = email_settings.get('schedule', {})
                if schedule.get('day') != current_day: continue
                if schedule.get('time') != hour_str: continue # Check exact hour match
                
                recipients = email_settings.get('recipients', [])
                if not recipients: continue
                
                logging.info(f"Generating report for Project: {project['name']}")
                
                # Fetch components
                components = list(container_components.query_items(
                    query="SELECT * FROM c WHERE c.project_id = @pid",
                    parameters=[{"name": "@pid", "value": project['id']}],
                    enable_cross_partition_query=True
                ))
                
                report_data = []

                for comp in components:
                    # Get latest plan
                    plans = list(container_plans.query_items(
                        query="SELECT TOP 1 * FROM c WHERE c.component_id = @cid ORDER BY c.timestamp DESC",
                        parameters=[{"name": "@cid", "value": comp['id']}],
                        enable_cross_partition_query=True
                    ))
                    
                    status = "Unknown"
                    changes_str = "N/A"
                    last_run = "Never"
                    
                    if plans:
                        plan = plans[0]
                        # Calculate Drift
                        add, change, destroy = 0, 0, 0
                        if 'terraform_plan' in plan and 'resource_changes' in plan['terraform_plan']:
                             for rc in plan['terraform_plan']['resource_changes']:
                                 actions = rc.get('change', {}).get('actions', [])
                                 if 'create' in actions: add += 1
                                 if 'update' in actions: change += 1
                                 if 'delete' in actions: destroy += 1
                        
                        total = add + change + destroy
                        if total == 0:
                            status = "Synced"
                            color = "green"
                        else:
                            status = "Drifted"
                            color = "red"
                            
                        changes_str = f"+{add} ~{change} -{destroy}"
                        last_run = plan.get('timestamp', 'Unknown')
                    else:
                        status = "No State"
                        color = "gray"
                        
                    report_data.append({
                        "component": comp['name'],
                        "environment": "dev", # TODO: Loop all environments if components are env-specific or assume dev? Components are global? No, plans are per env. 
                        # Wait, components are global, plans are per env. 
                        # We should iterate environments defined in Project. 
                        "status": status,
                        "changes": changes_str,
                        "last_run": last_run,
                        "color": color
                    })
                    
                # Note: The above loop logic assumes simplistic component-plan relationship. 
                # If we want per-environment, we should loop environments.
                # Re-do loop for environments.
                
                report_rows = []
                for env in project.get('environments', ['dev']):
                    for comp in components:
                         # Get latest plan for this ENV
                        plans = list(container_plans.query_items(
                            query="SELECT TOP 1 * FROM c WHERE c.component_id = @cid AND c.environment = @env ORDER BY c.timestamp DESC",
                            parameters=[
                                {"name": "@cid", "value": comp['id']},
                                {"name": "@env", "value": env}
                            ],
                            enable_cross_partition_query=True
                        ))
                        
                        status = "Unknown"
                        changes_str = "-"
                        last_run = "-"
                        color = "gray"
                        
                        if plans:
                            plan = plans[0]
                            # Simplify drift calc
                            add, change, destroy = 0, 0, 0
                            if 'terraform_plan' in plan and 'resource_changes' in plan['terraform_plan']:
                                 for rc in plan['terraform_plan']['resource_changes']:
                                     actions = rc.get('change', {}).get('actions', [])
                                     if 'create' in actions: add += 1
                                     if 'update' in actions: change += 1
                                     if 'delete' in actions: destroy += 1
                            total = add + change + destroy
                            if total == 0:
                                status = "Synced"
                                color = "green"
                            else:
                                status = "Drifted"
                                color = "red"
                            changes_str = f"+{add} ~{change} -{destroy}"
                            last_run_ts = plan.get('timestamp', '')
                            if last_run_ts:
                                try:
                                    last_run = datetime.fromisoformat(last_run_ts.replace('Z', '+00:00')).strftime("%Y-%m-%d %H:%M")
                                except:
                                    last_run = last_run_ts
                        
                        report_rows.append(f"""
                        <tr>
                            <td style="padding: 8px; border: 1px solid #ddd;">{comp['name']}</td>
                            <td style="padding: 8px; border: 1px solid #ddd;">{env}</td>
                            <td style="padding: 8px; border: 1px solid #ddd; color: {color}; font-weight: bold;">{status}</td>
                            <td style="padding: 8px; border: 1px solid #ddd;">{changes_str}</td>
                            <td style="padding: 8px; border: 1px solid #ddd;">{last_run}</td>
                        </tr>
                        """)

                # Construct Email
                html_content = f"""
                <html>
                <body>
                    <h2>Weekly Infrastructure Report: {project['name']}</h2>
                    <table style="border-collapse: collapse; width: 100%;">
                        <tr style="background-color: #f2f2f2;">
                            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Component</th>
                            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Environment</th>
                            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Status</th>
                            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Changes</th>
                            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Last Run</th>
                        </tr>
                        {''.join(report_rows)}
                    </table>
                </body>
                </html>
                """
                
                smtp_settings = email_settings.get('smtp', {})
                if not smtp_settings.get('host'): 
                    logging.warning("No SMTP host configured")
                    continue
                    
                msg = MIMEMultipart()
                msg['From'] = smtp_settings.get('username') or "noreply@terradorian.com"
                msg['To'] = ", ".join(recipients)
                msg['Subject'] = f"Weekly Report: {project['name']} ({current_day})"
                msg.attach(MIMEText(html_content, 'html'))
                
                try:
                    server = smtplib.SMTP(smtp_settings['host'], smtp_settings.get('port', 587))
                    server.starttls()
                    server.login(smtp_settings['username'], smtp_settings['password'])
                    server.send_message(msg)
                    server.quit()
                    logging.info("Email sent successfully")
                except Exception as e:
                    logging.error(f"Failed to send email: {e}")

                # --- Slack Weekly Report ---
                slack_settings = notifications.get('slack', {})
                if (slack_settings.get('enabled') and slack_settings.get('webhook_url')
                        and slack_settings.get('weekly_report')):
                    slack_schedule = slack_settings.get('schedule', {})
                    if slack_schedule.get('day') == current_day and slack_schedule.get('time') == hour_str:
                        logging.info(f"Sending weekly Slack report for Project: {project['name']}")
                        try:
                            report_blocks = _generate_slack_report_blocks(project, components, container_plans)
                            send_slack_blocks(slack_settings['webhook_url'], report_blocks)
                        except Exception as e:
                            logging.error(f"Failed to send Slack weekly report: {e}")

                # --- Stale Plan Alerts ---
                if (slack_settings.get('enabled') and slack_settings.get('webhook_url')
                        and slack_settings.get('stale_alerts')):
                    threshold_days = slack_settings.get('stale_threshold_days', 7)
                    stale_items = _find_stale_plans(project, components, container_plans, threshold_days, current_time)
                    if stale_items:
                        logging.info(f"Found {len(stale_items)} stale plans for Project: {project['name']}")
                        try:
                            send_slack_stale_alert(slack_settings['webhook_url'], project['name'], stale_items)
                        except Exception as e:
                            logging.error(f"Failed to send stale alert: {e}")

            except Exception as e:
                logging.error(f"Error processing project {project.get('name')}: {e}")

    except Exception as e:
        logging.error(f"Timer trigger failed: {e}")


def _generate_slack_report_blocks(project: dict, components: list, plans_container) -> list:
    """Generate Slack Block Kit blocks for a weekly drift report."""
    from datetime import datetime

    project_name = project.get("name", "Unknown Project")
    environments = project.get("environments", ["dev"])
    default_branch = project.get("default_branch", "develop")
    instance_url = "https://web-terradorian-dev.azurewebsites.net"

    # Fetch latest plans for default branch
    plan_query = """
    SELECT c.component_id, c.environment, c.timestamp, {'resource_changes': c.terraform_plan.resource_changes} AS terraform_plan
    FROM c
    WHERE c.project_id = @pid AND c.branch = @branch
    AND (NOT IS_DEFINED(c.is_pending_approval) OR c.is_pending_approval = false)
    ORDER BY c.timestamp DESC
    """
    all_plans = list(plans_container.query_items(
        query=plan_query,
        parameters=[
            {"name": "@pid", "value": project['id']},
            {"name": "@branch", "value": default_branch}
        ],
        enable_cross_partition_query=True
    ))

    # Build latest_plans[comp_id][env]
    latest_plans = {}
    for plan in all_plans:
        cid = plan.get('component_id')
        env = plan.get('environment')
        if cid and env:
            latest_plans.setdefault(cid, {})
            if env not in latest_plans[cid]:
                latest_plans[cid][env] = plan

    # Calculate average plan age
    now = datetime.utcnow()
    total_age_hours = 0
    plan_count = 0
    for env_dict in latest_plans.values():
        for plan in env_dict.values():
            ts_str = plan.get('timestamp')
            if ts_str:
                try:
                    ts = datetime.fromisoformat(ts_str.replace('Z', '+00:00')).replace(tzinfo=None)
                    total_age_hours += (now - ts).total_seconds() / 3600
                    plan_count += 1
                except Exception:
                    pass
    avg_age_days = round(total_age_hours / 24 / plan_count) if plan_count > 0 else 0

    # Build blocks
    blocks = [
        {
            "type": "section",
            "text": {"type": "mrkdwn", "text": f":terraform: Here's your weekly drift report for the *{project_name}* project on Terradorian:"}
        }
    ]

    # Table
    header_row = [{"type": "rich_text", "elements": [{"type": "rich_text_section", "elements": [{"type": "text", "text": " ", "style": {"bold": True}}]}]}]
    for env in environments:
        header_row.append({"type": "rich_text", "elements": [{"type": "rich_text_section", "elements": [{"type": "text", "text": env, "style": {"bold": True}}]}]})

    table_rows = [header_row]
    env_aligned = {env: 0 for env in environments}
    env_total = {env: 0 for env in environments}

    for comp in components:
        comp_id = comp['id']
        excluded_envs = comp.get('excluded_environments', [])
        row = [{"type": "rich_text", "elements": [{"type": "rich_text_section", "elements": [{"type": "text", "text": comp['name'], "style": {"bold": True}}]}]}]

        for env in environments:
            if env in excluded_envs:
                row.append({"type": "rich_text", "elements": [{"type": "rich_text_section", "elements": [{"type": "emoji", "name": "white_circle"}]}]})
                continue

            env_total[env] += 1
            plan = latest_plans.get(comp_id, {}).get(env)

            if not plan:
                row.append({"type": "rich_text", "elements": [{"type": "rich_text_section", "elements": [{"type": "emoji", "name": "question"}]}]})
                continue

            changes = plan.get('terraform_plan', {}).get('resource_changes', [])
            summary = {"create": 0, "update": 0, "delete": 0, "replace": 0}
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

            has_drift = sum(summary.values()) > 0
            if not has_drift:
                row.append({"type": "rich_text", "elements": [{"type": "rich_text_section", "elements": [{"type": "emoji", "name": "large_green_circle"}]}]})
                env_aligned[env] += 1
            else:
                elements = []
                if summary["create"] > 0:
                    elements += [{"type": "emoji", "name": "large_blue_circle"}, {"type": "text", "text": f" To create: {summary['create']}\n"}]
                if summary["update"] > 0:
                    elements += [{"type": "emoji", "name": "large_purple_circle"}, {"type": "text", "text": f" To change: {summary['update']}\n"}]
                if summary["delete"] > 0:
                    elements += [{"type": "emoji", "name": "red_circle"}, {"type": "text", "text": f" To delete: {summary['delete']}\n"}]
                if summary["replace"] > 0:
                    elements += [{"type": "emoji", "name": "large_yellow_circle"}, {"type": "text", "text": f" To recreate: {summary['replace']}\n"}]
                if elements and elements[-1].get("text", "").endswith("\n"):
                    elements[-1]["text"] = elements[-1]["text"].rstrip("\n")
                row.append({"type": "rich_text", "elements": [{"type": "rich_text_section", "elements": elements}]})

        table_rows.append(row)

    # Alignment row
    alignment_row = [{"type": "rich_text", "elements": [{"type": "rich_text_section", "elements": [{"type": "text", "text": "Alignment", "style": {"bold": True}}]}]}]
    for env in environments:
        score = round((env_aligned[env] / env_total[env]) * 100) if env_total[env] > 0 else 0
        emoji_name = "small_red_triangle_down" if score < 100 else "small_red_triangle"
        alignment_row.append({"type": "rich_text", "elements": [{"type": "rich_text_section", "elements": [{"type": "emoji", "name": emoji_name}, {"type": "text", "text": f"{score}%"}]}]})
    table_rows.append(alignment_row)

    blocks.append({"type": "table", "rows": table_rows})
    blocks.append({"type": "section", "text": {"type": "mrkdwn", "text": f":eyes: <{instance_url}/p/{project['id']}/overview|Click here> to view the report in more detail."}})
    blocks.append({"type": "divider"})
    blocks.append({"type": "context", "elements": [{"type": "mrkdwn", "text": f":calendar: The Terraform plans are on average {avg_age_days}d old.\n:github: This report was generated from the `{default_branch}` branch."}]})

    return blocks


def _find_stale_plans(project: dict, components: list, plans_container, threshold_days: int, now: datetime) -> list[dict]:
    """Find component/environment combinations where the latest plan is older than threshold_days."""
    stale_items = []
    environments = project.get("environments", ["dev"])
    default_branch = project.get("default_branch", "develop")

    for comp in components:
        excluded_envs = comp.get('excluded_environments', [])
        for env in environments:
            if env in excluded_envs:
                continue

            plans = list(plans_container.query_items(
                query="SELECT TOP 1 c.timestamp FROM c WHERE c.component_id = @cid AND c.environment = @env AND c.branch = @branch AND (NOT IS_DEFINED(c.is_pending_approval) OR c.is_pending_approval = false) ORDER BY c.timestamp DESC",
                parameters=[
                    {"name": "@cid", "value": comp['id']},
                    {"name": "@env", "value": env},
                    {"name": "@branch", "value": default_branch}
                ],
                enable_cross_partition_query=True
            ))

            if not plans:
                continue  # No plans at all — not stale, just missing

            ts_str = plans[0].get('timestamp')
            if not ts_str:
                continue

            try:
                ts = datetime.fromisoformat(ts_str.replace('Z', '+00:00')).replace(tzinfo=None)
                days_old = (now - ts).days
                if days_old >= threshold_days:
                    stale_items.append({
                        "component": comp['name'],
                        "environment": env,
                        "days_old": days_old
                    })
            except Exception:
                pass

    return stale_items
