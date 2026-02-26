import os
import json
from azure.storage.blob import BlobServiceClient

# Use 'AzureWebJobsStorage' for local dev (which usually points to UseDevelopmentStorage=true or a storage account)
# Or use a specific 'BlobStorageConnection' env var if preferred.
# For local Azurite, "UseDevelopmentStorage=true" is the standard value.

from azure.identity import DefaultAzureCredential

def get_blob_service_client():
    connection_string = os.environ.get("BlobStorageConnection")
    
    if connection_string:
         return BlobServiceClient.from_connection_string(connection_string)
         
    # Fallback/Primary for Azure: Use Managed Identity
    # We need the storage account URL.
    # In Bicep we set AzureWebJobsStorage__accountName, but we might not have it as a clear env var for general use?
    # Actually, let's just construct it or expect an env var.
    # Checking Bicep again... we have 'AzureWebJobsStorage__accountName' which is specific to Functions runtime.
    # Let's add STORAGE_ACCOUNT_NAME to Bicep, effectively.
    # OR, safely infer it from the AzureWebJobsStorage__accountName if possible, but that's risky if format changes.
    
    # Better: Use a dedicated env var 'STORAGE_ACCOUNT_NAME'
    account_name = os.environ.get("STORAGE_ACCOUNT_NAME")
    if account_name:
        account_url = f"https://{account_name}.blob.core.windows.net"
        return BlobServiceClient(account_url=account_url, credential=DefaultAzureCredential())
        
    # Last Resort (Local Dev default)
    # Azurite often lags behind the latest API version. We pin it to a stable recent version supported by Azurite 3.x
    return BlobServiceClient.from_connection_string("UseDevelopmentStorage=true", api_version="2019-12-12")

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

def delete_plan_blob(blob_url: str) -> None:
    """
    Deletes a plan JSON from blob storage given its URL.
    """
    if not blob_url:
        return
        
    try:
        # Extract blob name from URL
        # URL format: https://<account_name>.blob.core.windows.net/plans/<blob_name>
        container_name = "plans"
        # Find where 'plans/' starts and take everything after it
        parts = blob_url.split(f"{container_name}/")
        if len(parts) > 1:
            blob_name = parts[1]
            blob_service_client = get_blob_service_client()
            container_client = blob_service_client.get_container_client(container_name)
            blob_client = container_client.get_blob_client(blob_name)
            
            if blob_client.exists():
                blob_client.delete_blob()
    except Exception as e:
        import logging
        logging.error(f"Failed to delete blob {blob_url}: {e}")
        # We don't want a blob deletion failure to stop the DB deletion, so we swallow it here usually
