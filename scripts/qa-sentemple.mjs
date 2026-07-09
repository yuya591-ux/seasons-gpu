// 戦国の山寺（西の尾根）を確認＋全景＋南端から現代が見えないか(共視界)を点検。
import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
p.on('pageerror', (e) => console.log('PAGE ERROR', e.message))
await p.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(() => {})
await p.waitForTimeout(700)
await p.evaluate(() => window.__applyScene('kitaterao-window-3d'))
await p.waitForTimeout(2400)
await p.evaluate(() => { window.__town3dFly(true) }); await p.waitForTimeout(700)
await p.evaluate(() => { window.__town3dCruise(false) })
// 山寺(西の尾根 x≈79,z≈-494)を東から望む
await p.evaluate(() => window.__town3dFlyPose(110, 30, -494, Math.PI, -0.12)); await p.waitForTimeout(800)
await p.screenshot({ path: 'scripts/_shots/sen-temple.png' })
// 谷の全景（南から）
await p.evaluate(() => window.__town3dFlyPose(120, 44, -400, 0, -0.12)); await p.waitForTimeout(800)
await p.screenshot({ path: 'scripts/_shots/sen-expand-mid.png' })
// 共視界点検: 戦国の南端で南(現代の方向)を向く＝現代が霧の中に見えてはいけない
await p.evaluate(() => window.__town3dFlyPose(120, 50, -396, Math.PI / 2, -0.05)); await p.waitForTimeout(800)
await p.screenshot({ path: 'scripts/_shots/sen-covis.png' })
await b.close()
