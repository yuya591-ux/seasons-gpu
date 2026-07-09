import { chromium } from 'playwright'
const PORT = process.env.PORT || 4877
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 480, height: 640 } })
page.on('console', (m) => { if (/fest|season|FORCE/i.test(m.text())) console.log('PAGE:', m.text()) })
await page.goto(`http://localhost:${PORT}/seasons-gpu/?dev=1&fest=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
for (const id of ['summer-dusk-downtown','summer-night-downtown','kitaterao-window-3d']) {
  await page.evaluate((s) => window.__applyScene(s), id).catch(()=>{})
  await page.waitForTimeout(2600)
  const pal = await page.evaluate(() => window.__town3dPalProbe && window.__town3dPalProbe())
  const fc = await page.evaluate(() => window.__town3dFolkCount && window.__town3dFolkCount())
  console.log(id, 'pal=', JSON.stringify(pal), 'folk=', fc)
}
await browser.close()
