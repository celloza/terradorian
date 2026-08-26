import azure.functions as func
import csv
import io
import json
import logging
import os
from datetime import datetime, timezone, timedelta
from shared.db import get_container
from shared.auth import verify_pat

bp = func.Blueprint()

ASSET_REGISTER_COLUMNS = [
    'environment', 'component', 'resource_group',
    'resource_type', 'resource_name', 'resource_address', 'plan_timestamp',
]


def _resolve_auth(req: func.HttpRequest) -> tuple[bool, dict | None]:
    """Returns (is_authorized, project_doc). project_doc is set only when auth is via PAT."""
    internal_secret = os.environ.get('INTERNAL_SECRET')
    if internal_secret and req.headers.get('x-internal-secret') == internal_secret:
        return True, None
    auth_header = req.headers.get('Authorization', '')
    if auth_header.startswith('Bearer '):
        project_doc = verify_pat(auth_header.split(' ', 1)[1])
        if project_doc:
            return True, project_doc
    return False, None
    """Mirrors the action classification logic in project-dashboard.tsx."""
    to_create = to_update = to_delete = unchanged = 0
    for rc in resource_changes:
        actions = rc.get('change', {}).get('actions', [])
        if 'create' in actions and 'delete' in actions:
            to_create += 1
            to_delete += 1
        elif 'create' in actions:
            to_create += 1
        elif 'delete' in actions:
            to_delete += 1
        elif 'update' in actions:
            to_update += 1
        elif 'no-op' in actions or 'read' in actions:
            unchanged += 1
    return to_create, to_update, to_delete, unchanged


@bp.route(route="report/summary", auth_level=func.AuthLevel.ANONYMOUS, methods=["GET"])
def report_summary(req: func.HttpRequest) -> func.HttpResponse:
    is_authorized, project_doc = _resolve_auth(req)
    if not is_authorized:
        return func.HttpResponse('Unauthorized', status_code=401)

    project_id = req.params.get('project_id')
    if not project_id and project_doc:
        project_id = project_doc['id']
    if not project_id:
        return func.HttpResponse('project_id required', status_code=400)

    env_filter = req.params.get('env')
    days_param = req.params.get('days', '30')

    cutoff_ts = None
    if days_param.lower() != 'all':
        try:
            days = int(days_param)
            if days <= 0:
                return func.HttpResponse("days must be a positive integer or 'all'", status_code=400)
            cutoff_ts = (
                datetime.now(timezone.utc) - timedelta(days=days)
            ).replace(microsecond=0).isoformat().replace('+00:00', 'Z')
        except ValueError:
            return func.HttpResponse("days must be a positive integer or 'all'", status_code=400)

    now = datetime.now(timezone.utc)

    try:
        if not project_doc or project_doc['id'] != project_id:
            proj_container = get_container('projects')
            project_doc = proj_container.read_item(item=project_id, partition_key=project_id)

        environments = project_doc.get('environments', ['dev'])
        if env_filter:
            if env_filter not in environments:
                return func.HttpResponse(
                    f"Environment '{env_filter}' not found in project", status_code=404
                )
            environments = [env_filter]

        comp_container = get_container('components')
        components = list(comp_container.query_items(
            query='SELECT c.id, c.name, c.excluded_environments FROM c WHERE c.project_id = @pid',
            parameters=[{'name': '@pid', 'value': project_id}],
            enable_cross_partition_query=True
        ))

        plan_container = get_container('plans')
        result_envs = {}

        for env in environments:
            env_counts = {'to_create': 0, 'to_update': 0, 'to_delete': 0, 'unchanged': 0}
            components_out = {}

            for comp in components:
                if env in comp.get('excluded_environments', []):
                    continue

                # Fetch the single latest plan for this component+env regardless of date
                plans = list(plan_container.query_items(
                    query=(
                        "SELECT TOP 1 c.timestamp, c.terraform_plan.resource_changes AS resource_changes "
                        "FROM c WHERE c.component_id = @cid AND c.environment = @env "
                        "AND (NOT IS_DEFINED(c.is_pending_approval) OR c.is_pending_approval = false) "
                        "ORDER BY c.timestamp DESC"
                    ),
                    parameters=[
                        {'name': '@cid', 'value': comp['id']},
                        {'name': '@env', 'value': env},
                    ],
                    enable_cross_partition_query=True
                ))

                if not plans:
                    components_out[comp['name']] = {
                        'last_plan_at': None,
                        'age_days': None,
                        'stale': True,
                        'to_create': None,
                        'to_update': None,
                        'to_delete': None,
                        'unchanged': None,
                        'total': None,
                        'in_sync': None,
                    }
                    continue

                plan = plans[0]
                ts_str = plan.get('timestamp')
                last_plan_at = None
                age_days = None
                stale = False

                if ts_str:
                    try:
                        ts = datetime.fromisoformat(ts_str.replace('Z', '+00:00'))
                        last_plan_at = ts_str
                        age_days = (now - ts).days
                        if cutoff_ts and ts_str < cutoff_ts:
                            stale = True
                    except (ValueError, TypeError):
                        pass

                resource_changes = plan.get('resource_changes') or []
                to_create, to_update, to_delete, unchanged = _classify_actions(resource_changes)
                total = to_create + to_update + to_delete + unchanged

                components_out[comp['name']] = {
                    'last_plan_at': last_plan_at,
                    'age_days': age_days,
                    'stale': stale,
                    'to_create': to_create,
                    'to_update': to_update,
                    'to_delete': to_delete,
                    'unchanged': unchanged,
                    'total': total,
                    'in_sync': (to_create + to_update + to_delete) == 0,
                }

                # Stale components are shown but excluded from the live env rollup
                if not stale:
                    env_counts['to_create'] += to_create
                    env_counts['to_update'] += to_update
                    env_counts['to_delete'] += to_delete
                    env_counts['unchanged'] += unchanged

            env_total = (
                env_counts['to_create'] + env_counts['to_update']
                + env_counts['to_delete'] + env_counts['unchanged']
            )
            alignment_score = (
                round((env_counts['unchanged'] / env_total) * 100) if env_total > 0 else 100
            )

            result_envs[env] = {
                'current_stats': {
                    'alignment_score': alignment_score,
                    'to_create': env_counts['to_create'],
                    'to_update': env_counts['to_update'],
                    'to_delete': env_counts['to_delete'],
                    'unchanged': env_counts['unchanged'],
                    'total': env_total,
                },
                'components': components_out,
            }

        return func.HttpResponse(
            body=json.dumps({
                'project_id': project_id,
                'generated_at': now.isoformat().replace('+00:00', 'Z'),
                'environments': result_envs,
            }),
            status_code=200,
            mimetype='application/json'
        )

    except Exception as e:
        logging.error(f"report_summary error: {e}")
        return func.HttpResponse(f"Error: {e}", status_code=500)


