# Olympia Phase 2 Contract

This document locks the names, labels, annotations, secrets, paths, and network surfaces that Phase 1 (olympia provisioning) hands to Phase 2 (mustang, the session controller). Every identifier below is a public API between the two phases. Changing any of these values is a breaking change and requires a coordinated update across both codebases.

Phase 2 code MUST treat the values here as constants. Phase 1 code (setup.sh, GC controller, ssh-router, policy templates) MUST emit exactly these values.

## Namespace Naming

Each interactive session gets its own Kubernetes namespace. The namespace name is the session identifier.

- Pattern: `^session-[a-z0-9]{8}$`
- Prefix: `session-` (literal)
- Suffix: exactly 8 characters, lowercase alphanumeric (`[a-z0-9]`)
- Total length: 16 characters
- Generator: mustang (Phase 2). Phase 1 never creates session namespaces directly.
- Examples: `session-a1b2c3d4`, `session-9zk4q0pm`

Olympia components (GC, ssh-router) MUST filter on this exact pattern. Anything that does not match is out of scope and MUST be left untouched.

## Labels

All labels live under the `easyshell.sh/` prefix. Phase 2 stamps these on every session namespace.

| Label key | Required | Value | Purpose |
|---|---|---|---|
| `easyshell.sh/session` | yes | `true` | Marks a namespace as a session namespace. GC and ssh-router MUST require this label before acting. |
| `easyshell.sh/problem-id` | optional | problem slug, DNS-1123 | Links session to the problem the user is solving. |
| `easyshell.sh/user-id` | optional | UUID v4 | Links session to the owning user. |

The `easyshell.sh/session=true` label is the safety gate. The GC controller MUST refuse to delete a namespace that lacks this label, even if the name matches the pattern.

## Annotations

Annotations carry mutable session state. Phase 2 updates these continuously while the session is alive.

| Annotation key | Format | Updated by | Read by |
|---|---|---|---|
| `easyshell.sh/last-activity-at` | RFC 3339 timestamp, UTC, e.g. `2026-01-15T12:34:56Z` | mustang (on user activity) | GC controller |

Rules for `easyshell.sh/last-activity-at`:

- Missing annotation: GC treats the namespace as expired and deletes it.
- Unparseable value: GC treats the namespace as expired and deletes it.
- Value in the future: GC treats it as fresh (clock skew tolerated).

The GC inactivity threshold is **300 seconds** (5 minutes). This is hard-coded in the Phase 1 GC controller. If `now() - last-activity-at > 300s`, the namespace is deleted. Mustang MUST refresh the annotation more often than once every 300 seconds for sessions it considers alive.

## Secrets

### registry-creds

The cluster pulls images from a private internal registry. The credentials live in a single source-of-truth secret created by `setup.sh`:

- Namespace: `kube-system`
- Name: `registry-creds`
- Type: `kubernetes.io/dockerconfigjson`
- Key: `.dockerconfigjson`
- Contents: docker config JSON for `registry.registry.svc.cluster.local:5000` with the htpasswd-issued credentials

Mustang MUST, for every new session namespace:

1. Read `kube-system/registry-creds`.
2. Create an identical `kubernetes.io/dockerconfigjson` secret named `registry-creds` inside the session namespace.
3. Attach it as an `imagePullSecret` to the session pod's ServiceAccount (or directly on the pod spec).

Mustang MUST NOT mutate the source secret in `kube-system`.

## Registry

The in-cluster image registry serves problem runtime images.

- Cluster-internal endpoint: `registry.registry.svc.cluster.local:5000`
- Transport: plain HTTP. No TLS.
- Authentication: htpasswd basic auth, materialized as the `registry-creds` dockerconfigjson secret above.
- External exposure: none. No Ingress, no NodePort, no LoadBalancer. The registry is reachable only from pods inside the cluster and from the k3s node itself.

k3s mirror configuration file (written by `setup.sh` before k3s starts):

