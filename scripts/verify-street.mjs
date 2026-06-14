import { chromium } from 'playwright'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 820 } })
await page.goto('http://localhost:4790/seasons/?dev=1', { waitUntil: 'networkidle' })
await page.evaluate(() => document.fonts.ready)
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(400)
await page.evaluate(() => window.__applyScene && window.__applyScene('autumn-dusk-corner-room'))
await page.waitForTimeout(1500)
const box = await page.locator('#scene').boundingBox()
// 強く下を向く（通りを画面いっぱいに）
await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.4)
await page.mouse.down()
for (let i = 1; i <= 16; i++) { await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.4 + (box.height * 0.5) * i / 16); await page.waitForTimeout(18) }
await page.mouse.up()
await page.waitForTimeout(1500)
await page.screenshot({ path: 'scripts/_shots/street.png' })
await browser.close()
console.log('done')
