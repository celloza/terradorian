# Deploy to Azure

You can deploy the Terradorian infrastructure directly to Azure using the button below.

[![Deploy to Azure](https://aka.ms/deploytoazurebutton)](https://portal.azure.com/#create/Microsoft.Template/uri/https%3A%2F%2Fraw.githubusercontent.com%2Fcelloza%2Fterradorian%2Fmain%2Finfra%2Fazuredeploy.json)

## Prerequisites
1.  **GitHub Repository**: This repository must be public (or you need a SAS token for the template, typically raw.githubusercontent links work for public repos).
2.  **App Service & Static Assets**: The "Deploy to Azure" button deploys the *infrastructure*. The application code (API and Web) is deployed via GitHub Actions.
    - The Bicep template configures the apps to run directly from the `latest` GitHub Release artifacts (`api.zip` and `web.zip`).
    - After the infrastructure deployment completes, ensure a Release exists on GitHub.

## Steps
1.  Click the button above.
2.  Select your Subscription and Resource Group (or create new).
3.  Click **Review + create**.
4.  **Important**: Because the deployment is configured to pull artifacts from the `latest` GitHub Release (`api.zip` and `web.zip`), you should create a Release *before* or *immediately after* the infrastructure is provisioned so the apps have something to run.
