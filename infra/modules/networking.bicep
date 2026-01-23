param location string
param environment string
param tags object

var vnetName = 'vnet-terradorian-${environment}'
var funcSubnetName = 'snet-func'
var peSubnetName = 'snet-pe'

resource vnet 'Microsoft.Network/virtualNetworks@2022-07-01' = {
  name: vnetName
  location: location
  tags: tags
  properties: {
    addressSpace: {
      addressPrefixes: ['10.0.0.0/16']
    }
    subnets: [
      {
        name: funcSubnetName
        properties: {
          addressPrefix: '10.0.1.0/24'
          delegations: [
            {
              name: 'delegation'
              properties: {
                serviceName: 'Microsoft.Web/serverFarms'
              }
            }
          ]
        }
      }
      {
        name: peSubnetName
        properties: {
          addressPrefix: '10.0.2.0/24'
        }
      }
    ]
  }
}

// Private DNS Zones
var dnsZones = [
  'privatelink${az.environment().suffixes.storage}'
  'privatelink.documents.azure.com'
  'privatelink${az.environment().suffixes.keyvaultDns}'
]

resource privateDnsZones 'Microsoft.Network/privateDnsZones@2020-06-01' = [for zone in dnsZones: {
  name: zone
  location: 'global'
  tags: tags
}]

resource vnetLinks 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = [for (zone, i) in dnsZones: {
  parent: privateDnsZones[i]
  name: 'link-${vnetName}'
  location: 'global'
  tags: tags
  properties: {
    registrationEnabled: false
    virtualNetwork: {
      id: vnet.id
    }
  }
}]

output vnetId string = vnet.id
output funcSubnetId string = resourceId('Microsoft.Network/virtualNetworks/subnets', vnetName, funcSubnetName)
output peSubnetId string = resourceId('Microsoft.Network/virtualNetworks/subnets', vnetName, peSubnetName)
output privateDnsZoneIds object = {
  blob: privateDnsZones[0].id
  cosmos: privateDnsZones[1].id
  vault: privateDnsZones[2].id
}
