// 404の正体を突き止める + 起動時間の計測
import { chromium } from 'playwright'
const URL = process.env.EVAL_URL || 'https://yuya591-ux.github.io/seasons/?dev=1'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
const failed = []
const req404 = []
page.on('requestfailed', (r) => failed.push(r.url() + ' :: ' + (r.failure()?.errorText || '')))
page.on('response', (r) => { if (r.status() >= 400) req404.push(r.status() + ' ' + r.url()) })
await page.goto(URL, { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)
console.log('FAILED REQ:', JSON.stringify(failed, null, 2))
console.log('4xx/5xx RESPONSES:', JSON.stringify(req404, null, 2))
await browser.close()
