# Terraform Workspace Synchronization

The Terraform provider sync configuration allows you to control how and when Terraform workspaces are synchronized within TFWorkspaceClaim definitions.

## Overview

The sync section within `providers.terraform` in a TFWorkspaceClaim enables automatic synchronization of Terraform state and resources at specified intervals or schedules.

## Configuration

### TFWorkspaceClaim Sync Configuration

Configure synchronization in your TFWorkspaceClaim YAML file within the `providers.terraform.sync` section:

```yaml
kind: TFWorkspaceClaim
lifecycle: production
name: example-workspace
type: database
owner: 'group:firestartr-team'
system: 'system:firestartr-system'
version: '1.0'
providers:
  terraform:
    policy: full-control
    tfStateKey: a1850b50-677d-4a81-92a4-1318503b5568
    name: example-workspace
    source: Inline
    sync:
      enabled: true
      period: "5m"
      policy: "apply"
    module: |
      # Your Terraform module content
      output "example" {
        value = "Hello World"
      }
    values: {}
    context:
      providers:
        - name: provider-aws-workspaces
      backend:
        name: firestartr-terraform-state
```

## Sync Configuration Options

The sync configuration supports the following properties:

| Setting | Type | Description | Required | Format |
|---------|------|-------------|----------|---------|
| `enabled` | boolean | Enable/disable synchronization | Yes | `true` or `false` |
| `period` | string | Sync interval using duration format | No* | `^[0-9]+[smhd]$` (e.g., `5m`, `1h`, `30s`) |
| `schedule` | string | Cron schedule expression | No* | Cron format with optional seconds |
| `schedule_timezone` | string | Timezone for cron schedule | No | Standard timezone (e.g., `UTC`, `America/New_York`) |
| `policy` | string | Sync policy determining allowed operations | No | `observe`, `apply`, `create-only`, `full-control` |

**\*Note**: Either `period` or `schedule` must be specified, but not both.

### Scheduling Options

You have two mutually exclusive options for scheduling synchronization:
#### 1. Period-based Synchronization

Use the `period` property for simple interval-based synchronization:

```yaml
providers:
  terraform:
    sync:
      enabled: true
      period: "5m"  # Sync every 5 minutes
```

**Period Format**: `^[0-9]+[smhd]$`
- `s` = seconds (e.g., `30s`)
- `m` = minutes (e.g., `5m`) 
- `h` = hours (e.g., `2h`)
- `d` = days (e.g., `1d`)

#### 2. Schedule-based Synchronization

Use the `schedule` property for cron-based scheduling:

```yaml
providers:
  terraform:
    sync:
      enabled: true
      schedule: "*/5 * * * *"  # Every 5 minutes
      schedule_timezone: "UTC"
```

