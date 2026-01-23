import os
from azure.cosmos import CosmosClient, PartitionKey

def get_container(container_name: str, partition_key_path: str = "/id"):
    connection_string = os.environ["CosmosDbConnectionSetting"]
    client = CosmosClient.from_connection_string(connection_string, connection_verify=False)
    database = client.get_database_client("TerradorianDB")
    
    # helper to ensure container existence
    try:
        database.create_container_if_not_exists(id=container_name, partition_key=PartitionKey(path=partition_key_path))
    except Exception:
        pass
        
    return database.get_container_client(container_name)
