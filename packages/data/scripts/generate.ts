import { generateProblemsData, generateProblemConfigData} from "../problems/generate";
import { generateWikiData } from "../wiki/generate";

async function main() {
  await generateProblemConfigData()
  await generateProblemsData()
  await generateWikiData()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

