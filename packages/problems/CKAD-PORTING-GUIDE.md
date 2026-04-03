# CKAD Problem Porting Guide

How to port problems from `/home/guneet/projects/playground/CKAD-2026/` into EasyShell's live-environment problem system.

## Source Format

Each source problem (`Q01` through `Q78`) has:

| File          | Purpose                                |
| ------------- | -------------------------------------- |
| `QUESTION.md` | Task description and requirements      |
| `ANSWER.md`   | Reference solution                     |
| `setup.sh`    | Creates K8s resources for the exercise |
| `check.sh`    | Validates and scores the solution      |

## Target Format

Each EasyShell problem lives in `packages/problems/data/problems/<slug>/`:

| File         | Purpose                                                            |
| ------------ | ------------------------------------------------------------------ |
| `config.ts`  | Problem metadata (id, slug, title, difficulty, tags, check config) |
| `page.md`    | Problem statement shown to the user (adapted from QUESTION.md)     |
| `setup.sh`   | Copied from source (may need minor edits)                          |
| `check.sh`   | Copied from source (may need minor edits)                          |
| `hints/1.md` | First hint (generated from ANSWER.md)                              |
| `hints/2.md` | Second hint, etc.                                                  |

## Step-by-Step Porting Process

### 1. Scaffold the problem

```bash
pnpm run new <slug> --type live-environment
# e.g., pnpm run new create-secret-from-env --type live-environment
```

This creates the directory with template files. The `--type live-environment` flag generates `config.ts`, `page.md`, `setup.sh`, `check.sh`, and `hints/1.md`.

### 2. Choose a slug

Convert the source question title to a slug:

- Lowercase
- Replace spaces with hyphens
- Remove articles (a, the) if they make it too long
- Keep it descriptive but under ~40 chars

Examples:
| Source | Slug |
|--------|------|
| Q01 - Create Secret from Hardcoded Variables | `create-secret-from-env` |
| Q09 - Perform Rolling Update and Rollback | `rolling-update-rollback` |
| Q34 - Scale Deployment | `scale-deployment` |
| Q63 - Create NetworkPolicy Default Deny All | `networkpolicy-default-deny` |

### 3. Fill in config.ts

```typescript
import type { LiveEnvironmentProblemConfigInput } from "@easyshell/problems/schema"

const config: LiveEnvironmentProblemConfigInput = {
  type: "live-environment",
  id: <auto-assigned by scaffold>,
  slug: "<slug>",
  title: "<human-readable title>",
  description: "<one-sentence description>",
  difficulty: "easy" | "medium" | "hard",
  tags: ["CKAD", ...relevant-k8s-tags],
  check: {
    totalPoints: <number from check.sh>,
  },
}

export default config
```

**Determining `totalPoints`**: Open the source `check.sh` and find the `total=N` line near the top of the checks section. That's your `totalPoints`.

**Determining `difficulty`**:

- `easy`: Single kubectl command (e.g., scale, expose, create secret)
- `medium`: Multiple steps or YAML editing (e.g., multi-container pods, probes, RBAC)
- `hard`: Complex debugging or multi-resource orchestration (e.g., NetworkPolicies with egress rules, Ingress with TLS)

**Tags**: Always include `"CKAD"`. Add relevant Kubernetes resource tags like `"deployment"`, `"service"`, `"secret"`, `"networkpolicy"`, `"rbac"`, `"probe"`, `"volume"`, etc.

### 4. Copy setup.sh

Copy the source `setup.sh` directly:

```bash
cp "/home/guneet/projects/playground/CKAD-2026/Q<NN> - <Title>/setup.sh" \
   packages/problems/data/problems/<slug>/setup.sh
```

**Important checks**:

- Ensure `set -euo pipefail` is at the top
- The script must use `kubectl` commands (KUBECONFIG is set by the entrypoint)
- All `kubectl rollout status` / `kubectl wait` commands should have `--timeout=60s` or similar
- Image references must use images that k3s can pull (k3s has network access). Standard images like `nginx:latest`, `busybox`, `alpine` all work
- End with an echo like `echo "Setup complete for <slug>"`
- DO NOT use `kubectl apply -f <url>` pointing to external URLs that might be unreliable

### 5. Copy check.sh

Copy the source `check.sh` directly:

```bash
cp "/home/guneet/projects/playground/CKAD-2026/Q<NN> - <Title>/check.sh" \
   packages/problems/data/problems/<slug>/check.sh
```

**Important**: The check scripts from the source repo already follow the expected format with:

