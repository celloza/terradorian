---
description: How to deploy the Next.js Web App to Azure using GitHub Releases
---
# Azure Stack Deployment (Release & Restart)

This workflow describes how to deploy the Terradorian **Web App** and **API** to Azure by creating a GitHub Release.
Both services are configured with `WEBSITE_RUN_FROM_PACKAGE`, pointing to the artifacts (`web.zip` and `api.zip`) attached to the latest release.

## Prerequisites
- GitHub CLI (`gh`) authenticated.
- Azure CLI (`az`) authenticated.
- Semantic Versioning (check `git tag`).

## Automated Deployment (Recommended)

Run the PowerShell automation script to handle versioning, committing, releasing, and restarting.

### 1. Setup
1. Copy `tools/deploy.config.sample.json` to `tools/deploy.config.json`.
2. Fill in your Azure Resource Group and App Names.

### 2. Run Script
```powershell
.\tools\deploy.ps1 -Message "Refactored user dashboard"
```
This single command will:
- Check Git status.
- Bump the patch version (e.g., `0.0.53` -> `0.0.54`).
- Commit and Push.
- Create GitHub Release.
- Wait for Build.
- Restart Azure Apps.

## Manual Deployment Steps
If you need to deploy manually or debug the process:

1. **Update Version**
   - Check current tags: `git tag --sort=-creatordate`
   - Increment version in `web/package.json`.

2. **Commit Changes**
   - Use semantic commit message: `feat: description (v0.0.x)`
   ```powershell
   git add .
   git commit -S -m "feat: description (v0.0.x)"
   git push
   ```

3. **Create GitHub Release**
   - Create a release tag. This triggers the GitHub Action `build-release.yml` which builds and uploads `web.zip` and `api.zip`.
   ```powershell
   // turbo
   gh release create v0.0.x --generate-notes
   ```

4. **Monitor Build**
   - **CRITICAL**: Wait for the GitHub Action to complete successfully.
   ```powershell
   gh run list
   gh run watch <RUN_ID> --exit-status
   ```

5. **Restart Services**
   - Restarting the apps forces them to re-download the package from the GitHub Release URL.
   ```powershell
   // turbo
   az webapp restart --name web-terradorian-dev --resource-group terradorian
   az webapp restart --name func-terradorian-dev --resource-group terradorian
   ```

6. **Verify**
   - Visit the web app URL.
   - Check `Settings` or `Console` for the new version number.
   - Verify API calls (e.g. data in Dashboard).
