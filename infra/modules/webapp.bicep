param location string
param environment string
param tags object
param serverFarmId string
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
    reserved: true // Required for Linux
    siteConfig: {
      linuxFxVersion: 'NODE|20-lts' // Next.js requires Node
      appCommandLine: 'node server.js' // Next.js standalone output uses server.js
      alwaysOn: false // B1 sku supports AlwaysOn? B1 yes. But keep cost low?
      appSettings: [
        {
          name: 'WEBSITE_RUN_FROM_PACKAGE'
          value: 'https://github.com/celloza/terradorian/releases/latest/download/web.zip'
        }
        {
          value: apiUrl
        }
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: appInsightsConnectionString
        }
        {
          name: 'ApplicationInsightsAgent_EXTENSION_VERSION'
          value: '~3'
        }
      ]
    }
    httpsOnly: true
  }
}

output webAppName string = webApp.name
output webAppDefaultHostName string = webApp.properties.defaultHostName
