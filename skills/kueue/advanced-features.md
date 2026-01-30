# Kueue Advanced Features

## Admission Process

### Phase 1: Quota Reservation

1. Evaluate workload's resource requests against ClusterQueue quotas
2. Select ResourceFlavors based on:
   - Workload's nodeSelector/affinity compatibility
   - Available quota (nominal + borrowable)
   - Flavor order (first fitting wins)
3. Reserve quota → `QuotaReserved` condition

### Phase 2: Admission Checks

1. All configured checks run concurrently
2. When all `Ready` → workload `Admitted`
3. If any `Rejected` → workload deactivated
4. If any `Retry` → quota released, requeued

### Flavor Selection

| Condition | Action |
|-----------|--------|
| Fits in nominalQuota | Use this flavor |
| Fits with borrowing | Use if `whenCanBorrow: MayStopSearch`, else try next |
| Fits with preemption | Use if `whenCanPreempt: MayStopSearch`, else try next |
| Doesn't fit | Try next flavor |

`preference: BorrowingOverPreemption` (default) prefers borrowing over preempting.

---

## Preemption

### Classic Preemption

Triggered when pending workload fits within nominalQuota but quota is borrowed.

**Candidate selection order:**
1. Same ClusterQueue workloads (per `withinClusterQueue` policy)
2. Cohort workloads that are borrowing (per `reclaimWithinCohort` policy)

**Sorting:** borrowing queues first → lowest priority → most recently admitted

**ClusterQueue preemption settings:**
```yaml
preemption:
  withinClusterQueue: LowerPriority      # Never | LowerPriority | LowerOrNewerEqualPriority
  reclaimWithinCohort: LowerPriority     # Never | LowerPriority | Any
  borrowWithinCohort:
    policy: LowerPriority                # Never | LowerPriority
    maxPriorityThreshold: 100
```

### Fair Sharing Preemption

Uses weighted share: `max(usage_above_nominal / lendable) / weight`

**Strategies:**
- `LessThanOrEqualToFinalShare`: Preempt if preemptor's final share ≤ preemptee's share after
- `LessThanInitialShare`: Preempt if preemptor's final share < preemptee's current share

Enable in Kueue config:
```yaml
fairSharing:
  preemptionStrategies:
    - LessThanOrEqualToFinalShare
    - LessThanInitialShare
```

---

## Fair Sharing

### Preemption-Based
ClusterQueue/Cohort weights determine relative share. Higher weight = more share.

### Admission Fair Sharing
Orders workloads by historical LocalQueue usage.

Enable per ClusterQueue:
```yaml
spec:
  admissionScope:
    admissionMode: UsageBasedAdmissionFairSharing
```

Configure in Kueue config:
```yaml
admissionFairSharing:
  usageHalfLifeTime: 168h        # Decay period
  usageSamplingInterval: 5m
```

---

## Topology-Aware Scheduling (TAS)

Optimizes pod placement for network locality.

### Setup

1. Create Topology:
```yaml
apiVersion: kueue.x-k8s.io/v1alpha1
kind: Topology
metadata:
  name: dc-topology
spec:
  levels:
    - nodeLabel: topology.kubernetes.io/zone
    - nodeLabel: cloud.provider.com/rack
    - nodeLabel: kubernetes.io/hostname
```

2. Reference from ResourceFlavor: `spec.topologyName: dc-topology`

3. Use in Job:
```yaml
spec:
  template:
    metadata:
      annotations:
        # Pick one:
        kueue.x-k8s.io/podset-preferred-topology: cloud.provider.com/rack
        # OR
        kueue.x-k8s.io/podset-required-topology: cloud.provider.com/rack
        # OR
        kueue.x-k8s.io/podset-unconstrained-topology: "true"
```

| Annotation | Behavior |
|------------|----------|
| `podset-preferred-topology` | Prefer same domain, distribute if needed |
| `podset-required-topology` | Must fit in same domain or fail |
| `podset-unconstrained-topology` | Fill gaps across cluster |

