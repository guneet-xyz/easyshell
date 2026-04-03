# Problem Statement

A Deployment named `scale-app` is running in namespace `q34` with **2 replicas**. Traffic has increased and you need to scale it up to handle the load.

# Instructions

Scale the Deployment `scale-app` in namespace `q34` to **6** replicas.

You can verify your work by checking the deployment status:

```
kubectl get deployment scale-app -n q34
```

The `READY` column should show `6/6` when all pods are running.