- ANSI color codes (stripped server-side by the `/check` endpoint)
- `PASS`/`FAIL` lines parsed by the UI's `CheckOutputDisplay` component
- `Score: X/Y` on the last line (parsed by the session-manager's `/check` endpoint)

No modifications should be needed for most check scripts.

### 6. Write page.md

Adapt `QUESTION.md` into EasyShell's format:

```markdown
# Problem Statement

<Rewrite the scenario. Be concise but clear about what exists and what needs to change.>

# Instructions

<Numbered list of specific tasks the user must complete.>

<Optional: kubectl commands to verify their work.>
```

Key differences from source:

- Remove the `## Docs` section (EasyShell has its own wiki system)
- Remove references to question numbers (EasyShell uses slugs)
- Keep `kubectl` verification commands -- they help users self-check

### 7. Write hints

Create `hints/1.md`, `hints/2.md`, etc. Derive these from `ANSWER.md`:

- **Hint 1**: A conceptual nudge (e.g., "Use `kubectl scale` to adjust replica count")
- **Hint 2**: The specific command or approach without full YAML
- **Hint 3** (optional): The complete solution from ANSWER.md

For simple problems, 2 hints suffice. For complex problems, 3-4 hints that progressively reveal the solution.

### 8. Add to a series

Edit `packages/problems/data/series.ts` and add the slug to the appropriate CKAD series section.

The 5 CKAD exam domains map to series:

| Series Slug                        | Domain                             | Source Questions                |
| ---------------------------------- | ---------------------------------- | ------------------------------- |
| `ckad-application-design-build`    | Application Design & Build         | Q05, Q17-Q30                    |
| `ckad-application-deployment`      | Application Deployment             | Q06, Q08-Q09, Q31, Q34-Q42      |
| `ckad-observability-maintenance`   | App Observability & Maintenance    | Q10, Q43-Q53                    |
| `ckad-environment-config-security` | App Environment, Config & Security | Q01-Q04, Q11, Q16, Q41, Q54-Q69 |
| `ckad-services-networking`         | Services & Networking              | Q07, Q12-Q15, Q70-Q78           |

Some questions overlap domains. Place them in the most relevant one.

### 9. Generate workflows

```bash
pnpm run generate-workflows
```

This creates CI workflow files for the new problem. Live-environment problems automatically get:

- Extended timeouts (15min test, 20min push)
- Additional trigger paths for `k3s-base/` and `apps/entrypoint/`

### 10. Test locally

```bash
# Build the problem image
pnpm run build <slug>

# Run tests (validates setup.sh/check.sh exist, config parses correctly)
pnpm run test <slug>
```

Full end-to-end testing (running k3s, executing setup.sh, running check.sh) requires Docker and is not automated yet. To test manually:

```bash
# Run the built image
docker run --rm -it --privileged \
  --cgroupns=private \
  --tmpfs /run --tmpfs /var/run \
  easyshell-<slug>-1 \
  -mode k3s-session

# Wait for "K3s is ready" message, then in another terminal:
docker exec -it <container-id> /check.sh
```

## Special Considerations

### Q05 (Podman)

Q05 requires `podman` which is NOT available in the k3s container. This problem either needs to be skipped or the Dockerfile needs to install podman. Consider deferring this one.

### NetworkPolicy Problems (Q07, Q63, Q74-Q76)

NetworkPolicies require a CNI that supports them. k3s ships with Flannel by default which does NOT enforce NetworkPolicies. For these problems, the k3s container needs to be started with `--flannel-backend=none` and Calico installed. This is possible but adds complexity and startup time. Consider grouping these and handling them as a batch.

### Image Pull Latency

Some problems create Deployments that need to pull images (nginx, busybox, etc.). Inside k3s-in-Docker, the first pull takes time. Setup scripts should use `kubectl rollout status --timeout=120s` to ensure resources are ready before the user starts.

### Resource Constraints

The k3s container runs with limited resources. Problems that create many pods (e.g., scaling to high replica counts, multiple deployments) may hit resource limits. The session-manager creates containers with configurable memory/CPU. The defaults should be verified against resource-hungry problems.

## Domain-to-Problem Mapping

For reference, here is the full mapping of source questions to CKAD domains:

### Application Design & Build

Q05, Q17, Q18, Q19, Q20, Q21, Q22, Q23, Q24, Q25, Q26, Q27, Q28, Q29, Q30

### Application Deployment

Q06, Q08, Q09, Q31, Q34, Q35, Q36, Q37, Q38, Q39, Q40, Q41, Q42

### Application Observability & Maintenance

Q10, Q43, Q44, Q45, Q46, Q47, Q48, Q49, Q50, Q51, Q52, Q53

### Application Environment, Configuration & Security

Q01, Q02, Q03, Q04, Q11, Q16, Q33, Q54, Q55, Q56, Q57, Q58, Q59, Q60, Q61, Q62, Q63, Q64, Q65, Q66, Q67, Q68, Q69

### Services & Networking

Q07, Q12, Q13, Q14, Q15, Q32, Q70, Q71, Q72, Q73, Q74, Q75, Q76, Q77, Q78