**Features:**
- Hot swap: Failed nodes replaced from same domain
- Balanced placement (alpha): Even distribution vs greedy packing

---

## MultiKueue (Multi-cluster)

Dispatches jobs across multiple clusters.

### Architecture
- **Manager cluster:** Coordinates admission
- **Worker clusters:** Run jobs, have their own Kueue

### Setup

1. Create kubeconfig secret:
```bash
kubectl create secret generic worker1-secret -n kueue-system \
  --from-file=kubeconfig=worker1.kubeconfig
```

2. Configure MultiKueue:
```yaml
apiVersion: kueue.x-k8s.io/v1beta2
kind: AdmissionCheck
metadata:
  name: multikueue-check
spec:
  controllerName: kueue.x-k8s.io/multikueue
  parameters:
    apiGroup: kueue.x-k8s.io
    kind: MultiKueueConfig
    name: mk-config
---
apiVersion: kueue.x-k8s.io/v1beta2
kind: MultiKueueConfig
metadata:
  name: mk-config
spec:
  clusters:
    - name: worker1
    - name: worker2
---
apiVersion: kueue.x-k8s.io/v1beta2
kind: MultiKueueCluster
metadata:
  name: worker1
spec:
  kubeConfig:
    locationType: Secret
    location: worker1-secret
```

**Dispatching algorithms:**
- `AllAtOnce` (default): Copy to all workers
- `Incremental`: Add workers gradually
- `External`: Custom controller decides

---

## ProvisioningRequest

Integrates with cluster autoscaler.

```yaml
apiVersion: kueue.x-k8s.io/v1beta2
kind: AdmissionCheck
metadata:
  name: prov-check
spec:
  controllerName: kueue.x-k8s.io/provisioning-request
  parameters:
    apiGroup: kueue.x-k8s.io
    kind: ProvisioningRequestConfig
    name: prov-config
---
apiVersion: kueue.x-k8s.io/v1beta2
kind: ProvisioningRequestConfig
metadata:
  name: prov-config
spec:
  provisioningClassName: check-capacity.autoscaling.x-k8s.io
  managedResources: ["nvidia.com/gpu"]
  retryStrategy:
    backoffLimitCount: 3
    backoffBaseSeconds: 60
```

Pass parameters via job annotations: `provreq.kueue.x-k8s.io/ValidUntilSeconds: "600"`

---

## Kueue Configuration

Key settings in `kueue-manager-config` ConfigMap:

```yaml
apiVersion: config.kueue.x-k8s.io/v1beta2
kind: Configuration
namespace: kueue-system

manageJobsWithoutQueueName: true

waitForPodsReady:
  timeout: 10m
  blockAdmission: true
  requeuingStrategy:
    backoffLimitCount: 5
    backoffBaseSeconds: 60

objectRetentionPolicies:
  workloads:
    afterFinished: 1h

integrations:
  frameworks:
    - "batch/job"
    - "jobset.x-k8s.io/jobset"
    - "kubeflow.org/pytorchjob"
    - "ray.io/rayjob"
    - "pod"
```

Restart after changes: `kubectl rollout restart deploy kueue-controller-manager -n kueue-system`

---

## Feature Gates

| Feature | Stage | Default |
|---------|-------|---------|
| `MultiKueue` | Beta | On |
| `TopologyAwareScheduling` | Beta | On |
| `LendingLimit` | Beta | On |
| `AdmissionFairSharing` | Beta | On |
| `PartialAdmission` | Beta | On |
| `ElasticJobsViaWorkloadSlices` | Alpha | Off |
| `TASBalancedPlacement` | Alpha | Off |

---

## Installation

```bash
# kubectl
kubectl apply --server-side -f https://github.com/kubernetes-sigs/kueue/releases/download/v0.10.0/manifests.yaml
kubectl wait deploy/kueue-controller-manager -n kueue-system --for=condition=available --timeout=5m

# Helm
helm install kueue oci://registry.k8s.io/kueue/charts/kueue \
  --namespace kueue-system --create-namespace
```
