# Local Development Setup

## Prerequisites
*   **Docker Desktop**: Running.
*   **Node.js**: v18+.
*   **Python**: v3.11+.
*   **Azure Functions Core Tools**: v4+.
*   **Azurite**: For Blob Storage emulation.
*   **Azure Cosmos DB Emulator**: (Linux Docker container recommended).

## 1. Start Infrastructure (Docker)

Run the following commands to start Cosmos DB emulator and Azurite:

```powershell
# Start Cosmos DB Emulator (Linux container)
docker run -p 8081:8081 -p 10251:10251 -p 10252:10252 -p 10253:10253 -p 10254:10254 -m 3g --cpus=2.0 --name=cosmosdb-linux-emulator -e AZURE_COSMOS_EMULATOR_PARTITION_COUNT=10 -e AZURE_COSMOS_EMULATOR_ENABLE_DATA_PERSISTENCE=true -e AZURE_COSMOS_EMULATOR_IP_ADDRESS_OVERRIDE=127.0.0.1 -d mcr.microsoft.com/cosmosdb/linux/azure-cosmos-emulator

# Start Azurite (Blob Storage)
docker run -p 10000:10000 -p 10001:10001 -p 10002:10002 --name azurite -d mcr.microsoft.com/azure-storage/azurite azurite-blob --blobHost 0.0.0.0 --blobPort 10000
```

*Note: If Cosmos DB fails to start due to certificate issues, ensure you've installed the emulator certificate.*

## 2. Backend Setup (`api/`)

```powershell
cd api
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt

# Start the Functions
func start
```
The backend runs on `http://localhost:7071`.

### Core Tools Compatibility Note (Python 3.11/3.12)
If your system's global `func` tool is outdated (v4.0.x) and doesn't support Python 3.11+, you can use the local `tools/` directory setup:
```powershell
..\tools\node_modules\.bin\func start
```


## 3. Frontend Setup (`web/`)

```powershell
cd web
npm install

# Start Next.js
npm run dev
```
The frontend runs on `http://localhost:3000`.

## 4. Validating Ingestion

You can use the `manual_tests/test_ingest.py` script (if you restored it) or simply use the UI:
1.  Go to `http://localhost:3000`.
2.  Create a Project and Component.
3.  Go to the Component page.
4.  Click "Upload Plan" and select a JSON file from `samples/`.