@bp.route(route="report/asset-register", auth_level=func.AuthLevel.ANONYMOUS, methods=["GET"])
def asset_register(req: func.HttpRequest) -> func.HttpResponse:
    is_authorized, project_doc = _resolve_auth(req)
    if not is_authorized:
        return func.HttpResponse('Unauthorized', status_code=401)

    project_id = req.params.get('project_id')
    if not project_id and project_doc:
        project_id = project_doc['id']
    if not project_id:
        return func.HttpResponse('project_id required', status_code=400)

    env = req.params.get('env')
    if not env:
        return func.HttpResponse('env required', status_code=400)

    branch = req.params.get('branch', 'develop')

    try:
        comp_container = get_container('components')
        components = list(comp_container.query_items(
            query='SELECT c.id, c.name, c.excluded_environments FROM c WHERE c.project_id = @pid',
            parameters=[{'name': '@pid', 'value': project_id}],
            enable_cross_partition_query=True
        ))

        plan_container = get_container('plans')
        output = io.StringIO()
        writer = csv.writer(output, quoting=csv.QUOTE_ALL)
        writer.writerow(ASSET_REGISTER_COLUMNS)

        for comp in components:
            if env in comp.get('excluded_environments', []):
                continue

            plans = list(plan_container.query_items(
                query=(
                    "SELECT TOP 1 c.timestamp, c.terraform_plan.resource_changes AS resource_changes "
                    "FROM c WHERE c.component_id = @cid AND c.environment = @env AND c.branch = @branch "
                    "AND (NOT IS_DEFINED(c.is_pending_approval) OR c.is_pending_approval = false) "
                    "ORDER BY c.timestamp DESC"
                ),
                parameters=[
                    {'name': '@cid', 'value': comp['id']},
                    {'name': '@env', 'value': env},
                    {'name': '@branch', 'value': branch},
                ],
                enable_cross_partition_query=True
            ))

            if not plans:
                continue

            plan = plans[0]
            plan_timestamp = plan.get('timestamp', '')
            resource_changes = plan.get('resource_changes') or []

            for rc in resource_changes:
                address = rc.get('address', '')
                # Skip data sources — they reference resources outside this component
                if address.startswith('data.'):
                    continue
                writer.writerow([
                    env,
                    comp['name'],
                    rc.get('resource_group', ''),
                    rc.get('type', ''),
                    rc.get('name', ''),
                    address,
                    plan_timestamp,
                ])

        filename = f"asset-register-{env}-{datetime.now(timezone.utc).strftime('%Y-%m-%d')}.csv"
        return func.HttpResponse(
            body=output.getvalue(),
            status_code=200,
            mimetype='text/csv',
            headers={'Content-Disposition': f'attachment; filename="{filename}"'},
        )

    except Exception as e:
        logging.error(f"asset_register error: {e}")
        return func.HttpResponse(f"Error: {e}", status_code=500)
