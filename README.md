# Terradorian

Terradorian is a comprehensive dashboard platform designed to manage and visualize Terraform drift across multiple projects and environments. It enables engineering teams to maintain infrastructure consistency by ingesting Terraform plans, detecting changes, and tracking drift over time.

## 🚀 Key Features

*   **Multi-Project Management**: Organize infrastructure into Projects and Components.
*   **Drift Detection**: Automatically analyze Terraform plans to detect `create`, `update`, and `delete` actions.
*   **Hybrid Storage**: Efficiently handles large Terraform plans by splitting them between Cosmos DB (metadata) and Blob Storage (full archival).
*   **Stale Plan Protection**: Prevents overwriting valid state with outdated plans.
*   **Visual Dashboard**: Interactive graphs showing drift trends and resource change breakdowns.

## 📚 Documentation

Detailed documentation is available in the `docs/` directory:

*   **[Setup Guide](docs/SETUP.md)**: Instructions for running the full stack locally (Docker, Python, Node.js).
*   **[Architecture](docs/ARCHITECTURE.md)**: Overview of the system design, hybrid storage, and data flow.
*   **[API Reference](docs/API.md)**: Details on the backend API endpoints.

## 🛠️ Quick Start

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

## 🤖 Agent Skills
This repository includes **Agent Skills** in `.agent/skills/`. Future AI agents can use these to understand how to develop and maintain the project.
