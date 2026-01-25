param location string
param environment string
param tags object
param serverFarmId string
param identityId string
param identityClientId string
param storageAccountName string
param cosmosEndpoint string
param funcSubnetId string
param webSubnetId string
param appInsightsConnectionString string
@secure()
param internalSecret string

var functionAppName = 'func-terradorian-${environment}'

resource functionApp 'Microsoft.Web/sites@2022-09-01' = {
  name: functionAppName
  location: location
  tags: tags
  kind: 'functionapp,linux'
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${identityId}': {}
    }
  }
  properties: {
    serverFarmId: serverFarmId
    siteConfig: {
      linuxFxVersion: 'PYTHON|3.12'
      alwaysOn: true
      ipSecurityRestrictions: [
        {
          ipAddress: '188.74.119.19/32'
          action: 'Allow'
          tag: 'Default'
          priority: 100
          name: 'Allow User IP'
        }
        {
          vnetSubnetResourceId: webSubnetId
          action: 'Allow'
          tag: 'Default'
          priority: 200
          name: 'Allow Web App Subnet'
        }
        {
          ipAddress: 'AzureCloud'
          action: 'Allow'
          tag: 'ServiceTag'
          priority: 300
          name: 'Allow Azure Cloud (DevOps)'
        }
      ]
      appSettings: [
        {
          name: 'AzureWebJobsStorage__accountName'
          value: storageAccountName
        }
        {
          name: 'STORAGE_ACCOUNT_NAME'
          value: storageAccountName
        }
        {
          // Enable Managed Identity for Storage Access
          name: 'AzureWebJobsStorage__credential'
          value: 'managedidentity'
        }
        {
          name: 'AzureWebJobsStorage__clientId'
          value: identityClientId
        }
        {
          name: 'CosmosDbConnectionSetting__accountEndpoint'
          value: cosmosEndpoint
        }
        {
          name: 'INTERNAL_SECRET'
          value: internalSecret
        }
        {
          name: 'AZURE_CLIENT_ID'
          value: identityClientId
        }
        {
          name: 'BUILD_FLAGS'
          value: 'UseExpressBuild'
        }
        {
          name: 'SCM_DO_BUILD_DURING_DEPLOYMENT'
          value: 'false' // Disable build during deployment as we are using a pre-built zip
        }
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: appInsightsConnectionString
        }
        {
          name: 'WEBSITE_RUN_FROM_PACKAGE'
          value: 'https://github.com/celloza/terradorian/releases/latest/download/api.zip'
        }
        {
          name: 'XDG_CACHE_HOME'
          value: '/tmp/.cache'
        }
      ]
      healthCheckPath: '/api/health'
      vnetRouteAllEnabled: true
    }
    virtualNetworkSubnetId: funcSubnetId
    httpsOnly: false
  }
}

output functionAppName string = functionApp.name
output functionAppDefaultHostName string = functionApp.properties.defaultHostName
output functionKey string = listKeys('${functionApp.id}/host/default', '2022-03-01').functionKeys.default
