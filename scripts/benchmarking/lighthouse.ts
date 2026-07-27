import * as chromeLauncher from "chrome-launcher"
import lighthouse from "lighthouse"

import fs from "fs"

const REPORTS_DIR = "reports"
if (!fs.existsSync(REPORTS_DIR)) {
  fs.mkdirSync(REPORTS_DIR)
}

const chrome = await chromeLauncher.launch({ chromeFlags: ["--headless"] })
const options = {
  logLevel: "info" as const,
  output: "html" as const,
  onlyCategories: ["performance"],
  port: chrome.port,
}
const runnerResult = await lighthouse("https://easyshell.sh", options)
if (!runnerResult) {
  console.error("Lighthouse failed to run")
  process.exit(1)
}

// `.report` is the HTML report as a string
const reportHtml = runnerResult.report as string
fs.writeFileSync(`${REPORTS_DIR}/lighthouse-report.html`, reportHtml)

// `.lhr` is the Lighthouse Result as a JS object
console.log("Report is done for", runnerResult.lhr.finalDisplayedUrl)
console.log(
  "Performance score was",
  runnerResult.lhr.categories.performance!.score! * 100,
)
console.log(runnerResult.lhr)

fs.writeFileSync(
  `${REPORTS_DIR}/lighthouse-report.json`,
  JSON.stringify(runnerResult.lhr, null, 2),
)

chrome.kill()
