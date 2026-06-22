// 鯨の潮吹き＋子鯨の検証: 鯨を横から連続撮影し、潮吹き・寄り添う子鯨を捉える
import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 920, height: 560 }, deviceScaleFactor: 2 })
const errs = []
p.on('pageerror', (e) => errs.push(String(e)))
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()) })
await p.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(() => {})
await p.waitForTimeout(700)
await p.evaluate(() => window.__applyScene('kitaterao-window-3d'))
await p.waitForTimeout(2400)
await p.evaluate(() => window.__town3dFly(true)); await p.waitForTimeout(600)
await p.evaluate(() => window.__town3dCruise(false))
// 鯨は x=-220 から +2.2/s で進む。横手前(z=-150)からやや見下ろし、通過を6枚連写して潮吹きを捉える
for (let i = 0; i < 6; i++) {
  const wx = -210 + i * 5 // おおよその鯨の位置に合わせてカメラも追う
  await p.evaluate((x) => window.__town3dFlyPose(x + 40, 122, -150, -1.4, -0.05), wx)
  await p.waitForTimeout(2200)
  await p.screenshot({ path: `scripts/_shots/whale-${i}.png` })
}
console.log(errs.length ? 'ERR ' + errs.slice(0, 4).join(' | ') : 'no errors')
await b.close()
