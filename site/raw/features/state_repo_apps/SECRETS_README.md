# 🔐 How to Deploy Secrets

Deploying secrets to your GitOps repo is straightforward! Here’s how to do it manually with a GitHub Actions workflow.

***

## 1. 🖐️ Manual Deployment

This workflow generates deployment files (CRs) for secrets based on a tenant and environment you provide. It updates your GitOps repo (watched by ArgoCD) on the `deployment` branch.

---

### 1.1 📋 How to Use It

1. **Update Values**  
   - Go to your repo’s main/master branch.  
   - Edit the "values" files (e.g., in `secrets/<tenant>/<environment>/secret.yaml`) with the desired changes.  
   - Create a PR, wait for the `PR Verify` completion ✅ and merge it into `main/master`.
   - Example secrets claim:
     ```yaml
     ---
     kind: SecretsClaim
     lifeciycle: production
     system: test
     version: 1.0
     providers:
       external_secrets:
         pushSecrets:
         # This array generates a PushSecret per item
         # The push secret will create a secret into the key vault (azure)
         # or parameter store (aws)
           - secretName: my-postgres
             # you can set the 'refreshInterval' to null in case
             # you don´t want to refresh the secret value in the key vault
             # or parameter store (aws)
             refreshInterval: null
             generator:
             # Points to a generator custom resource,
             # see: https://external-secrets.io/latest/api/generator/password/
               name: pg-generator 
         externalSecrets:
         # Filling the key 'externalSecrets', a ExternalSecret will be created,
         # and the system will access to the key vault (azure) or parameter store (aws),
         # and create a secret into the kubernetes cluster
         # that can be referenced from the TFWorkspaceClaim 
           refreshInterval: 10m
           secrets:
           - secretName: rds_conn
           - secretName: my_test
     ```
2. **Head to Your Repo**  
   - Go to the "Actions" tab on GitHub.

3. **Locate the Workflow**  
   - Find `Generate secrets deployment` in the list.

4. **Launch It**  
   - Click "Run workflow".  
   - Fill in:  
     - `tenant` (e.g., `customer1`).  
     - `environment` (e.g., `prod`).  
   - Hit "Run workflow" to start.

---

### 1.2 🌟 What You Get

- **Updated Repo**: New deployment files (CRs) for secrets land in a PR against the `deployment` branch.  
- **Summary**: Check the workflow logs on GitHub for details.  
- **Deploy**: Merge the PR, and ArgoCD will sync the secrets to your system.

---

### 1.3 🛠️ Troubleshooting

- **Fails?** Check the logs or summary in GitHub Actions. Verify your `tenant` and `environment` inputs.  
- **No PR?** Ensure the inputs match a valid secrets path (e.g., `secrets/customer1/prod`).

***

### 🎉 Quick Tip
- Use this workflow to manually deploy secrets for a specific tenant and environment. Once the PR is merged, ArgoCD handles the rest!
