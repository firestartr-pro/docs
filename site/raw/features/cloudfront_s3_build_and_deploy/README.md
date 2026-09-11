# cloudfront_s3_build_and_deploy

## Overview

This feature provides a set of templates and workflows to automate the build and deployment of static assets to Amazon S3 and CloudFront. It is designed for projects that need to publish web content or other static files to AWS infrastructure, leveraging GitHub Actions for CI/CD automation. The feature allows you to define deployment parameters via claims, which are then used to render and execute the deployment workflows. This approach enables reproducible, auditable, and flexible deployments for multi-tenant or multi-environment scenarios.

---
## Deployment Model Explained

**CloudFront and S3 serve static files, not Docker images.**

The typical workflow for this feature is:

1. **Build static assets**: Your application (e.g., a React, Angular, or static site) is built, often using a Docker image for reproducibility and consistency.
2. **Extract static files**: The built static files (HTML, JS, CSS, images, etc.) are extracted from the Docker image or build output directory.
3. **Upload to S3**: These static files are uploaded to an S3 bucket.
4. **Invalidate CloudFront cache**: After upload, the CloudFront distribution is invalidated to ensure users get the latest content.

**Docker images are used as build environments, not as deployment artifacts.** The Dockerfile path in the configuration refers to the environment used to build your static assets, not something that is deployed to CloudFront or S3.

**Summary:**
- Docker images: Used for building static assets.
- S3: Stores and serves the static files.
- CloudFront: Distributes the static files globally.


---
## Using variables in claims


When you define a claim that uses this feature, you can provide the values for the variables expected by the template. For example:
```yaml
apiVersion: features.prefapp.io/v1
kind: CloudfrontS3BuildAndDeployClaim
metadata:
  name: example-claim
spec:
  feature: cloudfront_s3_build_and_deploy
  variables:
    deployment_env: "pro"
    deployment_type: "prereleases"
    deployment_tenants: "default, tenant1, tenant2"  # comma-separated string, rendered as a YAML list
    deployment_registry: "s3://my-bucket/prefix/"
    deployment_aws_account: "123456789012"
    deployment_aws_region: "eu-west-1"
    deployment_aws_role: "arn:aws:iam::123456789012:role/deploy"
    deployment_aws_cloudfront_distribution_id: "E1234567890"
```
```

The platform system will use these values to render the `.github/cloudfront_deployments.yaml` template, replacing each `{{| VAR |}}` (or `{{| &VAR |}}`) with the corresponding value.
---
## How Static Files Are Built and Deployed

The configuration may allow for custom build commands, but by default, the provided workflows use Node.js (`npm ci` and `npm run build`) to build your static assets. The output of the build (the static files) is what gets uploaded to S3 and served via CloudFront.

**Key Points:**
- Node.js build commands are for building, not for deployment.
- Only static files (not containers) are uploaded to S3/CloudFront.
- The configuration structure allows you to specify how your static assets are built before deployment (custom build commands supported).

---
## Step-by-Step Deployment Flow

1. **Build Phase**
  - The workflow runs `npm ci` to install dependencies and then executes the configured build command (default: `npm run build`).
  - The build process generates static files (e.g., in a `dist/` or `build/` directory).
2. **Artifact Extraction**
  - The static files are taken from the build output directory.
3. **Upload to S3**
  - The static files are uploaded to the configured S3 bucket using AWS credentials and region specified in the claim variables.
4. **CloudFront Invalidation**
  - After upload, the CloudFront distribution is invalidated so users receive the latest version of the files.
5. **Result**
  - Your static site or assets are now globally available via CloudFront, backed by S3 storage.

This process is fully automated via the provided CI/CD templates (e.g., GitHub Actions) and works out of the box for standard CloudFront/S3 deployments. No manual modification of workflow logic is required for typical use cases.

---
## Advanced Customization (Optional)

The provided workflows are designed to work out-of-the-box for most CloudFront/S3 deployment scenarios. No manual modification of workflow logic is required for standard use cases.

### Supported Configuration Knobs
    - **Build Command**: You can override the default build command (e.g., use a different build tool or directory).
    - **Tenants and Environments**: Specify multiple tenants and environments via claim variables.
    - **Registry and AWS Settings**: Configure S3 bucket, prefix, AWS account, region, role, and CloudFront distribution ID through claim variables.

    ### Optional Customization
    If your project has unique requirements not covered by the configuration options above, you may optionally adapt the dispatch logic in `.github/cloudfront_deployments.yaml` and related workflows. For most users, the default implementation will be sufficient and fully automated.
