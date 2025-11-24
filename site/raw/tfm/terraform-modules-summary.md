# Terraform Modules Summary

This document defines the primary purpose and goal of the selected Terraform modules from the prefapp/tfm repository.

## aws-cloudfront-delivery

To provision and configure a content delivery network using Amazon CloudFront. This module is designed to accelerate the delivery of static and dynamic web content to users by caching it at edge locations globally. It typically handles the creation of the CloudFront distribution, origin access identities (OAI) or origin access controls (OAC) for securing S3 buckets, and SSL/TLS certificate association for custom domains.

## aws-eks

To deploy a production-ready Amazon Elastic Kubernetes Service (EKS) cluster. The module’s purpose is to abstract the complexity of setting up the Kubernetes control plane, worker node groups (managed or self-managed), and essential networking configurations (VPC CNI). It serves as the foundation for running containerized workloads on AWS.

## aws-oidc

To configure OpenID Connect (OIDC) identity providers in AWS IAM. Its primary purpose is to enable federated authentication, allowing external systems (most commonly CI/CD platforms like GitHub Actions or GitLab CI) to assume IAM roles and deploy infrastructure without needing long-lived AWS access keys.

## aws-parameter-store

To manage configuration data and secrets centrally using AWS Systems Manager (SSM) Parameter Store. This module allows for the organized creation of hierarchical parameters (strings, string lists, or secure strings), decoupling configuration values from application code and infrastructure definitions.

## aws-rds

To provision and manage Amazon Relational Database Service (RDS) instances or clusters. The module aims to simplify the deployment of managed databases (such as PostgreSQL, MySQL, or Aurora), handling aspects like subnet groups, security groups, encryption at rest, backup retention policies, and high-availability configurations.

## aws-sso

To manage access control and identity assignment via AWS IAM Identity Center (formerly AWS SSO). The purpose of this module is to define Permission Sets (policies) and assign them to users or groups for specific AWS accounts, facilitating a centralized and secure multi-account access strategy.

## aws-terraform-backend

To bootstrap the infrastructure required for storing Terraform state remotely and securely. This module creates an S3 bucket (with versioning and encryption enabled) to store the state files and a DynamoDB table to handle state locking, preventing concurrent operations from corrupting the infrastructure state.
