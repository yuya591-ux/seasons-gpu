import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
await p.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(() => {})
await p.waitForTimeout(700)
await p.evaluate(() => window.__applyScene('kitaterao-window-3d'))
await p.waitForTimeout(2400)
await p.evaluate(() => { window.__town3dFly(true) })
await p.evaluate(() => window.__town3dFlyPose(-590, 56, -30, -Math.PI / 2, -0.18)) // 大正(x-640)
await p.waitForTimeout(900)
console.log('taisho stats:', JSON.stringify(await p.evaluate(() => window.__town3dStats && window.__town3dStats())))
await b.close()
