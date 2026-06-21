import { chromium } from "playwright"
import fs from "fs"
const port = process.env.PORT || "4801"
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 480, height: 880 }, deviceScaleFactor: 2 })
const errs = []
p.on("pageerror", (e) => errs.push(String(e)))
await p.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: "networkidle" })
await p.locator(".gate").click().catch(() => {})
await p.waitForTimeout(700)
await p.evaluate(() => window.__applyScene("kitaterao-window-3d"))
await p.waitForTimeout(2600)
const dirs = await p.evaluate(() => window.__town3dSpriteDirs(0))
for (let d = 0; d < dirs; d++) {
  const url = await p.evaluate((dd) => window.__town3dSpriteTex(0, dd), d)
  if (url) fs.writeFileSync(`scripts/_shots/bake-${d}.png`, Buffer.from(url.split(",")[1], "base64"))
}
console.log(errs.length ? "ERR " + errs.slice(0, 2).join(" | ") : `dirs ${dirs} no errors`)
await b.close()
