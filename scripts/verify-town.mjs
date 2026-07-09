import { chromium } from 'playwright'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 820 } })
const errors = []
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message))
await page.goto('http://localhost:4790/seasons-gpu/', { waitUntil: 'networkidle' })
await page.evaluate(() => document.fonts.ready)
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(500)
await page.locator('button:has-text("情景")').click()
await page.waitForTimeout(400)
await page.locator('.scene-card:has-text("夏の夕暮れ、高台の下町")').click()
await page.waitForTimeout(2000)
await page.screenshot({ path: 'scripts/_shots/town_front.png' })
const box = await page.locator('#scene').boundingBox()
async function drag(dx, dy) {
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5)
  await page.mouse.down()
  for (let i = 1; i <= 12; i++) { await page.mouse.move(box.x + box.width * 0.5 + dx * i / 12, box.y + box.height * 0.5 + dy * i / 12); await page.waitForTimeout(20) }
  await page.mouse.up()
}
await drag(0, box.height * 0.4) // 下を向く
await page.waitForTimeout(900)
await page.screenshot({ path: 'scripts/_shots/town_down.png' })
await browser.close()
console.log(errors.length ? 'ERR:\n' + errors.join('\n') : 'コンソールエラー無し ✓')
if (errors.length) process.exit(1)
