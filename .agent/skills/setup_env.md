---
name: setup_env
description: Instructions for setting up the Terradorian development environment from scratch, including Docker containers for Azure emulators.
---

# Setup Development Environment

Use this skill to set up the local development environment for Terradorian.

## 1. Start Docker Containers

The project relies on local emulators for Azure Cosmos DB and Azure Blob Storage (Azurite).

### Azure Cosmos DB Emulator (Linux Container)
Run the following command to start the Cosmos DB emulator. Note: This uses the Linux container which is generally lighter.

```powershell
docker run -p 8081:8081 -p 10251:10251 -p 10252:10252 -p 10253:10253 -p 10254:10254 -m 3g --cpus=2.0 --name=cosmosdb-linux-emulator -e AZURE_COSMOS_EMULATOR_PARTITION_COUNT=10 -e AZURE_COSMOS_EMULATOR_ENABLE_DATA_PERSISTENCE=true -e AZURE_COSMOS_EMULATOR_IP_ADDRESS_OVERRIDE=127.0.0.1 -d mcr.microsoft.com/cosmosdb/linux/azure-cosmos-emulator
```

### Azurite (Blob Storage)
Run the following command to start Azurite.

```powershell
docker run -p 10000:10000 -p 10001:10001 -p 10002:10002 --name azurite -d mcr.microsoft.com/azure-storage/azurite azurite-blob --blobHost 0.0.0.0 --blobPort 10000
```

## 2. API Setup (Backend)

The backend is an Azure Functions app (Python).

```powershell
cd api
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
func start
```

## 3. Web Setup (Frontend)

The frontend is a Next.js application.

```powershell
cd web
npm install
npm run dev
```

## Verification

Once running:
- **Frontend**: http://localhost:3000
- **Backend**: http://localhost:7071
- **Cosmos DB Explorer**: https://localhost:8081/_explorer/index.html
