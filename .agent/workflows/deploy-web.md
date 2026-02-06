---
description: How to deploy the Next.js Web App to Azure using GitHub Releases
---
# Azure Web App Deployment (Release & Restart)

This workflow describes how to deploy the Terradorian Web App to Azure by creating a GitHub Release and restarting the App Service.

## Prerequisites
- GitHub CLI (`gh`) authenticated.
- Azure CLI (`az`) authenticated.
- Semantic Versioning (check `git tag`).

## Steps

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
   - Create a release tag. This triggers the GitHub Action `build-release.yml`.
   ```powershell
   // turbo
   gh release create v0.0.x --generate-notes
   ```

4. **Monitor Build**
   - **CRITICAL**: Wait for the GitHub Action to complete successfully. The Web App needs the built artifacts from this run.
   ```powershell
   gh run list
   gh run watch <RUN_ID> --exit-status
   ```

5. **Restart Web App**
   - Restarting the app forces it to re-download the package from the GitHub Release URL (via `WEBSITE_RUN_FROM_PACKAGE`).
   ```powershell
   // turbo
   az webapp restart --name web-terradorian-dev --resource-group terradorian
   ```

6. **Verify**
   - Visit the web app URL.
   - Check `Settings` or `Console` for the new version number.
