import logging
import requests
import json

def send_slack_alert(webhook_url: str, project_name: str, component_name: str, environment: str, drift_summary: dict, plan_url: str = None):
    """
    Sends a formatted Slack message about drift detection.
    """
    if not webhook_url:
        return

    # Count changes
    add = 0
    change = 0
    destroy = 0
    
    if 'resource_changes' in drift_summary:
        for rc in drift_summary['resource_changes']:
            actions = rc.get('change', {}).get('actions', [])
            if 'create' in actions: add += 1
            if 'update' in actions: change += 1
            if 'delete' in actions: destroy += 1

    total_changes = add + change + destroy
    
    if total_changes == 0:
        return # No drift, no alert needed based on requirement "if new drift is detected"

    # Color logic: Red if destroy, Orange if change, Green if only add (though drift is usually warning)
    color = "#e01e5a" if destroy > 0 else "#ecb22e"

    blocks = [
        {
            "type": "header",
            "text": {
                "type": "plain_text",
                "text": f"🚨 Drift Detected: {component_name} ({environment})"
            }
        },
        {
            "type": "section",
            "fields": [
                {"type": "mrkdwn", "text": f"*Project:*\n{project_name}"},
                {"type": "mrkdwn", "text": f"*Environment:*\n{environment}"}
            ]
        },
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": f"*Changes Detected: {total_changes}*\n➕ {add} to add\n✏️ {change} to change\n🔥 {destroy} to destroy"
            }
        }
    ]

    if plan_url:
        blocks.append({
            "type": "actions",
            "elements": [
                {
                    "type": "button",
                    "text": {
                        "type": "plain_text",
                        "text": "View Plan"
                    },
                    "url": plan_url,
                    "style": "primary"
                }
            ]
        })

    payload = {
        "blocks": blocks,
        "attachments": [
            {
                "color": color,
                "fallback": f"Drift detected in {component_name}"
            }
        ]
    }

    try:
        response = requests.post(webhook_url, json=payload, timeout=5)
        if response.status_code != 200:
            logging.error(f"Slack notification failed: {response.status_code} - {response.text}")
        else:
            logging.info(f"Slack notification sent for {component_name}")
    except Exception as e:
        logging.error(f"Error sending Slack notification: {e}")
