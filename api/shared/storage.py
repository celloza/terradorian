import os
import json
from azure.storage.blob import BlobServiceClient

# Use 'AzureWebJobsStorage' for local dev (which usually points to UseDevelopmentStorage=true or a storage account)
# Or use a specific 'BlobStorageConnection' env var if preferred.
# For local Azurite, "UseDevelopmentStorage=true" is the standard value.

def get_blob_service_client():
    connection_string = os.environ.get("BlobStorageConnection", "UseDevelopmentStorage=true")
    # Azurite might be older than the SDK, so pin the API version to a stable release
    return BlobServiceClient.from_connection_string(connection_string, api_version="2025-01-05")

def upload_plan_blob(plan_data: dict, project_id: str, component_id: str, environment: str, plan_id: str) -> str:
    """
    Uploads a plan JSON to blob storage.
    Returns the Blob URL (or path) for reference.
    Folder Structure: plans/{project_id}/{component_id}/{environment}/{plan_id}.json
    """
    container_name = "plans"
    blob_name = f"{project_id}/{component_id}/{environment}/{plan_id}.json"
    
    blob_service_client = get_blob_service_client()
    container_client = blob_service_client.get_container_client(container_name)
    
    # Ensure container exists
    if not container_client.exists():
        container_client.create_container()
        
    blob_client = container_client.get_blob_client(blob_name)
    
    data_bytes = json.dumps(plan_data).encode('utf-8')
    blob_client.upload_blob(data_bytes, overwrite=True)
    
    return blob_client.url
