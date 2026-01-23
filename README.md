# Terradorian

Terradorian is a comprehensive dashboard platform designed to manage and visualize Terraform drift across multiple projects and environments. It enables engineering teams to maintain infrastructure consistency by ingesting Terraform plans, detecting changes, and tracking drift over time.

## 🚀 Key Features

*   **Multi-Project Management**: Organize infrastructure into Projects and Components.
*   **Drift Detection**: Automatically analyze Terraform plans to detect `create`, `update`, and `delete` actions.
*   **Hybrid Storage**: Handles large Terraform plans by splitting them between Cosmos DB (metadata) and Blob Storage (full archival).
*   **Visual Dashboard**: Interactive graphs showing drift trends and resource change breakdowns.
*   **API Integration**: Exposes an API to allow for CICD solutions to push plan files to the dashboard for analysis.
*   **Resource Explorer**: Explore resources and their attributes.

## 📚 Documentation

Detailed documentation is available in the `docs/` directory:

*   **[Setup Guide](docs/SETUP.md)**: Instructions for running the full stack locally (Docker, Python, Node.js).
*   **[Architecture](docs/ARCHITECTURE.md)**: Overview of the system design, hybrid storage, and data flow.
*   **[API Reference](docs/API.md)**: Details on the backend API endpoints.

## 🛠️ Quick Start (Local)

1.  **Start Dependencies** (Cosmos DB & Azurite):
    ```powershell
    # See docs/SETUP.md for full Docker commands
    ```

2.  **Start Backend** (`api/`):
    ```powershell
    cd api
    func start
    ```

3.  **Start Frontend** (`web/`):
    ```powershell
    cd web
    npm run dev
    ```

## ☁️ Deploy to Azure

You can deploy the Terradorian infrastructure directly to Azure using the button below.

[![Deploy to Azure](https://aka.ms/deploytoazurebutton)](https://portal.azure.com/#create/Microsoft.Template/uri/https%3A%2F%2Fraw.githubusercontent.com%2Fcelloza%2Fterradorian%2Fmain%2Finfra%2Fazuredeploy.json)

### Steps
1.  Click the button above.
2.  Select your Subscription and Resource Group.
3.  Click **Review + create**.

## 🤖 Agent Skills
This repository includes **Agent Skills** in `.agent/skills/`. Future AI agents can use these to understand how to develop and maintain the project.
