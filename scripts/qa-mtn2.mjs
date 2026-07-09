// windowMountains 底上げの確認。既定視点でCSSグレード込みで撮る。
import { chromium } from 'playwright'
const port = process.env.PORT || '5121'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 420, height: 560 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message))
await page.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(600)
await page.addStyleTag({ content: '.ui{display:none !important}' })
await page.evaluate(() => window.__applyScene('summer-morning-mountains'))
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene('summer-morning-mountains'))
await page.waitForTimeout(1800)
await page.mouse.move(210, 280); await page.mouse.move(212, 282)
await page.waitForTimeout(300)
await page.screenshot({ path: 'scripts/_shots/mtn-after.png' })
console.log('mtn after done')
await browser.close()
