variable "location" {
  description = "The Azure region to deploy to."
  default     = "uksouth"
}

variable "resource_group_name" {
  description = "The name of the resource group."
  default     = "rg-terradorian-dev-001"
}

variable "environment" {
  description = "The environment suffix."
  default     = "dev"
}


variable "subscription_id" {
  description = "The Azure Subscription ID."
  type        = string
}

variable "tenant_id" {
  description = "The Azure Tenant ID."
  type        = string
}
