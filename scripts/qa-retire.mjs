import { chromium } from 'playwright'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
const errs = []
page.on('pageerror', (e) => errs.push('PE:' + e.message))
page.on('console', (m) => { if (m.type() === 'error') errs.push('CE:' + m.text()) })
await page.goto('http://localhost:4875/seasons-gpu/?dev=1', { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(500)
// 角部屋(town3d)・下町とroof(ground.js共有)が描画されるか
for (const id of ['autumn-dusk-corner-room','summer-dusk-downtown','kitaterao-rooftop']) {
  await page.evaluate((s) => window.__applyScene && window.__applyScene(s), id)
  await page.waitForTimeout(2600)
}
// ギャラリーの「角部屋から」群を確認
await page.evaluate(() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent==='情景'); if(b) b.click() })
await page.waitForTimeout(500)
const groups = await page.evaluate(() => [...document.querySelectorAll('.gallery__group')].map(h => h.textContent))
const cornerCards = await page.evaluate(() => [...document.querySelectorAll('.scene-card')].filter(c => /角部屋/.test(c.textContent)).length)
console.log('見出し:', JSON.stringify(groups), '/ 角部屋カード数:', cornerCards)
console.log(errs.length ? 'エラー: ' + JSON.stringify(errs.slice(0,5)) : 'エラー無し')
await browser.close()
