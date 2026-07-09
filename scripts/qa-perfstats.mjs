import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 960, height: 600 }, deviceScaleFactor: 1.6 })
await p.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(() => {})
await p.waitForTimeout(800)
await p.evaluate(() => window.__applyScene('kitaterao-window-3d-sunset'))
await p.waitForTimeout(2800)
const stat = async (label) => { await p.waitForTimeout(700); const s = await p.evaluate(() => window.__town3dStats()); console.log(label, JSON.stringify(s)) }
await stat('窓辺(初期)')
await p.evaluate(() => window.__town3dFly(true)); await p.waitForTimeout(600)
await p.evaluate(() => window.__town3dCruise(false))
await p.evaluate(() => window.__town3dFlyPose(0, 60, -40, 0.2, -0.2)); await stat('街を上空から')
await p.evaluate(() => window.__town3dFlyPose(640, 60, -46, 0.2, -0.2)); await stat('江戸エリア上空')
await p.evaluate(() => window.__town3dFlyPose(-640, 60, -30, 0.2, -0.2)); await stat('大正エリア上空')
await p.evaluate(() => window.__town3dFlyPose(0, 130, -50, -0.3, 0.4)); await stat('雲海(高空)')
await b.close()