- Path: `/etc/rancher/k3s/registries.yaml`
- Effect: k3s containerd treats `registry.registry.svc.cluster.local:5000` as an HTTP mirror with the configured credentials, so pods can reference images by that hostname without per-pod auth boilerplate beyond `imagePullSecrets`.

### Image Tag Convention

Images published to the internal registry follow:

```
registry.registry.svc.cluster.local:5000/<problem-slug>:<runtime-version>
```

- `<problem-slug>`: DNS-1123 label, matches `easyshell.sh/problem-id`.
- `<runtime-version>`: semver or short SHA, locked per problem release.

Phase 5 (image publishing) writes to this path. Phase 2 (mustang) MUST construct pod image references using exactly this format.

## RBAC

Phase 1 does NOT create mustang's RBAC. Phase 2 owns this. This section locks the names so other Phase 1 work (policy templates, GC controller scope) lines up.

- ServiceAccount: `mustang/mustang` (namespace `mustang`, name `mustang`)
- ClusterRole: grants verbs `*` on these resources:
  - `namespaces`
  - `pods`
  - `services`
  - `networkpolicies`
  - `resourcequotas`
  - `limitranges`
  - `roles`
  - `rolebindings`
  - `serviceaccounts`
  - `secrets`
  - `persistentvolumeclaims`
- ClusterRoleBinding: binds the ClusterRole to `mustang/mustang`.

The `mustang` namespace itself is created by Phase 2's bootstrap, not by `setup.sh`.

## Tunnel

Olympia joins a Tailscale tailnet during `setup.sh` via an interactive `tailscale up`. All control-plane traffic to mustang rides this tunnel.

- Tailscale interface name on the node: `tailscale0`
- Mustang HTTP API (Phase 2): MUST bind only to `tailscale0`. It MUST NOT listen on `0.0.0.0`, the public interface, or `eth0`.
- Tailscale-internal hostname format: `<TAILSCALE_HOSTNAME>.<tailnet-name>.ts.net`
  - Default `TAILSCALE_HOSTNAME` is `olympia`, so the default DNS name is `olympia.<tailnet-name>.ts.net`.
  - `<tailnet-name>` is determined by the Tailscale account that authorizes the node.
- k3s API server (port 6443): NOT exposed on the public interface. Reachable only via `tailscale0` and loopback.

ssh-router (Phase 1) listens on the public SSH port. Mustang HTTP (Phase 2) does not.

## Phase 2 Checklist

When mustang accepts a "create session" request, it MUST perform, in order:

1. Generate an 8-char `[a-z0-9]` suffix and form the namespace name `session-<suffix>`. Confirm it matches `^session-[a-z0-9]{8}$`.
2. Create the namespace with labels:
   - `easyshell.sh/session=true` (required)
   - `easyshell.sh/problem-id=<slug>` (when known)
   - `easyshell.sh/user-id=<uuid>` (when known)
3. Set annotation `easyshell.sh/last-activity-at` to the current time in RFC 3339 UTC.
4. Read `kube-system/registry-creds` and create a matching `kubernetes.io/dockerconfigjson` secret named `registry-creds` inside the new session namespace.
5. Apply the Phase 1 policy templates (NetworkPolicy, ResourceQuota, LimitRange) into the session namespace.
6. Create the session ServiceAccount and attach `registry-creds` as an `imagePullSecret`.
7. Launch the session pod using an image of the form `registry.registry.svc.cluster.local:5000/<problem-slug>:<runtime-version>`.
8. While the session is active, refresh `easyshell.sh/last-activity-at` on every user keystroke (or at minimum every 60 seconds) so the GC controller's 300-second window never closes on a live session.
9. On explicit session termination, delete the namespace. The GC controller is the fallback, not the primary cleanup path.

Mustang MUST NOT:

- Touch namespaces that do not match `^session-[a-z0-9]{8}$`.
- Touch namespaces that lack `easyshell.sh/session=true`.
- Mutate `kube-system/registry-creds`.
- Bind any service to a non-`tailscale0` interface.
- Push images to the registry. That is Phase 5's job.
