import { chromium } from 'playwright'
const browser = await chromium.launch()
async function shot(page, id, file) {
  await page.evaluate((s) => window.__applyScene && window.__applyScene(s), id)
  await page.waitForTimeout(3000)
  await page.screenshot({ path: `scripts/_shots/${file}.png` })
}
// 縦と横の両方（横長は粒が散ると指摘されたため）
for (const [w,h,suf] of [[440,900,'v'],[900,440,'h']]) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 })
  await page.goto('http://localhost:4875/seasons/?dev=1', { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
  await page.locator('.gate').click().catch(() => {})
  await page.waitForTimeout(600)
  await page.addStyleTag({ content: '.ui{display:none !important}' })
  await shot(page, 'summer-rain-dusk', `qa-rain-summer-${suf}`)
  await shot(page, 'autumn-rain-dusk', `qa-rain-autumn-${suf}`)
  await page.close()
}
console.log('done')
await browser.close()
