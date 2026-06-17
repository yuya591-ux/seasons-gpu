import { chromium } from 'playwright'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
const errs = []
page.on('pageerror', (e) => errs.push(e.message))
page.on('console', (m) => { if (m.type() === 'error') errs.push('CE:' + m.text()) })
await page.goto('http://localhost:4875/seasons/?dev=1', { waitUntil: 'networkidle' })
// 通い帳に記録を仕込んで再読込
await page.evaluate(() => {
  localStorage.setItem('seasons.state.v1', JSON.stringify({
    sceneId: null, settings: {},
    journal: { visits: { 'summer-dusk-seaside': 3, 'autumn-rain-dusk': 1, 'kitaterao-window-3d': 2, 'summer-morning-mountains': 1 }, seconds: 5400, events: { rainbow: 2, star: 1 }, firstAt: Date.now() - 5*86400000 }
  }))
})
await page.reload({ waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(600)
await page.evaluate(() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent==='設定'); if(b) b.click() })
await page.waitForTimeout(400)
await page.evaluate(() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent==='通い帳をひらく'); if(b) b.click() })
await page.waitForTimeout(700)
await page.screenshot({ path: 'scripts/_shots/qa-journal.png' })
const info = await page.evaluate(() => ({
  lead: document.querySelector('.journal__lead')?.textContent,
  cells: document.querySelectorAll('.journal__cell').length,
  events: document.querySelector('.journal__events')?.textContent,
}))
console.log(JSON.stringify(info))
console.log(errs.length ? 'エラー: ' + JSON.stringify(errs.slice(0,4)) : 'エラー無し')
await browser.close()