**Schedule Format**: Uses [cron-parser](https://www.npmjs.com/package/cron-parser) with optional seconds field

- Standard 5-field format: `minute hour day month dayofweek`
- Optional 6-field format: `second minute hour day month dayofweek`

**Examples:**
- `"0 9 * * 1-5"` - Every weekday at 9:00 AM
- `"*/10 * * * *"` - Every 10 minutes
- `"30 */2 * * *"` - Every 2 hours at 30 minutes past the hour
- `"0 0 12 * * 0"` - Every Sunday at noon (6-field format with seconds)

## Usage Examples

### Basic Period-based Sync

Simple synchronization every 10 minutes:

```yaml
kind: TFWorkspaceClaim
name: basic-sync-example
providers:
  terraform:
    sync:
      enabled: true
      period: "10m"
    # ... other terraform configuration
```

### Advanced Schedule-based Sync

Synchronize during business hours only:

```yaml
kind: TFWorkspaceClaim
name: business-hours-sync
providers:
  terraform:
    sync:
      enabled: true
      schedule: "0 9-17 * * 1-5"  # Every hour from 9 AM to 5 PM, Monday to Friday
      schedule_timezone: "America/New_York"
      policy: "observe"
    # ... other terraform configuration
```

### High-frequency Development Sync

For development environments requiring frequent updates:

```yaml
kind: TFWorkspaceClaim
name: dev-environment
providers:
  terraform:
    sync:
      enabled: true
      period: "2m"  # Sync every 2 minutes
    # ... other terraform configuration
```

## Sync Behavior

### Synchronization Process

The synchronization operates based on the configured schedule or period:

1. **Trigger**: Sync is triggered either by period interval or cron schedule
2. **State Check**: The system checks for changes in the Terraform workspace
3. **Execution**: If changes are detected, the sync policy is applied
4. **Logging**: All sync activities are logged for monitoring and debugging

### Policy Configuration

The `policy` field determines what actions can be performed during synchronization. The following policies are available:

| Policy | Create | Update | Delete | Use Case |
|--------|--------|--------|--------|----------|
| `observe` | ✗ | ✗ | ✗ | Audit/monitor only |
| `apply` | ✓ | ✓ | (✗)* | Standard GitOps (update/patch only) |
| `full-control` | ✓ | ✓ | ✓ | Strict enforcement, full reconciliation |
| `create-only` | ✓ | ✗ | ✗ | Seeding resources, preserving manual edits |

**Note**: The `apply` policy typically does not delete resources, focusing on updates and patches.

#### Policy Usage Examples

**Production Environment (Audit/Monitor Only):**
```yaml
providers:
  terraform:
    sync:
      enabled: true
      schedule: "0 */6 * * *"  # Every 6 hours
      policy: "observe"  # No changes, audit only
```

**Development Environment (Full Reconciliation):**
```yaml
providers:
  terraform:
    sync:
      enabled: true
      period: "5m"
      policy: "full-control"  # Create, update, and delete resources
```

**Staging Environment (GitOps Updates):**
```yaml
providers:
  terraform:
    sync:
      enabled: true
      period: "15m"
      policy: "apply"  # Create and update, but preserve existing resources
```

**Initial Deployment (Create Resources Only):**
```yaml
providers:
  terraform:
    sync:
      enabled: true
      period: "10m"
      policy: "create-only"  # Only create new resources, preserve manual changes
```

### Timezone Handling

When using `schedule`, you can specify a timezone with `schedule_timezone`. If not specified, UTC is used by default.

## Best Practices

### Scheduling Recommendations

1. **Production Environments**: Use longer intervals (e.g., `30m` or scheduled during maintenance windows)
2. **Development Environments**: Use shorter intervals for rapid iteration (e.g., `2m` to `5m`)
3. **Staging Environments**: Balance between development and production (e.g., `10m`)

### Schedule vs Period Selection

- **Use `period`** for simple, regular intervals
- **Use `schedule`** for complex timing requirements (business hours, specific days, etc.)
- **Use timezone** when coordinating across different geographical locations

### Configuration Guidelines

```yaml
# Production example - conservative sync
providers:
  terraform:
    sync:
      enabled: true
      schedule: "0 */2 * * *"  # Every 2 hours
      schedule_timezone: "UTC"
      policy: "observe"

# Development example - frequent sync  
providers:
  terraform:
    sync:
      enabled: true
      period: "5m"  # Every 5 minutes
```

## Troubleshooting

### Common Issues

**Sync Not Triggering**
- Verify `enabled` is set to `true`
- Check that either `period` or `schedule` is specified (not both)
- Validate cron expression format for `schedule`
- Ensure timezone is correctly specified

**Schedule Format Errors**
- Use [cron-parser](https://www.npmjs.com/package/cron-parser) compatible format
- Remember that seconds field is optional
- Test cron expressions before deploying

**Period Format Errors**
- Ensure format matches `^[0-9]+[smhd]$` pattern
- Valid examples: `30s`, `5m`, `2h`, `1d`
- Invalid examples: `5mins`, `2hours`, `1 day`

## Schema Validation

The sync configuration follows this JSON schema:

```json
{
  "type": "object",
  "properties": {
    "enabled": {
      "type": "boolean"
    },
    "period": {
      "type": "string",
      "pattern": "^[0-9]+[smhd]$"
    },
    "schedule": {
      "type": "string"
    },
    "schedule_timezone": {
      "type": "string"
    },
    "policy": {
      "type": "string"
    }
  },
  "additionalProperties": false,
  "required": ["enabled"],
  "oneOf": [
    {
      "required": ["period"]
    },
    {
      "required": ["schedule"]
    },
    {
      "not": {
        "anyOf": [
          {
            "required": ["period"]
          },
          {
            "required": ["schedule"]
          }
        ]
      }
    }
  ]
}
```

### Validation Rules

1. `enabled` is always required
2. Either `period` OR `schedule` must be specified (mutually exclusive)
3. `schedule_timezone` can only be used with `schedule`
4. `period` must match the pattern `^[0-9]+[smhd]$`
5. `schedule` uses cron-parser format with optional seconds field

## Migration Guide

### Adding Sync to Existing TFWorkspaceClaim

To add synchronization to an existing workspace:

1. **Update the YAML**: Add the sync section to your TFWorkspaceClaim
2. **Apply Changes**: Deploy the updated claim to your cluster
3. **Monitor**: Watch the sync behavior and adjust timing as needed

```yaml
# Before
providers:
  terraform:
    name: existing-workspace
    # ... other config

# After  
providers:
  terraform:
    name: existing-workspace
    sync:
      enabled: true
      period: "10m"
    # ... other config
```

### Changing Sync Configuration

Simply update the sync section and redeploy the TFWorkspaceClaim. Changes take effect on the next sync cycle.