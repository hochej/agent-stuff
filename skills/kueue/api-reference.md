# Kueue API Reference

## ResourceFlavor

Describes resource variations in a cluster (GPU models, zones, pricing tiers).

```yaml
apiVersion: kueue.x-k8s.io/v1beta2
kind: ResourceFlavor
metadata:
  name: "gpu-a100"
spec:
  nodeLabels:              # Match nodes with these labels
    cloud.provider.com/accelerator: nvidia-a100
  nodeTaints:              # Restricts to workloads that tolerate
    - key: nvidia.com/gpu
      value: "true"
      effect: NoSchedule
  tolerations:             # Auto-added to admitted workloads
    - key: nvidia.com/gpu
      operator: Exists
      effect: NoSchedule
  topologyName: "my-topology"  # For Topology-Aware Scheduling
```

**Empty flavor** for homogeneous clusters:
```yaml
apiVersion: kueue.x-k8s.io/v1beta2
kind: ResourceFlavor
metadata:
  name: "default-flavor"
```

## ClusterQueue

Cluster-scoped resource governing quotas and policies.

```yaml
apiVersion: kueue.x-k8s.io/v1beta2
kind: ClusterQueue
metadata:
  name: "team-cq"
spec:
  namespaceSelector:           # Which namespaces can use this queue
    matchLabels:
      team: my-team

  cohortName: "org-cohort"     # Join cohort for resource sharing

  queueingStrategy: BestEffortFIFO  # BestEffortFIFO | StrictFIFO

  stopPolicy: None             # None | Hold | HoldAndDrain

  resourceGroups:
    - coveredResources: ["cpu", "memory", "nvidia.com/gpu"]
      flavors:
        - name: "gpu-a100"     # Tried in order
          resources:
            - name: "nvidia.com/gpu"
              nominalQuota: 8       # Guaranteed quota
              borrowingLimit: 4     # Max to borrow from cohort
              lendingLimit: 2       # Max to lend to cohort
            - name: "cpu"
              nominalQuota: 32
            - name: "memory"
              nominalQuota: 128Gi
        - name: "on-demand"    # Fallback flavor
          resources:
            - name: "cpu"
              nominalQuota: 50

  preemption:
    withinClusterQueue: LowerPriority      # Never | LowerPriority | LowerOrNewerEqualPriority
    reclaimWithinCohort: LowerPriority     # Never | LowerPriority | Any
    borrowWithinCohort:
      policy: LowerPriority                # Never | LowerPriority
      maxPriorityThreshold: 100

  flavorFungibility:
    whenCanBorrow: TryNextFlavor           # TryNextFlavor | MayStopSearch
    whenCanPreempt: TryNextFlavor
    preference: BorrowingOverPreemption    # or PreemptionOverBorrowing

  admissionChecks:             # Checks for all workloads
    - provisioning-check

  admissionChecksStrategy:     # Per-flavor checks
    admissionChecks:
      - name: provisioning-check
        onFlavors: ["gpu-a100"]

  fairSharing:
    weight: 1                  # Relative weight in cohort
```

| Field | Description |
|-------|-------------|
| `namespaceSelector` | Limits which namespaces can use this queue |
| `cohortName` | Join a cohort to share/borrow resources |
| `queueingStrategy` | `BestEffortFIFO` (default): skip blocked workloads; `StrictFIFO`: strict ordering |
| `stopPolicy` | `Hold`: stop admitting; `HoldAndDrain`: also evict running |
| `nominalQuota` | Guaranteed resources |
| `borrowingLimit` | Max to borrow from cohort |
| `lendingLimit` | Max to lend to cohort |

## LocalQueue

Namespaced entry point for users.

```yaml
apiVersion: kueue.x-k8s.io/v1beta2
kind: LocalQueue
metadata:
  namespace: "team-namespace"
  name: "default"              # Name "default" enables auto-assignment
spec:
  clusterQueue: "team-cq"
  stopPolicy: None
  fairSharing:
    weight: "1"
```

## Workload

Auto-created by Kueue for each job. Rarely created manually.

