param location string = resourceGroup().location
param environment string = 'dev'
param tags object = {
  solution: 'terradorian'
  managedBy: 'bicep'
}

// 1. Networking
module networking 'modules/networking.bicep' = {
  name: 'networking'
  params: {
    location: location
    environment: environment
    tags: tags
  }
}

// 2. Identity (Shared)
resource appIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2018-11-30' = {
  name: 'id-terradorian-${environment}'
  location: location
  tags: tags
}

// 3. Storage
module storage 'modules/storage.bicep' = {
  name: 'storage'
  params: {
    location: location
    environment: environment
    tags: tags
    peSubnetId: networking.outputs.peSubnetId
    privateDnsZoneId: networking.outputs.privateDnsZoneIds.blob
    principalId: appIdentity.properties.principalId
  }
}

// 4. Cosmos DB
module cosmos 'modules/cosmos.bicep' = {
  name: 'cosmos'
  params: {
    location: location
    environment: environment
    tags: tags
    peSubnetId: networking.outputs.peSubnetId
    privateDnsZoneId: networking.outputs.privateDnsZoneIds.cosmos
    principalId: appIdentity.properties.principalId
  }
}

// 5. Key Vault
module keyvault 'modules/keyvault.bicep' = {
  name: 'keyvault'
  params: {
    location: location
    environment: environment
    tags: tags
    peSubnetId: networking.outputs.peSubnetId
    privateDnsZoneId: networking.outputs.privateDnsZoneIds.vault
    principalId: appIdentity.properties.principalId
    tenantId: subscription().tenantId
  }
}

// 6. Application Insights
module appinsights 'modules/appinsights.bicep' = {
  name: 'appinsights'
  params: {
    location: location
    environment: environment
    tags: tags
  }
}

// 7. App Service Plan (Shared)
resource serverFarm 'Microsoft.Web/serverfarms@2022-03-01' = {
  name: 'asp-terradorian-${environment}'
  location: location
  tags: tags
  sku: {
    name: 'B1'
  }
  kind: 'linux'
  properties: {
    reserved: true
  }
}

// 7. Function App (API)
module function 'modules/function.bicep' = {
  name: 'function'
  params: {
    location: location
    environment: environment
    tags: tags
    serverFarmId: serverFarm.id
    identityId: appIdentity.id
    identityClientId: appIdentity.properties.clientId
    storageAccountName: storage.outputs.storageAccountName
    cosmosEndpoint: cosmos.outputs.accountEndpoint
    funcSubnetId: networking.outputs.funcSubnetId
    appInsightsConnectionString: appinsights.outputs.connectionString
  }
}

// 8. Web App (Frontend)
module webapp 'modules/webapp.bicep' = {
  name: 'webapp'
  params: {
    location: location
    environment: environment
    tags: tags
    serverFarmId: serverFarm.id
    apiUrl: 'https://${function.outputs.functionAppDefaultHostName}/api'
  }
}

output functionAppName string = function.outputs.functionAppName
output functionDefaultHostName string = function.outputs.functionAppDefaultHostName
output webAppName string = webapp.outputs.webAppName
output webAppDefaultHostName string = webapp.outputs.webAppDefaultHostName
