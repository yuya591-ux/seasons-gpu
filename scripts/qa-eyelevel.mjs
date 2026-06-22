// 歩行＝目線の高さの街並み評価: 代表的な場所に着地して一人称の眺めを撮る
import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 960, height: 600 }, deviceScaleFactor: 2 })
const errs = []
p.on('pageerror', (e) => errs.push(String(e)))
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()) })
await p.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(() => {})
await p.waitForTimeout(800)
const scene = process.env.SCENE || 'kitaterao-window-3d-sunset'
await p.evaluate((s) => window.__applyScene(s), scene)
await p.waitForTimeout(2800)
await p.evaluate(() => window.__town3dFly(true)); await p.waitForTimeout(600)
await p.evaluate(() => window.__town3dCruise(false))
// [name, x, z, 追加で見回す角度(0=openYawのまま)]
const spots = [
  ['residential', -40, -58, 0],
  ['residential-facade', -40, -58, 1],   // 同じ場所で建物正面を見る
  ['central-street', 2, -40, 0],
  ['shopping', 1, -12, 0],
  ['bath', -20, -34, 0],
  ['riverside', -49, -34, 0],
  ['park', 16, -27, 0],
  ['station', 33, -40, 0],
]
for (const [name, x, z, lookN] of spots) {
  await p.evaluate(() => window.__town3dFly(true)); await p.waitForTimeout(150)
  await p.evaluate(([x,z]) => window.__town3dFlyPose(x, 24, z, 0.2, -0.1), [x,z]); await p.waitForTimeout(500)
  await p.evaluate(() => window.__town3dLand(true)); await p.waitForTimeout(1700)
  for (let i = 0; i < lookN; i++) { await p.evaluate(() => window.__town3dLook(0.4, 0)) }
  await p.waitForTimeout(500)
  await p.screenshot({ path: `scripts/_shots/eye-${name}.png` })
}
console.log(errs.length ? 'ERR ' + errs.slice(0, 4).join(' | ') : 'no errors')
await b.close()
