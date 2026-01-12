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

#### Cron Format Reference

```
*    *    *    *    *    *
┬    ┬    ┬    ┬    ┬    ┬
│    │    │    │    │    │
│    │    │    │    │    └─ day of week (0-7, 1L-7L) (0 or 7 is Sun)
│    │    │    │    └────── month (1-12, JAN-DEC)
│    │    │    └─────────── day of month (1-31, L)
│    │    └──────────────── hour (0-23)
│    └───────────────────── minute (0-59)
└────────────────────────── second (0-59, optional)
```

| Field | Values | Description |
|-------|--------|-------------|
| Second (optional) | 0-59 | Second field (when using 6-field format) |
| Minute | 0-59 | Minute field |
| Hour | 0-23 | Hour field |
| Day of Month | 1-31, L | Day of the month, or L for last day |
| Month | 1-12, JAN-DEC | Month field, numeric or abbreviated name |
| Day of Week | 0-7, SUN-SAT, 1L-7L | Day of week (0 or 7 is Sunday) |

**Special Characters:**

| Character | Description | Example |
|-----------|-------------|---------|
| `*` | Any value | `* * * * *` (every minute) |
| `?` | Any value (alias for `*`) | `? * * * *` (every minute) |
| `,` | Value list separator | `1,2,3 * * * *` (1st, 2nd, and 3rd minute) |
| `-` | Range of values | `1-5 * * * *` (every minute from 1 through 5) |
| `/` | Step values | `*/5 * * * *` (every 5th minute) |
| `L` | Last day of month/week | `0 0 L * *` (midnight on last day of month) |
| `#` | Nth day of month | `0 0 * * 1#1` (first Monday of month) |

#### Common Cron Patterns

**Frequency-Based Patterns:**
```bash
"*/5 * * * *"      # Every 5 minutes
"0 */4 * * *"      # Every 4 hours at the top of the hour
"0 0 */2 * *"      # Every 2 days at midnight
"0 0 0 * *"        # Daily at midnight
"0 0 0 * * 1"      # Weekly on Mondays at midnight (6-field format)
```

**Business Hours Patterns:**
```bash
"0 9-17 * * 1-5"   # Every hour from 9 AM to 5 PM, weekdays only
"0 9,12,15 * * 1-5" # At 9 AM, noon, and 3 PM on weekdays
"0 8 * * 1-5"      # Every weekday at 8 AM
"0 18 * * 1-5"     # Every weekday at 6 PM
"0 9 * * 1"        # Every Monday at 9 AM
```

**Maintenance Window Patterns:**
```bash
"0 2 * * 0"        # Every Sunday at 2 AM
"0 3 1 * *"        # First day of every month at 3 AM
"0 4 * * 6"        # Every Saturday at 4 AM
"0 1 15 * *"       # 15th of every month at 1 AM
"0 0 1 1,7 *"      # January 1st and July 1st at midnight
```

**Development Environment Patterns:**
```bash
"*/2 * * * *"      # Every 2 minutes (high frequency)
"*/15 8-18 * * 1-5" # Every 15 minutes during work hours on weekdays
"0 */1 * * 1-5"    # Every hour on weekdays
"30 9-17/2 * * 1-5" # Every 2 hours at 30 minutes past, 9 AM to 5 PM, weekdays
```

**Production Environment Patterns:**
```bash
"0 2,14 * * *"     # Twice daily at 2 AM and 2 PM
"0 6 * * *"        # Once daily at 6 AM
"0 3 * * 0,3"      # Twice weekly on Sunday and Wednesday at 3 AM
"0 4 1,15 * *"     # Twice monthly on 1st and 15th at 4 AM
```

**Advanced Patterns with Seconds (6-field format):**
```bash
"0 */5 * * * *"    # Every 5 minutes at the start of the minute
"30 */10 * * * *"  # Every 10 minutes at 30 seconds past
"0,30 * * * * *"   # Every 30 seconds
"15 0 9 * * 1-5"   # Every weekday at 9:00:15 AM
```

#### Quick Reference - Common Use Cases

| Use Case | Cron Expression | Description |
|----------|-----------------|-------------|
| Every minute | `"* * * * *"` | High-frequency monitoring |
| Every 5 minutes | `"*/5 * * * *"` | Development environments |
| Every hour | `"0 * * * *"` | Regular monitoring |
| Business hours only | `"0 9-17 * * 1-5"` | Weekday office hours |
| Daily maintenance | `"0 2 * * *"` | Daily at 2 AM |
| Weekly maintenance | `"0 2 * * 0"` | Sunday at 2 AM |
| Monthly maintenance | `"0 2 1 * *"` | First of month at 2 AM |
| Twice daily | `"0 6,18 * * *"` | Morning and evening |
| Weekdays only | `"0 9 * * 1-5"` | Business days at 9 AM |
| Weekends only | `"0 10 * * 6,0"` | Saturday and Sunday at 10 AM |

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

### Real-World Cron Scheduling Examples

#### Multi-Environment Sync Strategy

