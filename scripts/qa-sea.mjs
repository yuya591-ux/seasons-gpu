import { chromium } from "playwright"
const port = process.env.PORT || "4801"
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 480, height: 860 }, deviceScaleFactor: 2 })
const errs = []
p.on("pageerror", (e) => errs.push(String(e)))
await p.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: "networkidle" })
await p.locator(".gate").click().catch(() => {})
await p.waitForTimeout(700)
await p.evaluate(() => window.__applyScene("kitaterao-window-3d"))
await p.waitForTimeout(2200)
await p.evaluate(() => { window.__town3dFly(true) })
await p.evaluate(() => { window.__town3dCruise(false) })
await p.waitForTimeout(1200)
const shot = async (x, y, z, yaw, pit, name) => {
  await p.evaluate(([x, y, z, ya, pi]) => window.__town3dFlyPose(x, y, z, ya, pi), [x, y, z, yaw, pit])
  await p.waitForTimeout(900)
  await p.screenshot({ path: `scripts/_shots/${name}.png` })
}
// 海上を低く（近景の海）／高く（水平線まで）
await shot(360, 12, -46, 0.0, -0.12, "sea-low")     // 江戸方向へ低空、海面を斜めに
await shot(300, 30, -46, 0.4, -0.22, "sea-high")    // やや高く、水平線まで
await shot(0, 26, 180, Math.PI, -0.18, "sea-south") // home南の沖を見下ろす
console.log(errs.length ? "ERR: " + errs.slice(0, 2).join(" | ") : "no errors")
await b.close()
