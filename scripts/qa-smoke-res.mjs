import { chromium } from 'playwright'
const PORT = process.env.PORT || 4876
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 480, height: 860 } })
const errs = []
page.on('pageerror', (e) => errs.push('PE:' + e.message))
page.on('console', (m) => { if (m.type() === 'error') errs.push('CE:' + m.text()) })
await page.goto(`http://localhost:${PORT}/seasons/?dev=1&fest=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
for (const id of ['kitaterao-window-3d', 'summer-dusk-downtown', 'autumn-dusk-corner-room', 'spring-morning-yato']) {
  await page.evaluate((s) => window.__applyScene && window.__applyScene(s), id).catch(() => {})
  await page.waitForTimeout(2600)
  console.log('loaded', id)
}
// home town3dで飛んで住民の近くを巡る（押し出し/回避が走る）
await page.evaluate(() => window.__applyScene('kitaterao-window-3d')); await page.waitForTimeout(2200)
await page.evaluate(() => window.__town3dFly(true)); await page.waitForTimeout(600)
await page.evaluate(() => window.__town3dCruise(true)); await page.waitForTimeout(8000) // 巡航で各所を通過
const clip = await page.evaluate(() => window.__town3dResClip())
console.log('巡航後 食い込み:', JSON.stringify({ resIn: clip.resIn, peepIn: clip.peepIn }))
console.log(errs.length ? 'エラー: ' + JSON.stringify(errs.slice(0, 8)) : 'コンソールエラー無し')
await browser.close()
