// オフライン対応(Service Worker)の実証: 一度開いてキャッシュ→オフライン化→再読込で起動するか。
import { chromium } from 'playwright'
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 400, height: 850 }, serviceWorkers: 'allow' })
const page = await ctx.newPage()
const errs = []
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()) })
// 1) オンラインで開く（SW登録）
await page.goto('http://localhost:4790/seasons/', { waitUntil: 'networkidle' })
await page.evaluate(() => navigator.serviceWorker && navigator.serviceWorker.ready)
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(1500)
// 2) SWに制御させ、シェル＋資産をキャッシュさせるため一度リロード
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(1500)
const controlled = await page.evaluate(() => !!(navigator.serviceWorker && navigator.serviceWorker.controller))
// 3) オフラインにして再読込
await ctx.setOffline(true)
let booted = false, hadError = false
try {
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 })
  await page.waitForTimeout(1200)
  booted = await page.evaluate(() => {
    const c = document.getElementById('scene')
    const fb = document.getElementById('fallback')
    return !!c && !c.hidden && !(fb && !fb.hidden)
  })
} catch (e) { hadError = true }
console.log(`SW制御: ${controlled} | オフライン再起動: ${booted ? 'OK(起動した)' : 'NG'} | 例外: ${hadError} | console error数: ${errs.length}`)
await browser.close()
