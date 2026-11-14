import type { ProblemConfig } from "@easyshell/problems/schema"

function testcaseConfig({
  id,
  isPublic,
  agent,
  target,
  deadline,
}: {
  id: number
  isPublic: boolean
  agent: string
  target: string
  deadline: string
}): ProblemConfig["testcases"][number] {
  return {
    id: id,
    public: isPublic,
    expected_stdout: `Agent ${agent}, your target is ${target}. You have until ${deadline}.\n`,
  }
}

const config: ProblemConfig = {
  id: 31,
  slug: "mission-briefing",
  title: "Mission Briefing",
  description: `This message will self-destruct... right after you load the variables. 🕶️`,
  difficulty: "easy",
  tags: ["variables", "source"],
  testcases: [
    testcaseConfig({
      id: 1,
      isPublic: true,
      agent: "Nightshade",
      target: "Kevin",
      deadline: "midnight",
    }),
    testcaseConfig({
      id: 2,
      isPublic: true,
      agent: "Moonpie",
      target: "Shellbeard",
      deadline: "Tuesday",
    }),
    testcaseConfig({
      id: 3,
      isPublic: false,
      agent: "Nightshade",
      target: "the Golden Rubber Duck",
      deadline: "Friday at 5pm",
    }),
    testcaseConfig({
      id: 4,
      isPublic: false,
      agent: "Bagel",
      target: "Melon Usk's backup rocket",
      deadline: "sunrise on Monday",
    }),
  ],
  tests: [
    {
      testcase: "all",
      pass: true,
      input: `. ./mission.env && echo "Agent $AGENT, your target is $TARGET. You have until $DEADLINE."`,
    },
    {
      testcase: "all",
      pass: true,
      input: `set -a; . ./mission.env; printf 'Agent %s, your target is %s. You have until %s.\\n' "$AGENT" "$TARGET" "$DEADLINE"`,
    },
    {
      testcase: "all",
      pass: true,
      input: `source mission.env\necho "Agent \${AGENT}, your target is \${TARGET}. You have until \${DEADLINE}."`,
    },
    {
      testcase: "all",
      pass: false,
      input: `echo "Agent $AGENT, your target is $TARGET. You have until $DEADLINE."`,
    },
    {
      testcase: [3, 4],
      pass: false,
      input: `AGENT=$(grep '^AGENT=' mission.env | cut -d= -f2)
TARGET=$(grep '^TARGET=' mission.env | cut -d= -f2)
DEADLINE=$(grep '^DEADLINE=' mission.env | cut -d= -f2)
echo "Agent $AGENT, your target is $TARGET. You have until $DEADLINE."`,
    },
  ],
}

export default config
