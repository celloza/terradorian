locals {
  tags = {
    solution  = "terradorian"
    managedBy = "terraform"
    Owner     = "marcel.dupreez1@nhs.net"
  }
}

resource "azurerm_resource_group" "main" {
  name     = var.resource_group_name
  location = var.location
  tags     = local.tags
}

resource "azurerm_user_assigned_identity" "app_identity" {
  name                = "id-terradorian-${var.environment}"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  tags                = local.tags
}
