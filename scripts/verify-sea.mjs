import { chromium } from 'playwright'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 820 } })
const errors = []
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message))
await page.goto('http://localhost:4790/seasons/', { waitUntil: 'networkidle' })
await page.evaluate(() => document.fonts.ready)
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(500)
await page.locator('button:has-text("情景")').click()
await page.waitForTimeout(300)
await page.locator('.scene-card:has-text("海辺の窓")').click()
await page.waitForTimeout(2200)
await page.screenshot({ path: 'scripts/_shots/sea_front.png' })
// 少し下を向く（手前の波）
const box = await page.locator('#scene').boundingBox()
async function drag(dx, dy) {
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5)
  await page.mouse.down()
  for (let i = 1; i <= 12; i++) { await page.mouse.move(box.x + box.width * 0.5 + dx * i / 12, box.y + box.height * 0.5 + dy * i / 12); await page.waitForTimeout(20) }
  await page.mouse.up()
}
await drag(0, box.height * 0.28)
await page.waitForTimeout(900)
await page.screenshot({ path: 'scripts/_shots/sea_down.png' })
await browser.close()
console.log(errors.length ? 'ERR:\n' + errors.join('\n') : 'コンソールエラー無し ✓')
if (errors.length) process.exit(1)
