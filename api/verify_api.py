import requests
import json
import os
from azure.cosmos import CosmosClient

# Config - Assuming local settings for direct Cosmos access
# In a real scenario, we might read from local.settings.json or env vars.
# For verification, we'll hardcode the known emulator key and endpoint 
# matching the docker command and local.settings.json.
COSMOS_ENDPOINT = "https://localhost:8081/"
COSMOS_KEY = "C2y6yDjf5/R+ob0N8A7Cgv30VRDJIWEHLM+4QDU5DE2nQ9nDuVTqobD4b8mGGyPMbIZnqyMsEcaGQy67XIw/Jw=="
DATABASE_NAME = "TerradorianDB"
CONTAINER_NAME = "plans"

API_BASE_URL = "http://localhost:7071/api"

def get_cosmos_container():
    client = CosmosClient(COSMOS_ENDPOINT, credential=COSMOS_KEY, connection_verify=False)
    database = client.get_database_client(DATABASE_NAME)
    container = database.get_container_client(CONTAINER_NAME)
    return container

def verify_ingestion():
    print("--- Verifying Ingestion ---")
    payload = {
        "project_name": "VerifyProject",
        "component_name": "VerifyComponent",
        "environment": "verify-env",
        "terraform_plan": {"test": "data"}
    }
    
    response = requests.post(f"{API_BASE_URL}/ingest_plan", json=payload)
    if response.status_code == 201:
        data = response.json()
        print(f"SUCCESS: Ingested plan with ID: {data['id']}")
        return data['id']
    else:
        print(f"FAILURE: Status {response.status_code}, Body: {response.text}")
        return None

def verify_cosmos_persistence(plan_id):
    print(f"--- Verifying Cosmos Persistence for ID: {plan_id} ---")
    container = get_cosmos_container()
    try:
        # We assume partition key is the ID based on our delete logic assumption.
        # If the container was created by the binding without explicit partition key def, 
        # it might default to /id or something else.
        # Let's try to read it.
        item = container.read_item(item=plan_id, partition_key=plan_id)
        print(f"SUCCESS: Item found in Cosmos DB. Timestamp: {item.get('timestamp')}")
        return True
    except Exception as e:
        print(f"FAILURE: Could not read item from Cosmos DB: {e}")
        return False

def verify_delete(plan_id):
    print(f"--- Verifying Delete for ID: {plan_id} ---")
    response = requests.delete(f"{API_BASE_URL}/delete_plan/{plan_id}")
    if response.status_code == 204:
        print("SUCCESS: Delete request returned 204.")
    else:
        print(f"FAILURE: Delete Status {response.status_code}, Body: {response.text}")

    # Double check persistence
    container = get_cosmos_container()
    try:
        container.read_item(item=plan_id, partition_key=plan_id)
        print("FAILURE: Item still exists in Cosmos DB after delete.")
    except Exception:
        print("SUCCESS: Item verified as deleted from Cosmos DB (NotFound).")

if __name__ == "__main__":
    # Ensure dependencies like requests/azure-cosmos are installed in the venv running this.
    try:
        plan_id = verify_ingestion()
        if plan_id:
            if verify_cosmos_persistence(plan_id):
                verify_delete(plan_id)
    except Exception as e:
        print(f"An error occurred: {e}")
