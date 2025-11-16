# API Configuration Guide

This document explains how to configure the API endpoints for workspace/project management.

## Environment Variables

Add the following environment variables to your `.env` file:

```env
# Base API URL (required)
VITE_API_BASE_URL=https://your-api-domain.com

# Projects API endpoint (optional, defaults to /api/projects/)
VITE_PROJECTS_API_ENDPOINT=/api/projects/

# Create project endpoint (optional, defaults to /api/projects/)
VITE_CREATE_PROJECT_API_ENDPOINT=/api/projects/

# Delete project endpoint (optional, defaults to /api/projects/{id})
VITE_DELETE_PROJECT_API_ENDPOINT=/api/projects/
```

## Authentication

The API client automatically includes the Bearer token in the `Authorization` header. The token is retrieved from:

1. `localStorage.getItem('access_token')`
2. `localStorage.getItem('auth_token')`
3. `sessionStorage.getItem('access_token')`
4. `sessionStorage.getItem('auth_token')`

Make sure to store the authentication token in one of these locations after login.

## API Contract

### Get Projects (Workspaces)

**Endpoint:** `GET /api/projects/`

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Response:**
```json
[
  {
    "id": "string",
    "name": "string",
    ...
  }
]
```

## Implementation Details

The workspace functionality has been updated to use the new API:

- **Fetch Workspaces**: Uses `GET /api/projects/` to retrieve all projects for the current user
- **Create Workspace**: Uses `POST /api/projects/` to create a new project
- **Delete Workspace**: Uses `DELETE /api/projects/{id}` to delete a project

All API calls are handled through the `api-client.ts` utility which:
- Automatically adds the Bearer token to requests
- Handles errors and provides user-friendly error messages
- Supports configurable base URLs and endpoints

## Next Steps

1. Set the `VITE_API_BASE_URL` environment variable with your API base URL
2. Ensure your authentication flow stores the access token in `localStorage` or `sessionStorage` with the key `access_token` or `auth_token`
3. Update the create and delete endpoints if they differ from the defaults
4. Test the workspace functionality to ensure it works with your API