**Production Environment - Conservative Approach:**
```yaml
kind: TFWorkspaceClaim
name: prod-environment
providers:
  terraform:
    sync:
      enabled: true
      schedule: "0 2 * * 0"  # Every Sunday at 2 AM
      schedule_timezone: "UTC"
      policy: "observe"  # Audit only, no changes
```

**Staging Environment - Regular Testing:**
```yaml
kind: TFWorkspaceClaim
name: staging-environment
providers:
  terraform:
    sync:
      enabled: true
      schedule: "0 6,18 * * 1-5"  # Twice daily at 6 AM and 6 PM, weekdays
      schedule_timezone: "America/New_York"
      policy: "apply"
```

**Development Environment - Continuous Sync:**
```yaml
kind: TFWorkspaceClaim
name: dev-environment
providers:
  terraform:
    sync:
      enabled: true
      schedule: "*/15 8-20 * * 1-5"  # Every 15 minutes during work hours
      schedule_timezone: "America/Los_Angeles"
      policy: "full-control"
```

#### Industry-Specific Patterns

**Financial Services - Compliance Window:**
```yaml
# Sync during non-trading hours only
providers:
  terraform:
    sync:
      enabled: true
      schedule: "0 20 * * 1-5"  # Weekdays at 8 PM after markets close
      schedule_timezone: "America/New_York"
      policy: "apply"
```

**E-commerce - Low Traffic Windows:**
```yaml
# Sync during low traffic periods
providers:
  terraform:
    sync:
      enabled: true
      schedule: "0 3,15 * * *"  # Daily at 3 AM and 3 PM
      schedule_timezone: "UTC"
      policy: "apply"
```

**Global Operations - Follow-the-Sun:**
```yaml
# Sync during business hours in different regions
providers:
  terraform:
    sync:
      enabled: true
      schedule: "0 9,21 * * 1-5"  # 9 AM and 9 PM to cover multiple timezones
      schedule_timezone: "UTC"
      policy: "observe"
```

#### Maintenance and Deployment Patterns

**Monthly Maintenance Window:**
```yaml
providers:
  terraform:
    sync:
      enabled: true
      schedule: "0 2 1 * *"  # First day of each month at 2 AM
      schedule_timezone: "UTC"
      policy: "full-control"
```

**Second Tuesday Deployments:**
```yaml
providers:
  terraform:
    sync:
      enabled: true
      schedule: "0 3 * * 2#2"  # Second Tuesday of each month at 3 AM
      schedule_timezone: "UTC"
      policy: "apply"
```

**Weekend Deployments:**
```yaml
providers:
  terraform:
    sync:
      enabled: true
      schedule: "0 4 * * 6"  # Every Saturday at 4 AM
      schedule_timezone: "America/Chicago"
      policy: "full-control"
```

#### High-Frequency Monitoring Patterns

**Infrastructure Monitoring:**
```yaml
providers:
  terraform:
    sync:
      enabled: true
      schedule: "*/5 * * * *"  # Every 5 minutes for monitoring
      schedule_timezone: "UTC"
      policy: "observe"  # Monitor only, no changes
```

**Security Compliance Checks:**
```yaml
providers:
  terraform:
    sync:
      enabled: true
      schedule: "0 */4 * * *"  # Every 4 hours for security monitoring
      schedule_timezone: "UTC"
      policy: "observe"
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

### Cron Expression Validation

**Before Deployment:**
1. **Validate syntax** using online tools:
   - [crontab.guru](https://crontab.guru) - For 5-field expressions
   - [cron-job.org](https://cron-job.org/en/members/tools/cron-expression-parser/) - Supports 6-field expressions
   - [cronhub.io](https://cronhub.io/cron-parser/) - Alternative validator

2. **Test timing** with your timezone:
   - Consider daylight saving time transitions
   - Verify business hours align with intended times
   - Check impact of timezone changes on schedules

3. **Document your schedule**:
   - Add comments explaining the business logic
   - Include expected execution times in documentation
   - Note any timezone-specific considerations

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

**Common Cron Expression Mistakes**
- **Invalid range**: `"0 9-5 * * *"` ❌ (hour range goes backwards) → Use `"0 9-17 * * *"` ✅
- **Wrong day format**: `"0 9 * * Monday"` ❌ → Use `"0 9 * * 1"` or `"0 9 * * MON"` ✅
- **Month confusion**: `"0 9 * 13 *"` ❌ (month 13 doesn't exist) → Use `"0 9 * 12 *"` ✅
- **Mixed formats**: `"30 0 9 * * 1-5"` ❌ (6 fields but inconsistent) → Use `"0 9 * * 1-5"` ✅ (5 fields) or `"0 30 9 * * 1-5"` ✅ (6 fields)
- **Timezone issues**: Schedule in wrong timezone → Always specify `schedule_timezone` explicitly

**Cron Expression Testing**
- Use online cron validators like [crontab.guru](https://crontab.guru) for 5-field expressions
- Test expressions with your specific timezone settings
- Consider daylight saving time changes when using non-UTC timezones

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