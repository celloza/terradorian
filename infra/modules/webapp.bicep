param location string
param environment string
param tags object
param serverFarmId string
param webSubnetId string
@secure()
param internalSecret string
// param apiKey string // Deprecated in favor of internalSecret (PAT model)

param apiUrl string
param appInsightsConnectionString string
param easyAuthTenantId string = ''
param easyAuthClientId string = ''

var webAppName = 'web-terradorian-${environment}'
var enableEasyAuth = !empty(easyAuthTenantId) && !empty(easyAuthClientId)

resource webApp 'Microsoft.Web/sites@2022-09-01' = {
  name: webAppName
  location: location
  tags: tags
  kind: 'app,linux'
  properties: {
    serverFarmId: serverFarmId
    virtualNetworkSubnetId: webSubnetId
    siteConfig: {
      linuxFxVersion: 'NODE|24-lts' // Next.js requires Node
      appCommandLine: 'node server.js' // Next.js standalone output uses server.js
      alwaysOn: true
      vnetRouteAllEnabled: true
      ipSecurityRestrictions: [
        {
          ipAddress: '188.74.119.19/32'
          action: 'Allow'
          tag: 'Default'
          priority: 100
          name: 'Allow User IP'
        }
      ]
      appSettings: [
        {
          name: 'WEBSITE_RUN_FROM_PACKAGE'
          value: 'https://github.com/celloza/terradorian/releases/latest/download/web.zip'
        }
        {
          name: 'API_URL'
          value: apiUrl
        }
        {
          name: 'INTERNAL_SECRET'
          value: internalSecret
        }
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: appInsightsConnectionString
        }
        {
          name: 'ApplicationInsightsAgent_EXTENSION_VERSION'
          value: '~3'
        }
        {
          name: 'AUTH_SECRET'
          value: 'terradorian-dev-secret-key-123' // Change this in production
        }
        {
          name: 'NEXTAUTH_SECRET'
          value: 'terradorian-dev-secret-key-123'
        }
        {
          name: 'AUTH_TRUST_HOST'
          value: 'true'
        }
        {
          name: 'NEXTAUTH_URL'
          value: 'https://${webAppName}.azurewebsites.net'
        }
      ]
      healthCheckPath: '/health'
    }
    httpsOnly: true
  }
}

resource webAppAuthSettingsV2 'Microsoft.Web/sites/config@2022-09-01' = if (enableEasyAuth) {
  name: 'authsettingsV2'
  parent: webApp
  properties: {
    platform: {
      enabled: true
      runtimeVersion: '~1'
    }
    globalValidation: {
      requireAuthentication: true
      unauthenticatedClientAction: 'RedirectToLoginPage'
      redirectToProvider: 'azureactivedirectory'
    }
    httpSettings: {
      requireHttps: true
      routes: {
        apiPrefix: '/.auth'
      }
      forwardProxy: {
        convention: 'NoProxy'
      }
    }
    identityProviders: {
      azureActiveDirectory: {
        enabled: true
        registration: {
          clientId: easyAuthClientId
          openIdIssuer: '${az.environment().authentication.loginEndpoint}${easyAuthTenantId}/v2.0'
        }
        login: {
          disableWWWAuthenticate: false
        }
      }
      apple: {
        enabled: false
      }
      facebook: {
        enabled: false
      }
      gitHub: {
        enabled: false
      }
      google: {
        enabled: false
      }
      legacyMicrosoftAccount: {
        enabled: false
      }
      twitter: {
        enabled: false
      }
    }
    login: {
      preserveUrlFragmentsForLogins: false
      tokenStore: {
        enabled: false
      }
      routes: {
        logoutEndpoint: '/.auth/logout'
      }
    }
  }
}

output webAppName string = webApp.name
output webAppDefaultHostName string = webApp.properties.defaultHostName
