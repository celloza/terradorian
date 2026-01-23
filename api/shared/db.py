import os
from azure.cosmos import CosmosClient, PartitionKey
from azure.identity import DefaultAzureCredential

def get_container(container_name: str, partition_key_path: str = "/id"):
    conn_str = os.environ.get("CosmosDbConnectionSetting")
    
    if conn_str:
        # Emulator / Key-based
        client = CosmosClient.from_connection_string(conn_str, connection_verify=False)
    else:
        # Managed Identity
        endpoint = os.environ.get("CosmosDbConnectionSetting__accountEndpoint")
        if not endpoint:
            raise ValueError("No Cosmos DB connection string or endpoint found")
            
        credential = DefaultAzureCredential()
        client = CosmosClient(url=endpoint, credential=credential)

    database = client.create_database_if_not_exists(id="TerradorianDB")
    
    # helper to ensure container existence
    try:
        database.create_container_if_not_exists(id=container_name, partition_key=PartitionKey(path=partition_key_path))
    except Exception:
        pass
        
    return database.get_container_client(container_name)
