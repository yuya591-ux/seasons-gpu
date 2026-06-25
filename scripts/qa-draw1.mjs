import { chromium } from 'playwright'
const PORT = process.env.PORT || 4876
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 } })
await page.goto(`http://localhost:${PORT}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(800)
await page.evaluate(() => window.__applyScene && window.__applyScene('summer-dusk-downtown')).catch(() => {})
await page.waitForTimeout(3000)
const d = await page.evaluate(() => window.__town3dDraw())
console.log('窓辺 描画:', JSON.stringify(d))
await browser.close()
