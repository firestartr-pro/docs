# Terraform Workspace Synchronization

Firestartr Pro provides powerful synchronization capabilities for Terraform workspaces, allowing you to keep your infrastructure state and configurations in sync across different environments and teams.

## Overview

The workspace synchronization feature enables automatic syncing of Terraform workspaces, ensuring consistency and coordination across your infrastructure deployments.

## Configuration

### Provider Configuration

To enable workspace synchronization, configure the sync section within the `providers.terraform` object in your Terraform configuration:

```hcl
terraform {
  required_providers {
    firestartr = {
      source = "firestartr-pro/firestartr"
    }
  }
}

provider "firestartr" {
  # Provider configuration
  api_key = var.firestartr_api_key
  
  # Terraform workspace sync configuration
  terraform {
    sync = {
      enabled = true
      
      # Workspace synchronization settings
      workspaces = {
        # Enable sync for specific workspaces
        production = {
          enabled = true
          sync_interval = "5m"
          auto_apply = false
        }
        
        staging = {
          enabled = true
          sync_interval = "2m"
          auto_apply = true
        }
        
        development = {
          enabled = true
          sync_interval = "1m"
          auto_apply = true
        }
      }
      
      # Global sync settings
      conflict_resolution = "manual" # Options: "manual", "latest_wins", "merge"
      retry_attempts = 3
      timeout = "10m"
    }
  }
}
```

## Sync Configuration Options

### Workspace-Level Settings

Each workspace can be configured with its own sync settings:

| Setting | Description | Default | Required |
|---------|-------------|---------|----------|
| `enabled` | Enable/disable sync for this workspace | `false` | No |
| `sync_interval` | How often to check for changes | `"5m"` | No |
| `auto_apply` | Automatically apply changes when synced | `false` | No |

### Global Sync Settings

Configure global synchronization behavior:

| Setting | Description | Options | Default |
|---------|-------------|---------|---------|
| `conflict_resolution` | How to handle sync conflicts | `manual`, `latest_wins`, `merge` | `manual` |
| `retry_attempts` | Number of retry attempts on failure | Integer | `3` |
| `timeout` | Maximum time to wait for sync operations | Duration string | `"10m"` |

## Usage Examples

### Basic Workspace Sync

Enable basic synchronization for a single workspace:

```hcl
provider "firestartr" {
  terraform {
    sync = {
      enabled = true
      
      workspaces = {
        my_workspace = {
          enabled = true
          sync_interval = "5m"
        }
      }
    }
  }
}
```

### Advanced Multi-Workspace Configuration

Configure different sync settings for multiple workspaces:

```hcl
provider "firestartr" {
  terraform {
    sync = {
      enabled = true
      conflict_resolution = "latest_wins"
      retry_attempts = 5
      timeout = "15m"
      
      workspaces = {
        production = {
          enabled = true
          sync_interval = "10m"
          auto_apply = false  # Manual approval for production
        }
        
        staging = {
          enabled = true
          sync_interval = "5m"
          auto_apply = true   # Auto-apply for staging
        }
        
        feature_branches = {
          enabled = true
          sync_interval = "2m"
          auto_apply = true
        }
      }
    }
  }
}
```

### Conditional Sync Configuration

Use Terraform variables and conditions to configure sync dynamically:

```hcl
variable "environment" {
  description = "The deployment environment"
  type        = string
  default     = "development"
}

variable "enable_sync" {
  description = "Enable workspace synchronization"
  type        = bool
  default     = true
}

provider "firestartr" {
  terraform {
    sync = {
      enabled = var.enable_sync
      
      workspaces = {
        (var.environment) = {
          enabled = var.enable_sync
          sync_interval = var.environment == "production" ? "10m" : "5m"
          auto_apply = var.environment != "production"
        }
      }
    }
  }
}
```

## Sync Behavior

### Synchronization Process

1. **Change Detection**: The provider monitors workspace state changes at the configured interval
2. **Conflict Analysis**: When changes are detected, the system checks for conflicts with other synchronized workspaces
3. **Resolution**: Conflicts are resolved based on the configured `conflict_resolution` strategy
4. **Application**: Changes are applied according to the `auto_apply` setting

### Conflict Resolution Strategies

- **`manual`**: Requires manual intervention to resolve conflicts
- **`latest_wins`**: The most recent change takes precedence
- **`merge`**: Attempts to automatically merge non-conflicting changes

### Monitoring and Logging

Workspace synchronization activities are logged and can be monitored through:

- Provider logs with detailed sync operations
- Firestartr Pro dashboard for sync status and history
- Terraform state file annotations for sync metadata

## Best Practices

1. **Environment-Specific Settings**: Use different sync intervals for different environments (longer for production)
2. **Manual Approval for Production**: Disable `auto_apply` for production workspaces
3. **Conflict Prevention**: Implement proper workspace isolation and access controls
4. **Regular Monitoring**: Monitor sync logs and status regularly
5. **Testing**: Test sync configurations in non-production environments first

## Troubleshooting

### Common Issues

**Sync Failures**
- Check API connectivity and authentication
- Verify workspace permissions
- Review timeout settings for large state files

**Conflicts**
- Review conflict resolution strategy
- Check for concurrent modifications
- Ensure proper workspace access controls

**Performance Issues**
- Adjust sync intervals based on workspace activity
- Consider state file size and complexity
- Monitor network latency and provider API limits

### Debugging

Enable detailed logging for sync operations:

```hcl
provider "firestartr" {
  # Enable debug logging
  log_level = "DEBUG"
  
  terraform {
    sync = {
      # ... sync configuration
    }
  }
}
```

## Migration Guide

### Enabling Sync for Existing Workspaces

1. **Backup State**: Create backups of existing Terraform state files
2. **Gradual Rollout**: Enable sync for non-critical workspaces first
3. **Monitor**: Watch for conflicts and performance impacts
4. **Adjust Settings**: Fine-tune sync intervals and conflict resolution based on observations

### Updating Sync Configuration

Changes to sync configuration require a provider refresh:

```bash
terraform init -upgrade
terraform plan
terraform apply
```

## Security Considerations

- Ensure proper API key management and rotation
- Use workspace-specific access controls
- Monitor sync activities for unauthorized changes
- Implement network security for provider communications

## API Reference

For advanced use cases, refer to the [Firestartr Pro API documentation](../api/terraform-sync.md) for direct API integration options.