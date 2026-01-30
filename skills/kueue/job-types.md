# Kueue Job Types Reference

All job types require the `kueue.x-k8s.io/queue-name` label and resource requests.

## batch/v1 Job

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: sample-job
  labels:
    kueue.x-k8s.io/queue-name: user-queue
  annotations:
    kueue.x-k8s.io/job-min-parallelism: "2"      # Optional: partial admission
    kueue.x-k8s.io/max-exec-time-seconds: "3600" # Optional: timeout
spec:
  parallelism: 4
  completions: 4
  template:
    spec:
      containers:
        - name: worker
          image: busybox
          command: ["sleep", "300"]
          resources:
            requests:
              cpu: "1"
              memory: "1Gi"
      restartPolicy: Never
```

## JobSet

Each replicatedJob becomes a separate podSet in the Workload.

```yaml
apiVersion: jobset.x-k8s.io/v1alpha2
kind: JobSet
metadata:
  name: training-jobset
  labels:
    kueue.x-k8s.io/queue-name: user-queue
spec:
  replicatedJobs:
    - name: leader
      replicas: 1
      template:
        spec:
          parallelism: 1
          completions: 1
          template:
            spec:
              containers:
                - name: leader
                  image: training:latest
                  resources:
                    requests:
                      cpu: "2"
                      nvidia.com/gpu: "1"
    - name: workers
      replicas: 3
      template:
        spec:
          parallelism: 1
          completions: 1
          template:
            spec:
              containers:
                - name: worker
                  image: training:latest
                  resources:
                    requests:
                      cpu: "2"
                      nvidia.com/gpu: "1"
```

## PyTorchJob (Kubeflow)

Other Kubeflow jobs (TFJob, XGBoostJob, PaddleJob, JAXJob, MPIJob) follow the same pattern.

```yaml
apiVersion: kubeflow.org/v1
kind: PyTorchJob
metadata:
  name: pytorch-training
  labels:
    kueue.x-k8s.io/queue-name: ml-queue
spec:
  pytorchReplicaSpecs:
    Master:
      replicas: 1
      template:
        spec:
          containers:
            - name: pytorch
              image: pytorch/pytorch:latest
              resources:
                requests:
                  nvidia.com/gpu: "1"
    Worker:
      replicas: 3
      template:
        spec:
          containers:
            - name: pytorch
              image: pytorch/pytorch:latest
              resources:
                requests:
                  nvidia.com/gpu: "1"
```

## RayJob

**Important:** Set `shutdownAfterJobFinishes: true` for proper cleanup.

```yaml
apiVersion: ray.io/v1
kind: RayJob
metadata:
  name: ray-training
  labels:
    kueue.x-k8s.io/queue-name: user-queue
  annotations:
    kueue.x-k8s.io/elastic-job: "true"  # Optional: enable autoscaling
spec:
  shutdownAfterJobFinishes: true        # Required for Kueue
  entrypoint: python train.py
  rayClusterSpec:
    headGroupSpec:
      template:
        spec:
          containers:
            - name: ray-head
              resources:
                requests:
                  cpu: "2"
                  memory: "4Gi"
    workerGroupSpecs:
      - groupName: workers
        replicas: 2
        minReplicas: 1
        maxReplicas: 4
        template:
          spec:
            containers:
              - name: ray-worker
                resources:
                  requests:
                    cpu: "2"
                    memory: "4Gi"
```

## RayCluster

**Warning:** Holds quota while running. Delete when no longer needed.

```yaml
apiVersion: ray.io/v1
kind: RayCluster
metadata:
  name: ray-cluster
  labels:
    kueue.x-k8s.io/queue-name: user-queue
  annotations:
    kueue.x-k8s.io/elastic-job: "true"
spec:
  headGroupSpec:
    template:
      spec:
        containers:
          - name: ray-head
            resources:
              requests:
                cpu: "1"
  workerGroupSpecs:
    - groupName: workers
      replicas: 2
      template:
        spec:
          containers:
            - name: ray-worker
              resources:
                requests:
                  cpu: "2"
```

## Plain Pod

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: single-pod
  labels:
    kueue.x-k8s.io/queue-name: user-queue
spec:
  containers:
    - name: worker
      image: busybox
      command: ["sleep", "3600"]
      resources:
        requests:
          cpu: "1"
  restartPolicy: Never
```

## Pod Group (Gang Scheduling)

All pods admitted together or not at all. Each pod needs matching labels/annotations.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: worker-0
  labels:
    kueue.x-k8s.io/queue-name: user-queue
    kueue.x-k8s.io/pod-group-name: my-group
  annotations:
    kueue.x-k8s.io/pod-group-total-count: "3"
spec:
  containers:
    - name: worker
      resources:
        requests:
          cpu: "1"
# Create worker-1, worker-2 with same labels/annotations
```

To terminate: delete the Workload object, or set `kueue.x-k8s.io/retriable-in-group: false` on any pod.

## Deployment

On scale-out, new pods wait for quota. Use `lendingLimit` to reserve quota for serving.

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: inference-server
  labels:
    kueue.x-k8s.io/queue-name: serving-queue
spec:
  replicas: 3
  selector:
    matchLabels:
      app: inference
  template:
    metadata:
      labels:
        app: inference
    spec:
      containers:
        - name: server
          image: inference:latest
          resources:
            requests:
              cpu: "2"
              nvidia.com/gpu: "1"
```

## StatefulSet

Note: Scaling operations not currently supported.

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: database
  labels:
    kueue.x-k8s.io/queue-name: user-queue
spec:
  serviceName: db
  replicas: 3
  selector:
    matchLabels:
      app: db
  template:
    metadata:
      labels:
        app: db
    spec:
      containers:
        - name: db
          resources:
            requests:
              cpu: "2"
              memory: "4Gi"
```

## AppWrapper (Multi-component)

Wraps multiple resources as a single Kueue workload:

```yaml
apiVersion: workload.codeflare.dev/v1beta2
kind: AppWrapper
metadata:
  name: ml-pipeline
  labels:
    kueue.x-k8s.io/queue-name: user-queue
spec:
  components:
    - template:
        apiVersion: kubeflow.org/v1
        kind: PyTorchJob
        metadata:
          name: training
        spec: # ... PyTorchJob spec
    - template:
        apiVersion: v1
        kind: Service
        # ... Service spec
```
