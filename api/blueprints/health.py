import azure.functions as func
import json
import os

bp = func.Blueprint()

def get_version():
    try:
        with open("version.txt", "r") as f:
            return f.read().strip()
    except FileNotFoundError:
        try:
            # Fallback if running locally from root, though function usually runs inside api folder
            with open("api/version.txt", "r") as f:
                return f.read().strip()
        except FileNotFoundError:
            return "local"

@bp.route(route="health", auth_level=func.AuthLevel.ANONYMOUS)
def health_check(req: func.HttpRequest) -> func.HttpResponse:
    return func.HttpResponse(
        body=json.dumps({"status": "healthy", "version": get_version()}),
        status_code=200,
        mimetype="application/json"
    )

@bp.route(route="version", auth_level=func.AuthLevel.ANONYMOUS)
def version_check(req: func.HttpRequest) -> func.HttpResponse:
    return func.HttpResponse(
        body=get_version(),
        status_code=200,
        mimetype="text/plain"
    )
