// 夜の雲海・浮島の見た目確認
import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 920, height: 560 }, deviceScaleFactor: 2 })
await p.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(() => {})
await p.waitForTimeout(700)
await p.evaluate(() => window.__applyScene('kitaterao-window-3d-night'))
await p.waitForTimeout(2600)
await p.evaluate(() => window.__town3dFly(true)); await p.waitForTimeout(700)
await p.evaluate(() => window.__town3dCruise(false))
await p.evaluate(() => window.__town3dFlyPose(-60, 118, -372, 0, -0.08)); await p.waitForTimeout(1200)
await p.screenshot({ path: 'scripts/_shots/sky-night-island.png' })
await p.evaluate(() => window.__town3dFlyPose(170, 116, -240, 0, 0.12)); await p.waitForTimeout(900)
await p.screenshot({ path: 'scripts/_shots/sky-night-towers.png' })
// 空の灯籠（夜＝雲海に灯がともる。灯籠群 x≈20,z≈-320 を外から望む）
await p.evaluate(() => window.__town3dFlyPose(20, 118, -190, 0, -0.05)); await p.waitForTimeout(1200)
await p.screenshot({ path: 'scripts/_shots/sky-night-lanterns.png' })
await b.close()
