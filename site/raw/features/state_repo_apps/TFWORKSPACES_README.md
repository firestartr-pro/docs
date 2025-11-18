# 🚀 How to Deploy a TFWorkspace

***

## 1. 🖐️ Manual Deployment

This GitHub Actions workflow lets you update your GitOps repo (watched by ArgoCD) by turning a `TFWorkspace` claim into deployment files (CRs) on the `deployment` branch.

---

### 1.1 📋 How to Use It

1. **Update Values**
   - Go to your repo’s main/master branch.
   - Edit the "values" files (e.g., in `tfworkspaces/<platform>/<tenant>/<environment>/claim.yaml`) with the desired changes.
   - Create a PR, wait for the `PR Verify` completion ✅ and merge it into `main/master`.
   - Example values claims:
     ```yaml
     ---
     kind: TFWorkspaceClaim
     lifecycle: staging
     name: app-my-db
     system: "system:app"
     version: "1.0"
     providers:
       terraform:
         tfStateKey: b512ff18-e324-4c54-8a56-a132382081a3
         name: app-my-db
         source: Inline
         module: |
           resource "aws_db_instance" "default" {
              allocated_storage    = 10
              db_name              = vars.db_name
              engine               = "mysql"
              engine_version       = "8.0"
              instance_class       = "db.t3.micro"
              username             = vars.user
              password             = vars.pass
              parameter_group_name = "default.mysql8.0"
              skip_final_snapshot  = true
           }

            variable "pass" {
              type        = string
              sensitive   = true
            }

            variable "db_name" {
              type        = string
            }

            variable "user" {
              type        = string
            }
         values:
            # You can reference to a claim secret
            # check the secrets README.md in ./secrets/README.md
            pass: "${{ secret:app-tenant-env.rds_pass }}"
            db_name: "my-db"
            user: "root"
     ```
1. **Head to Your Repo**
   - Go to the "Actions" tab on GitHub.

2. **Locate the Workflow**
   - Find `Generate TFWorkspace Deployment` in the list.

3. **Launch It**
   - Click "Run workflow".
   - Type a `claim_name` (e.g., `my-claim-vmss`).
   - Hit "Run workflow" to kick it off.

---

### 1.2 🌟 What You Get

- **Updated Repo**: New deployment files (CRs) land in a PR against the `deployment` branch.
- **Summary**: Check the workflow logs on GitHub for details.
- **Deploy**: Merge the PR, and ArgoCD will sync the changes.

---

### 1.3 🛠️ Troubleshooting

- **Fails?** Peek at the logs or summary in GitHub Actions. Double-check your `claim_name`.
- **Stuck?** Ensure you’ve entered a valid `claim_name`.

***

## 2. 🤖 Auto-Update

This workflow updates your `TFWorkspace` image versions automatically when a new image is pushed, creating a PR for you.

---

### 2.1 🔄 How It Works

- **Trigger**: Kicks off with a `dispatch-image-tfworkspaces` event (e.g., a new image push).
- **Process**: Updates your `TFWorkspace` claims and generates a PR against `deployment`.

1. Grabs the new image from the event.
2. Updates the `TFWorkspace` runtime with the new image version.
3. Opens a PR with updated deployment files (CRs).

- **Auto-Merge Magic**:
  - If `tfworkspaces/<platform>/<tenant>/<env>/AUTO_MERGE` exists in `master`, the PR merges itself!
  - Otherwise, it waits for your approval.

---

### 2.2 🌈 What You Get

- **PR Ready**: Updated CRs in a PR against `deployment`.
- **Auto or Manual**: Auto-merged if `AUTO_MERGE` is there; otherwise, merge it yourself.
- **Logs**: See the summary in the workflow logs on GitHub.

---

### 2.3 ⚙️ Additional Configuration
- **config file**: A config file can be added to the repository to select the firestartr image version. That config will override the image coded in the workflow.
  - location: `.github`
  - name: `hydrate_tfworkspaces_config.yaml`
  - content:
    ```yaml
    # example
    image: ghcr.io/prefapp/gitops-k8s:v1.39.2_slim
    ``` 

---

### 2.4 🛠️ Troubleshooting

- **Fails?** Check the logs. Make sure the event includes valid image data.
- **PR Not Merging?** Verify `AUTO_MERGE` is in `tfworkspaces/<platform>/<tenant>/<env/>`.
- **No PR?** Confirm the event fired correctly.

***

### 🎉 Quick Tips
- **Manual (1)**: Perfect for testing or one-off changes.
- **Auto (2)**: Ideal for keeping images fresh without lifting a finger.
- Either way, ArgoCD handles the rest once the PR lands in `deployment`!
