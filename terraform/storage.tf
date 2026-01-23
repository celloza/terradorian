resource "azurerm_storage_account" "func" {
  name                          = "stterradorian${var.environment}"
  resource_group_name           = azurerm_resource_group.main.name
  location                      = azurerm_resource_group.main.location
  account_tier                  = "Standard"
  account_replication_type      = "LRS"
  account_kind                  = "StorageV2"
  min_tls_version               = "TLS1_2"
  shared_access_key_enabled     = true # Required because Function App currently uses keys for AzureWebJobsStorage
  public_network_access_enabled = true # Enabled to allow container creation from local machine
  tags                          = local.tags
}

resource "azurerm_storage_container" "plans" {
  name                  = "plans"
  storage_account_name  = azurerm_storage_account.func.name
  container_access_type = "private"
}

# Private Endpoint for Blob
resource "azurerm_private_endpoint" "blob" {
  name                = "pe-blob-${var.environment}"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  subnet_id           = azurerm_subnet.pe.id

  private_service_connection {
    name                           = "psc-blob"
    private_connection_resource_id = azurerm_storage_account.func.id
    is_manual_connection           = false
    subresource_names              = ["blob"]
  }

  private_dns_zone_group {
    name                 = "default"
    private_dns_zone_ids = [azurerm_private_dns_zone.blob.id]
  }

  tags = local.tags
}

# RBAC: Allow the Identity to access Blob Data (Owner required for AzureWebJobsStorage with Identity)
resource "azurerm_role_assignment" "blob_data_owner" {
  scope                = azurerm_storage_account.func.id
  role_definition_name = "Storage Blob Data Owner"
  principal_id         = azurerm_user_assigned_identity.app_identity.principal_id
}

resource "azurerm_role_assignment" "storage_account_contributor" {
  scope                = azurerm_storage_account.func.id
  role_definition_name = "Storage Account Contributor"
  principal_id         = azurerm_user_assigned_identity.app_identity.principal_id
}
