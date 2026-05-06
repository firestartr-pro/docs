# State ArgoCD

This repository is used to install **Applications** and **ApplicationSets** within your namespace in a managed ArgoCD environment.

## Configuration Scope

The following configuration is assigned to your environment:

- **ArgoCD namespace:** `{{| CLIENT_NAME |}}-argocd`  
- **Project:** `{{| CLIENT_NAME |}}`
- **Server**:
    - **staging**: `{{| ARGOCD_SERVER_STAGING |}}`
    - **production**: `{{| ARGOCD_SERVER_PRODUCTION |}}`
    
## Security and Usage Limitations

For security reasons, there are restrictions on what can be deployed using this repository:

- This repository only supports **Application** and **ApplicationSet** resources.
- Deployments are limited to the following:
  - **Namespace:** `{{| CLIENT_NAME |}}-argocd` (ArgoCD namespace)
  - **Project:** `{{| CLIENT_NAME |}}`
- Resources outside these boundaries will not be allowed.

These restrictions ensure isolation, governance, and platform security.

## Application Deployment Workflow

When you create a new application:

1. Commit your configuration to this repository.
2. ArgoCD will automatically detect the change and attempt to synchronize the application.
3. You can monitor the synchronization status by visiting: https://argocd.firestartr.dev/

Log in using your **GitHub user** credentials.  
  
If the application is not synchronized automatically, you may manually trigger a sync **only if you have the required permissions**.  
  
**Sync permissions** are granted exclusively to members of the **Platform Team** in GitHub.  
  
## Creating a New Application  
  
To deploy a new application:  
  
1. Create a new folder under the `apps` directory.  
2. Add your ArgoCD `Application` manifest inside that folder.  
3. Ensure that the namespace and project match the permitted configuration.  
  
Example:  
  
```yaml  
apiVersion: argoproj.io/v1alpha1  
kind: Application  
metadata:  
name: my-first-app  
namespace: {{| CLIENT_NAME |}}-argocd # Remember: only your permitted namespace  
spec:  
destination:  
namespace: default # Target namespace in your Kubernetes cluster  
server: https://... # Your Kubernetes API endpoint  
project: {{| CLIENT_NAME |}} # Remember: only your permitted project  
source:  
chart: aws-web-service  
repoURL: https://prefapp.github.io/charts/aws-web-service  
targetRevision: 1.5.3  
helm:  
  parameters:  
    - name: deployment.app  
      value: testing  
    - name: autoscaling.enabled  
      value: "true"
```