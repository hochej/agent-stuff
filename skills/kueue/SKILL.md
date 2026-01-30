---
name: kueue
description: >
  Manage Kueue, the Kubernetes-native job queuing system. Use when working with
  Kueue resources (ClusterQueues, LocalQueues, ResourceFlavors, Workloads),
  submitting jobs, configuring quotas, fair sharing, preemption, or
  troubleshooting.
---

# Kueue - Kubernetes Job Queuing System

Kueue manages quotas and controls when jobs should wait, be admitted, or be
preempted by controlling `.spec.suspend`.

## Quick Start - Minimal Setup

```yaml
# 1. ResourceFlavor (cluster-scoped) - empty for homogeneous clusters
apiVersion: kueue.x-k8s.io/v1beta2
kind: ResourceFlavor
metadata:
  name: default-flavor
---
# 2. ClusterQueue (cluster-scoped) - defines quotas
apiVersion: kueue.x-k8s.io/v1beta2
kind: ClusterQueue
metadata:
  name: cluster-queue
spec:
  namespaceSelector: {} # All namespaces
  resourceGroups:
    - coveredResources: ["cpu", "memory"]
      flavors:
        - name: default-flavor
          resources:
            - name: cpu
              nominalQuota: 10
            - name: memory
              nominalQuota: 32Gi
---
# 3. LocalQueue (namespaced) - users submit here
apiVersion: kueue.x-k8s.io/v1beta2
kind: LocalQueue
metadata:
  name: user-queue
  namespace: default
spec:
  clusterQueue: cluster-queue
---
# 4. Job with queue label
apiVersion: batch/v1
kind: Job
metadata:
  name: my-job
  labels:
    kueue.x-k8s.io/queue-name: user-queue # Required
spec:
  template:
    spec:
      containers:
        - name: work
          image: busybox
          command: ["sleep", "60"]
          resources:
            requests: # Kueue uses requests for quota
              cpu: "1"
              memory: "1Gi"
      restartPolicy: Never
```

## Core Concepts

```
User submits Job → Webhook suspends → Workload created → LocalQueue → ClusterQueue
                                                                          ↓
Job unsuspended ← Workload Admitted ← Checks pass ← Quota Reserved
```

**API Hierarchy:** `ResourceFlavor` → `ClusterQueue` → `LocalQueue` → `Workload`
(auto-created)

| Object         | Scope     | Purpose                                        |
| -------------- | --------- | ---------------------------------------------- |
| ResourceFlavor | Cluster   | Describes node types (GPU models, zones, etc.) |
| ClusterQueue   | Cluster   | Defines quotas, preemption, cohort membership  |
| LocalQueue     | Namespace | Entry point for users, points to ClusterQueue  |
| Workload       | Namespace | Auto-created per job, tracks admission state   |

## Quick Reference Commands

```bash
# List resources
kubectl get clusterqueues
kubectl get localqueues -n <namespace>
kubectl get workloads -A

# Check status
kubectl describe clusterqueue <name>
kubectl describe workload <name> -n <namespace>

# Find workload for job
kubectl get workloads -n <ns> -l "kueue.x-k8s.io/job-uid=$(kubectl get job <name> -n <ns> -o jsonpath='{.metadata.uid}')"

# kubectl-kueue plugin
kubectl kueue list clusterqueue
kubectl kueue stop clusterqueue <name>
kubectl kueue resume clusterqueue <name>
```

## Running Jobs - Common Pattern

All job types need:

1. Label: `kueue.x-k8s.io/queue-name: <localqueue-name>`
2. Container `resources.requests` (used for quota calculation)

```yaml
metadata:
  labels:
    kueue.x-k8s.io/queue-name: user-queue
spec:
  template:
    spec:
      containers:
        - resources:
            requests:
              cpu: "2"
              memory: "4Gi"
```

**Supported types:** Job, JobSet, PyTorchJob, TFJob, RayJob, RayCluster, Pod,
Deployment, StatefulSet, and more.

See [job-types.md](./job-types.md) for detailed examples of each type.

## Key Labels & Annotations

| Label/Annotation                       | Purpose                               |
| -------------------------------------- | ------------------------------------- |
| `kueue.x-k8s.io/queue-name`            | Target LocalQueue (required)          |
| `kueue.x-k8s.io/priority-class`        | WorkloadPriorityClass name            |
| `kueue.x-k8s.io/job-min-parallelism`   | Min parallelism for partial admission |
| `kueue.x-k8s.io/max-exec-time-seconds` | Auto-evict after timeout              |
| `kueue.x-k8s.io/pod-group-name`        | Gang scheduling group                 |

## Workload Conditions

| Condition             | Meaning                    |
| --------------------- | -------------------------- |
| `QuotaReserved: True` | Quota locked               |
| `Admitted: True`      | Ready to run               |
| `Evicted: True`       | Was evicted (check reason) |
| `Finished: True`      | Completed                  |

## Troubleshooting

### Job Not Starting

```bash
# 1. Check if suspended
kubectl get job <name> -o jsonpath='{.spec.suspend}'

# 2. Find workload and check conditions
kubectl get workloads -n <ns> | grep <job>
kubectl describe workload <workload-name> -n <ns>

# 3. Check queue status
kubectl get localqueue <queue> -n <ns>
kubectl get clusterqueue <cq> -o jsonpath='{.status.conditions}'
```

**Common issues:**

- `insufficient quota for cpu` → Not enough quota in ClusterQueue
- `LocalQueue doesn't exist` → Typo in queue name
- `ClusterQueue is inactive` → Missing ResourceFlavor or AdmissionCheck

### ClusterQueue Inactive

```bash
kubectl get clusterqueue <name> -o jsonpath='{.status.conditions[?(@.type=="Active")]}'
```

Causes: Missing ResourceFlavor, missing AdmissionCheck, invalid resourceGroups.

### Pods Pending After Admission

Job admitted but pods not scheduling:

```bash
kubectl describe pod <pod-name>
```

Check: nodeSelector mismatch, taints not tolerated, ResourceFlavor labels don't
match nodes.

## Best Practices

1. **Always specify resource requests** - Kueue uses requests for quota
2. **Set execution time limits** - Prevents runaway jobs holding quota
3. **Use partial admission for flexible jobs** - `job-min-parallelism`
   annotation
4. **Delete RayClusters when done** - They hold quota while running
5. **Use `lendingLimit` for serving workloads** - Reserve quota for Deployments

## Additional Reference

- [job-types.md](./job-types.md) - Detailed examples for each job type
- [api-reference.md](./api-reference.md) - Full API object specifications
- [advanced-features.md](./advanced-features.md) - TAS, MultiKueue, Preemption,
  Fair Sharing
