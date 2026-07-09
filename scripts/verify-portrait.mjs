// iPhone相当のポートレートで、正面と見下ろしを撮る。
import { chromium } from 'playwright'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 400, height: 850 } })
await page.goto('http://localhost:4790/seasons-gpu/?dev=1', { waitUntil: 'networkidle' })
await page.evaluate(() => document.fonts.ready)
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(400)
await page.evaluate(() => window.__applyScene && window.__applyScene('autumn-dusk-corner-room'))
await page.waitForTimeout(1800)
await page.screenshot({ path: 'scripts/_shots/pt_front.png' })
const box = await page.locator('#scene').boundingBox()
async function drag(dx, dy, steps = 16) {
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.45)
  await page.mouse.down()
  for (let i = 1; i <= steps; i++) { await page.mouse.move(box.x + box.width * 0.5 + dx * i / steps, box.y + box.height * 0.45 + dy * i / steps); await page.waitForTimeout(16) }
  await page.mouse.up()
}
await drag(0, box.height * 0.42)
await page.waitForTimeout(1500)
await page.screenshot({ path: 'scripts/_shots/pt_down.png' })
await browser.close()
console.log('done')
