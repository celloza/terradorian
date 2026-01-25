import hashlib
import logging
from shared.db import get_container
from azure.cosmos import exceptions

def verify_pat(token_str: str) -> dict | None:
    """
    Verifies a PAT string format 'tdp_<project_id>_<secret>'.
    Returns the Project Document if valid, None otherwise.
    """
    if not token_str or not token_str.startswith("tdp_"):
        logging.warning("Invalid PAT format")
        return None

    parts = token_str.split("_")
    if len(parts) != 3:
        logging.warning("Invalid PAT structure")
        return None

    project_id = parts[1]
    secret_part = parts[2]
    
    # Reconstruct the token to verify hash
    # Note: web_api.py logic:
    # pat = f"tdp_{project_id}_{random_part}"
    # pat_hash = hashlib.sha256(pat.encode()).hexdigest()
    
    # We must verifying the hash of the FULL token string
    pat_hash = hashlib.sha256(token_str.encode()).hexdigest()

    try:
        container = get_container("projects")
        # Optimization: Fetch partition key directly since we extracted ID
        project_doc = container.read_item(item=project_id, partition_key=project_id)
        
        tokens = project_doc.get('tokens', [])
        for t in tokens:
            if t.get('hash') == pat_hash:
                return project_doc
                
        logging.warning(f"PAT hash not found for project {project_id}")
        return None

    except exceptions.CosmosResourceNotFoundError:
        logging.warning(f"Project {project_id} not found during auth")
        return None
    except Exception as e:
        logging.error(f"Auth error: {e}")
        return None
