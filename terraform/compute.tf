resource "azurerm_service_plan" "main" {
  name                = "asp-terradorian-${var.environment}"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  os_type             = "Linux"
  sku_name            = "B1"
  tags                = local.tags
}

resource "azurerm_linux_function_app" "main" {
  name                = "func-terradorian-${var.environment}"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location

  storage_account_name          = azurerm_storage_account.func.name
  storage_uses_managed_identity = true
  service_plan_id               = azurerm_service_plan.main.id

  # Using Managed Identity for Storage Access (AzureWebJobsStorage)
  # This requires the Identity to have 'Storage Blob Data Owner' on the storage account.

  site_config {
    application_stack {
      python_version = "3.11"
    }
    vnet_route_all_enabled = true
  }

  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.app_identity.id]
  }

  app_settings = {
    "AzureWebJobsStorage__accountName"           = azurerm_storage_account.func.name
    "CosmosDbConnectionSetting__accountEndpoint" = azurerm_cosmosdb_account.main.endpoint
    "AZURE_CLIENT_ID"                            = azurerm_user_assigned_identity.app_identity.client_id
    "BUILD_FLAGS"                                = "UseExpressBuild"
    "ENABLE_ORYX_BUILD"                          = "true"
    "SCM_DO_BUILD_DURING_DEPLOYMENT"             = "true"
    "XDG_CACHE_HOME"                             = "/tmp/.cache"
  }
  tags = local.tags
}

resource "azurerm_app_service_virtual_network_swift_connection" "main" {
  app_service_id = azurerm_linux_function_app.main.id
  subnet_id      = azurerm_subnet.func.id
}
