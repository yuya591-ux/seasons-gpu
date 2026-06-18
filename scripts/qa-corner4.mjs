import { chromium } from 'playwright'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
const errs = []
page.on('pageerror', (e) => errs.push('PE:' + e.message))
page.on('console', (m) => { if (m.type() === 'error') errs.push('CE:' + m.text()) })
await page.goto('http://localhost:4875/seasons/?dev=1', { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(500)
await page.addStyleTag({ content: '.ui{display:none !important}' })
for (const [id,f] of [['spring-dusk-corner-room','qa-c4-springdusk'],['summer-morning-corner-room','qa-c4-summermorn'],['winter-snow-dusk-corner-room','qa-c4-wintersnow']]) {
  await page.evaluate((s) => window.__applyScene && window.__applyScene(s), id)
  await page.waitForTimeout(3200)
  const stage = await page.evaluate(() => !!document.querySelector('.town3d-stage'))
  await page.screenshot({ path: `scripts/_shots/${f}.png` })
  console.log(id, 'town3d:', stage)
}
console.log(errs.length ? 'エラー: ' + JSON.stringify(errs.slice(0,5)) : 'エラー無し')
await browser.close()
