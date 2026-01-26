import azure.functions as func
import logging
import smtplib
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
from shared.db import get_container
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

            except Exception as e:
                logging.error(f"Error processing project {project.get('name')}: {e}")

    except Exception as e:
        logging.error(f"Timer trigger failed: {e}")
