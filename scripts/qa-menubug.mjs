import { chromium } from 'playwright'
const PORT = process.env.PORT || 4896
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 760, height: 600 }, deviceScaleFactor: 1 })
const errs = []
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message))
page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()) })
await page.goto(`http://localhost:${PORT}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(800)
// 情景パネルを開いてカード数を記録（初期）
const openGallery = async () => { await page.evaluate(() => { const b = Array.from(document.querySelectorAll('.iconbtn')).find(x => x.textContent === '情景'); if (b) b.click() }); await page.waitForTimeout(500) }
const galleryState = async () => page.evaluate(() => {
  const cards = Array.from(document.querySelectorAll('.scene-card'))
  const visible = cards.filter(c => c.offsetParent !== null)
  const groups = Array.from(document.querySelectorAll('.gallery__group')).map(g => g.textContent + '(' + (g.offsetParent!==null?'見える':'隠れ') + ')')
  return { total: cards.length, visible: visible.length, groups, labels: visible.slice(0,6).map(c => (c.querySelector('.scene-card__label')||{}).textContent) }
})
await openGallery()
console.log('INITIAL', JSON.stringify(await galleryState()))
// 北寺尾雨・立体の街を選んで遊ぶ
await page.evaluate(() => window.__applyScene('kitaterao-window-3d-rain'))
await page.waitForTimeout(3500)
await page.evaluate(() => { window.__town3dFly && window.__town3dFly(true) }); await page.waitForTimeout(2500)
await page.evaluate(() => { window.__town3dFly && window.__town3dFly(false) }); await page.waitForTimeout(1500)
// 情景を開き直す（ここで壊れるか）
await openGallery()
console.log('AFTER RAIN', JSON.stringify(await galleryState()))
console.log('ERRORS', errs.length, errs.slice(0,8).join(' || '))
await browser.close()
