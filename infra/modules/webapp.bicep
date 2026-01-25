param location string
param environment string
param tags object
param serverFarmId string
param webSubnetId string
param apiKey string
// param webSubnetId string // Optional if we want VNet integration later

param apiUrl string
param appInsightsConnectionString string

var webAppName = 'web-terradorian-${environment}'

resource webApp 'Microsoft.Web/sites@2022-09-01' = {
  name: webAppName
  location: location
  tags: tags
  kind: 'app,linux'
  properties: {
    serverFarmId: serverFarmId
    virtualNetworkSubnetId: webSubnetId
    siteConfig: {
      linuxFxVersion: 'NODE|20-lts' // Next.js requires Node
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
          name: 'API_KEY'
          value: apiKey
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

output webAppName string = webApp.name
output webAppDefaultHostName string = webApp.properties.defaultHostName
