import type { LiveEnvironmentProblemConfigInput } from "@easyshell/problems/schema"

const config: LiveEnvironmentProblemConfigInput = {
  type: "live-environment",
  id: 26,
  slug: "scale-deployment",
  title: "Scale a Deployment",
  description:
    "Scale a Kubernetes Deployment to handle increased traffic by adjusting the replica count.",
  difficulty: "easy",
  tags: ["kubectl", "deployment", "scale"],
  check: {
    totalPoints: 2,
  },
  tests: [
    {
      input: "kubectl scale deployment scale-app -n q34 --replicas=6",
      pass: true,
    },
    {
      input: "",
      pass: false,
    },
  ],
}

export default config
