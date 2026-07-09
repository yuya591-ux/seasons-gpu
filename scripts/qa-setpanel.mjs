import { chromium } from 'playwright'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
const errs = []
page.on('pageerror', (e) => errs.push('PE:' + e.message))
page.on('console', (m) => { if (m.type() === 'error') errs.push('CE:' + m.text()) })
await page.goto('http://localhost:4875/seasons-gpu/?dev=1', { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(500)
// 設定ボタンを押してパネルを開く
await page.locator('button.iconbtn', { hasText: '設定' }).click().catch(async () => {
  await page.evaluate(() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent==='設定'); if(b) b.click() })
})
await page.waitForTimeout(700)
const hasStay = await page.evaluate(() => [...document.querySelectorAll('button')].some(b => b.textContent.includes('時間をとどめる')))
await page.screenshot({ path: 'scripts/_shots/qa-setpanel.png' })
console.log('時間をとどめるチップ存在:', hasStay, '/', errs.length ? 'エラー:' + JSON.stringify(errs.slice(0,4)) : 'エラー無し')
await browser.close()
