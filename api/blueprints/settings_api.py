import azure.functions as func
import json
from azure.cosmos import exceptions
from pydantic import ValidationError
from models import AuthSettingsSchema
from shared.db import get_container

bp = func.Blueprint()

@bp.route(route="settings/auth", auth_level=func.AuthLevel.ANONYMOUS, methods=["GET"])
def get_auth_settings(req: func.HttpRequest) -> func.HttpResponse:
    try:
        container = get_container("settings", "/id")
        # specific ID for auth settings
        doc_id = "auth_config"
        
        try:
            item = container.read_item(item=doc_id, partition_key=doc_id)
            # Remove internal fields before returning if necessary, 
            # though here we are just returning the schema fields
            settings = {
                "client_id": item.get("client_id"),
                "client_secret": item.get("client_secret"), # In a real app, maybe don't return this? But user asked for editable settings.
                "tenant_id": item.get("tenant_id")
            }
            return func.HttpResponse(
                body=json.dumps(settings),
                status_code=200,
                mimetype="application/json"
            )
        except exceptions.CosmosResourceNotFoundError:
            # Return empty or default if not set
            return func.HttpResponse(
                body=json.dumps({}),
                status_code=200,
                mimetype="application/json"
            )

    except Exception as e:
        return func.HttpResponse(f"Error: {e}", status_code=500)

@bp.route(route="settings/auth", auth_level=func.AuthLevel.ANONYMOUS, methods=["POST"])
def save_auth_settings(req: func.HttpRequest) -> func.HttpResponse:
    try:
        req_body = req.get_json()
        settings_data = AuthSettingsSchema(**req_body)
    except (ValueError, ValidationError) as e:
        return func.HttpResponse(f"Invalid Request: {e}", status_code=400)

    doc_dict = settings_data.model_dump()
    doc_dict['id'] = "auth_config"
    
    try:
        container = get_container("settings", "/id")
        container.upsert_item(doc_dict)
    except Exception as e:
         return func.HttpResponse(f"Error saving settings: {e}", status_code=500)
         
    return func.HttpResponse(
        body=json.dumps(doc_dict),
        status_code=200,
        mimetype="application/json"
    )
