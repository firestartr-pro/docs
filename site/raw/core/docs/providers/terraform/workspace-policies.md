## Terraform Provider Policies & Operation Security

The `policy` setting in the `providers.terraform` block acts as the primary security gate for all infrastructure operations. Each policy defines the controller's level of authority over the Terraform workspace through a set of **allowed operations**.

### Policy Hierarchy

Firestartr uses a hierarchical system to determine policy compatibility. Policies range from read-only observation to full lifecycle management.

| Policy Name | Aliases | Allowed Operations |
| :--- | :--- | :--- |
| `full-control` | N/A | `UPDATED`, `CREATED`, `RENAMED`, `SYNC`, `MARKED_TO_DELETION`, `RETRY`, `NOTHING` |
| `apply` | `create-update-only` | `UPDATED`, `CREATED`, `RENAMED`, `SYNC`, `RETRY`, `NOTHING` |
| `observe` | `observe-only` | `SYNC` |
| `create-only` | N/A | `CREATED`, `RETRY`, `SYNC` |

### Detailed Operation Mapping for Terraform

Each policy explicitly enables a set of internal controller actions during a Terraform run:

* **`SYNC`**: Allowed by all policies. This enables the controller to fetch the current state and perform a `terraform plan` to identify drift.
* **`CREATED`**: Permits the initial `terraform apply` to create new resources. Enabled in `full-control`, `apply`, and `create-only`.
* **`UPDATED` / `RENAMED`**: Allows modification of existing infrastructure through `terraform apply`. These are restricted in `observe` and `create-only` policies to prevent state changes.
* **`MARKED_TO_DELETION`**: The most sensitive operation. It grants permission to perform a `terraform destroy` or remove resources from state. **Only** permitted under the `full-control` policy.
* **`RETRY`**: Allows the controller to automatically re-attempt a failed Terraform run. Available in all policies except `observe`.
* **`NOTHING`**: Allows the controller to run and perform no operation. Available in all policies.

---

### General Policy vs. Sync Policy

To get more information about sync you can check [Workspace Synchronization](./workspace-sync.md).

In a `TFWorkspaceClaim`, you define policies in two different places. Understanding their distinct roles is key to a secure configuration:

1. **General Provider Policy (`providers.terraform.policy`)**:
   * **Definition**: This is the "Master Gate". It defines the maximum level of authority that the Firestartr controller has over this specific workspace.
   * **Scope**: It affects every operation, including manual triggers, initial provisioning, and automated tasks.
   * **Security Role**: It acts as a safety guardrail. For example, if set to `apply`, the controller is physically prevented from performing a `destroy` operation, even if a user or a script requests it.

2. **Sync Policy (`providers.terraform.sync.policy`)**:
   * **Definition**: This is the "Execution Permission" for scheduled tasks. It defines what the controller is allowed to do during an automated synchronization cycle (defined by `period` or `schedule`).
   * **Scope**: It only applies to background synchronization events.
   * **Security Role**: It allows you to have a permissive workspace (e.g., `full-control` for manual fixes) but a conservative background process (e.g., `observe` only for automated drift detection).

> **Crucial Concept**: The **Sync Policy** can never exceed the permissions granted by the **General Policy**.

---

## Policy Compatibility Logic

When using scheduled synchronization (`providers.terraform.sync`), Firestartr validates that the `sync.policy` is compatible with the general `providers.terraform.policy`.

### Validation Rule
For a synchronization cycle to be valid, the **General Policy** must be at least as permissive as the **Sync Policy**. In other words, you cannot grant a background sync task more authority than the workspace itself has.

#### Compatibility Scenarios:
* **Valid**: General Policy `full-control` and Sync Policy `apply`. The workspace allows everything, but the sync task is restricted to only performing updates.
* **Valid**: General Policy `apply` and Sync Policy `observe`. The workspace allows updates, but the scheduled sync only monitors for drift without applying changes.
* **Invalid**: General Policy `observe` and Sync Policy `apply`. This will throw a `Policy {syncPolicy} or {generalPolicy} not compatible` error because the scheduled task is trying to perform updates (`apply`) that are forbidden by the workspace's master policy (`observe`).

---

## Technical Summary of Aliases

To maintain flexibility and backward compatibility in your `TFWorkspaceClaim` definitions, the following aliases are resolved internally:

1.  **`create-update-only`**: Maps to **`apply`**. Ideal for GitOps flows where deletions are not desired.
2.  **`observe-only`**: Maps to **`observe`**. Best for strictly read-only monitoring.
