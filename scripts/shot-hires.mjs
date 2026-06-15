// 実機に近い高解像度(DPR2)で撮影して品質を判断する。引数: 情景ID
import { chromium } from 'playwright'
const id = process.argv[2] || 'autumn-dusk-corner-room'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
await page.goto('http://localhost:4790/seasons/?dev=1', { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate((sid) => window.__applyScene && window.__applyScene(sid), id)
await page.waitForTimeout(2200)
await page.addStyleTag({ content: '.ui{display:none !important}' })
await page.waitForTimeout(200)
await page.screenshot({ path: `scripts/_shots/hires.png` })
await browser.close()
console.log('hires:', id)
