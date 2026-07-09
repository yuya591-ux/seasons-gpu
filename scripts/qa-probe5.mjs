import { chromium } from 'playwright'
const PORT = process.env.PORT || 4876
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 } })
await page.goto(`http://localhost:${PORT}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(800)
await page.evaluate(() => window.__applyScene && window.__applyScene('summer-dusk-downtown')).catch(() => {})
await page.waitForTimeout(2600)
const pts = [[-3.1,-75.1],[2.6,-19.1],[-2.8,-14.7],[-2.6,-25.1],[34,-35.5]]
for (const [x,z] of pts) {
  const r = await page.evaluate(([x,z]) => window.__town3dProbe(x,z), [x,z])
  console.log(`(${x},${z})`, JSON.stringify(r))
}
await browser.close()
