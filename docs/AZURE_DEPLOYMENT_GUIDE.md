# Azure Deployment Guide & Troubleshooting

This document details the specific configurations required to run the Terradorian **Next.js Web App** and **Python Function App** securely on Azure. It documents "battle-tested" fixes for common issues encountered during deployment.

## 1. Next.js on Azure App Service (Linux)

Deploying Next.js to Azure App Service Linux using the standalone output requires specific handling.

### Build Configuration (`server.js`)
We use the **Standalone** output mode to create a strictly minimal production package.
- **Why?**: Reduces deployment size and dependency complexity.
- **How**: `output: "standalone"` in `next.config.ts`.

**Important Nuance**: The standalone build *does not* include the `public/` folder or `.next/static/` assets by default. You **MUST** copy them manually in your CI/CD pipeline.

```yaml
# .github/workflows/build-release.yml
- name: Package Web App
  run: |
    # ... build ...
    mkdir -p package/.next/static
    mkdir -p package/public
    # Copy standalone server
    cp -r .next/standalone/. package/
    # Copy static assets (Crucial for CSS/Images)
    cp -r public/* package/public/
    cp -r .next/static/* package/.next/static/
```

### Startup Command
Azure defaults can sometimes fail to start Next.js correctly. We deliberately force the startup command:
- **Command**: `node server.js`
- **Location**: `infra/modules/webapp.bicep` (`appCommandLine`).

## 2. Authentication (NextAuth.js v5)

Running NextAuth.js behind Azure App Service's load balancer requires proxy configuration to prevent redirect loops and internal hostname leaks.

### Proxy Configuration
- **`AUTH_TRUST_HOST: 'true'`**: Tells NextAuth to trust the `X-Forwarded-Host` headers from Azure. Without this, strictly secure cookies might fail or redirects may break.
- **`NEXTAUTH_URL`**: Must be set to the **public HTTPS URL** (e.g., `https://web-terradorian-dev.azurewebsites.net`).
    - **Fix for Internal Hostname Leak**: In `middleware.ts`, we explicitly use `process.env.NEXTAUTH_URL` for redirects. If we rely on `req.url`, Azure might pass the internal container hostname (`http://f12c...:8080`), causing a redirect loop or 500 error.

### Cookie Name Mismatch (Infinite Login Loop)
**The Issue**: NextAuth v5 (Beta) defaults to `authjs.session-token`, but the `getToken()` helper (from `next-auth/jwt` compatibility layer) often looks for `next-auth.session-token`.
**The Fix**: Explicitly force the legacy cookie name in `web/auth.ts`.

```typescript
// web/auth.ts
export const { handlers, auth } = NextAuth({
    cookies: {
        sessionToken: {
            name: `next-auth.session-token`, // Force legacy name
            options: { httpOnly: true, sameSite: 'lax', path: '/', secure: true }
        }
    }
})
```

## 3. Secure Networking (Web -> Function)

We restrict the **Function App** to only accept traffic from:
1.  **Your Developer IP** (for debugging).
2.  **The Web App** (internal traffic).

### Architecture
- **VNet**: `vnet-terradorian-dev`
- **Subnet 1**: `snet-func` (Function App delegation)
- **Subnet 2**: `snet-web` (Web App delegation + **Service Endpoint**)

### The "ECONNRESET" Fix (VNet Routing)
If you enable Access Restrictions on the Function App, the Web App will fail to connect with `ECONNRESET` unless strictly configured.

**Critical Requirements**:
1.  **VNet Integration**: The Web App must be integrated into `snet-web`.
2.  **Service Endpoint**: `snet-web` **MUST** have `Microsoft.Web` service endpoint enabled in `networking.bicep`. Without this, the Function App cannot cryptographically verify the traffic source subnet.
3.  **`vnetRouteAllEnabled: true`**: This is the most common pitfall. By default, Azure App Service only routes private IPs (RFC1918) into the VNet.
    - Because the Web App calls the Function App via its **Public DNS** (`func-....azurewebsites.net`), Azure treats it as "Internet" traffic and sends it via the Public Outbound IP.
    - The Function App BLOCKS this Public IP (because we enabled Access Restrictions).
    - **Fix**: Set `vnetRouteAllEnabled: true` in `webapp.bicep`. This forces **ALL** outbound traffic to go through the VNet, forcing it to use the Service Endpoint path, which allows it to pass the allow rule.

```bicep
// infra/modules/webapp.bicep
siteConfig: {
    vnetRouteAllEnabled: true // CRITICAL for Access Restrictions
}
```

## 4. Version Logging
To verify deployments, we inject the git tag at build time:
1.  **Workflow**: Writes `{"version": "v1.0.0"}` to `version.json` in the root of the package.
2.  **Instrumentation**: `web/instrumentation.ts` logs this on server startup.
