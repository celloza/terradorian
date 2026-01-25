import azure.functions as func
import json

bp = func.Blueprint()

@bp.route(route="health", auth_level=func.AuthLevel.ANONYMOUS)
def health_check(req: func.HttpRequest) -> func.HttpResponse:
    return func.HttpResponse(
        body=json.dumps({"status": "healthy", "version": "v0.0.16"}),
        status_code=200,
        mimetype="application/json"
    )
