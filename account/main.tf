terraform {
  required_version = ">= 1.5.0"
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.80"
    }
  }
}

provider "azurerm" {
  features {}
}

# --- Reuse your existing resource group instead of creating a new one, ---
# --- if you want Ledger to live alongside the maintenance app's RG.    ---
resource "azurerm_resource_group" "ledger" {
  name     = "rg-ledger-prod"
  location = "East US 2"
}

resource "azurerm_storage_account" "ledger" {
  name                     = "stledgerapp" # must be globally unique, lowercase, no dashes
  resource_group_name     = azurerm_resource_group.ledger.name
  location                = azurerm_resource_group.ledger.location
  account_tier             = "Standard"
  account_replication_type = "LRS"
}

resource "azurerm_service_plan" "ledger" {
  name                = "asp-ledger"
  resource_group_name = azurerm_resource_group.ledger.name
  location            = azurerm_resource_group.ledger.location
  os_type             = "Linux"
  sku_name            = "Y1" # Consumption plan, same as the maintenance app
}

resource "azurerm_linux_function_app" "ledger_api" {
  name                       = "func-ledger-api"
  resource_group_name       = azurerm_resource_group.ledger.name
  location                  = azurerm_resource_group.ledger.location
  service_plan_id           = azurerm_service_plan.ledger.id
  storage_account_name      = azurerm_storage_account.ledger.name
  storage_account_access_key = azurerm_storage_account.ledger.primary_access_key

  site_config {
    application_stack {
      node_version = "20"
    }
  }

  app_settings = {
    FUNCTIONS_WORKER_RUNTIME          = "node"
    AZURE_STORAGE_CONNECTION_STRING  = azurerm_storage_account.ledger.primary_connection_string
  }

  lifecycle {
    ignore_changes = [auth_settings_v2]
  }
}

resource "azurerm_static_web_app" "ledger" {
  name                = "swa-ledger"
  resource_group_name = azurerm_resource_group.ledger.name
  location            = "Central US" # East US 2 has an active Azure-side deployment upload bug (Azure/static-web-apps#1750)
  sku_tier            = "Standard" # Free tier does not support BYO Function App linking
  sku_size            = "Standard"
}

# Links the Function App above to the Static Web App as its API,
# same as the BYO Function App registration you set up for the maintenance app.
resource "azurerm_static_web_app_function_app_registration" "ledger" {
  static_web_app_id = azurerm_static_web_app.ledger.id
  function_app_id   = azurerm_linux_function_app.ledger_api.id
}

output "static_web_app_url" {
  value = "https://${azurerm_static_web_app.ledger.default_host_name}"
}

output "static_web_app_deployment_token" {
  value     = azurerm_static_web_app.ledger.api_key
  sensitive = true
}
