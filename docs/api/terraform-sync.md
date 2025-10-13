# Terraform Sync API Reference

This document provides API reference for direct integration with Firestartr Pro's Terraform synchronization capabilities.

## Overview

The Terraform Sync API provides programmatic access to workspace synchronization features, allowing you to:
- Monitor sync status
- Trigger manual synchronization
- Configure sync settings
- Handle conflicts programmatically

## Authentication

All API requests require authentication using your Firestartr Pro API key:

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
     https://api.firestartr.pro/v1/terraform/sync/workspaces
```

## Endpoints

### List Workspace Sync Status

Get synchronization status for all workspaces:

```http
GET /v1/terraform/sync/workspaces
```

**Response:**
```json
{
  "workspaces": [
    {
      "name": "production",
      "sync_enabled": true,
      "last_sync": "2025-10-13T14:00:00Z",
      "status": "success",
      "next_sync": "2025-10-13T14:10:00Z"
    }
  ]
}
```

### Trigger Manual Sync

Manually trigger synchronization for a specific workspace:

```http
POST /v1/terraform/sync/workspaces/{workspace_name}/sync
```

### Get Sync Configuration

Retrieve current sync configuration:

```http
GET /v1/terraform/sync/config
```

### Update Sync Configuration

Update synchronization settings:

```http
PUT /v1/terraform/sync/config
```

**Request Body:**
```json
{
  "enabled": true,
  "workspaces": {
    "production": {
      "enabled": true,
      "sync_interval": "10m",
      "auto_apply": false
    }
  },
  "conflict_resolution": "manual"
}
```

## Error Handling

The API uses standard HTTP status codes and returns detailed error information:

```json
{
  "error": "workspace_not_found",
  "message": "Workspace 'invalid-name' does not exist",
  "code": 404
}
```

## Rate Limits

- 100 requests per minute per API key
- Sync operations are limited to prevent resource exhaustion

For complete API documentation, visit the [Firestartr Pro API Portal](https://api.firestartr.pro/docs).