```yaml
apiVersion: kueue.x-k8s.io/v1beta2
kind: Workload
metadata:
  name: job-sample-job-a1b2c
  namespace: team-a
spec:
  active: true                 # Can pause/resume
  queueName: team-a-queue
  priorityClassName: high-priority
  maximumExecutionTimeSeconds: 3600
  podSets:
    - name: main
      count: 3
      template:
        spec:
          containers:
            - name: worker
              resources:
                requests:
                  cpu: "2"
                  memory: 4Gi
status:
  admission:
    clusterQueue: team-a-cq
    podSetAssignments:
      - name: main
        count: 3
        flavors:
          cpu: gpu-a100
        resourceUsage:
          cpu: "6"
  conditions:
    - type: QuotaReserved
      status: "True"
    - type: Admitted
      status: "True"
```

**Lifecycle:** Pending → QuotaReserved → Admitted → Finished (or Evicted → Pending)

## WorkloadPriorityClass

Priority for queueing/preemption (independent from pod priority).

```yaml
apiVersion: kueue.x-k8s.io/v1beta2
kind: WorkloadPriorityClass
metadata:
  name: high-priority
value: 10000
description: "High priority workloads"
```

## Cohort

Groups ClusterQueues for borrowing unused quota.

```yaml
apiVersion: kueue.x-k8s.io/v1beta2
kind: Cohort
metadata:
  name: "org-cohort"
spec:
  parentName: "root-cohort"    # For hierarchical cohorts
  resourceGroups:              # Additional shared pool
    - coveredResources: ["cpu"]
      flavors:
        - name: "default-flavor"
          resources:
            - name: "cpu"
              nominalQuota: 100
              borrowingLimit: 50
              lendingLimit: 25
  fairSharing:
    weight: "0.75"
```

## AdmissionCheck

Mechanism for additional admission criteria.

```yaml
apiVersion: kueue.x-k8s.io/v1beta2
kind: AdmissionCheck
metadata:
  name: provisioning-check
spec:
  controllerName: kueue.x-k8s.io/provisioning-request
  parameters:
    apiGroup: kueue.x-k8s.io
    kind: ProvisioningRequestConfig
    name: prov-config
```

**Built-in controllers:**
- `kueue.x-k8s.io/provisioning-request` - Cluster autoscaler integration
- `kueue.x-k8s.io/multikueue` - Multi-cluster dispatching

**States:** `Pending` → `Ready` | `Retry` | `Rejected`

## Topology (for TAS)

Defines data center hierarchy for Topology-Aware Scheduling.

```yaml
apiVersion: kueue.x-k8s.io/v1alpha1
kind: Topology
metadata:
  name: "dc-topology"
spec:
  levels:
    - nodeLabel: topology.kubernetes.io/zone
    - nodeLabel: cloud.provider.com/topology-rack
    - nodeLabel: kubernetes.io/hostname
```

## Full Labels & Annotations Reference

| Label/Annotation | Purpose |
|-----------------|---------|
| `kueue.x-k8s.io/queue-name` | Target LocalQueue (required) |
| `kueue.x-k8s.io/priority-class` | WorkloadPriorityClass name |
| `kueue.x-k8s.io/job-uid` | Job UID (set by Kueue on Workload) |
| `kueue.x-k8s.io/job-min-parallelism` | Min parallelism for partial admission |
| `kueue.x-k8s.io/max-exec-time-seconds` | Max execution time before eviction |
| `kueue.x-k8s.io/elastic-job: "true"` | Enable scaling without suspension |
| `kueue.x-k8s.io/prebuilt-workload-name` | Use pre-created Workload |
| `kueue.x-k8s.io/pod-group-name` | Pod group for gang scheduling |
| `kueue.x-k8s.io/pod-group-total-count` | Total pods in group |
| `kueue.x-k8s.io/retriable-in-group` | Set "false" to terminate pod group |
| `kueue.x-k8s.io/podset-required-topology` | TAS: require same domain |
| `kueue.x-k8s.io/podset-preferred-topology` | TAS: prefer same domain |
| `kueue.x-k8s.io/podset-unconstrained-topology` | TAS: fill gaps |
| `kueue.x-k8s.io/podset-group-name` | TAS: group PodSets |
| `provreq.kueue.x-k8s.io/*` | ProvisioningRequest parameters |

## Workload Conditions

| Condition | Meaning |
|-----------|---------|
| `QuotaReserved: True` | Quota locked in ClusterQueue |
| `Admitted: True` | Workload can run |
| `Evicted: True` | Was evicted (see reason) |
| `Preempted: True` | Evicted due to preemption |
| `Finished: True` | Job completed |

**Eviction reasons:** `Preempted`, `PodsReadyTimeout`, `AdmissionCheck`, `ClusterQueueStopped`, `LocalQueueStopped`, `Deactivated`, `InactiveWorkload`
