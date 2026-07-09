import { chromium } from 'playwright'
const PORT = process.env.PORT || 4809
const browser = await chromium.launch()
// 実機相当の縦横（スマホは縦が多いが横でも遊ぶ）→ まず既定の縦長
const page = await browser.newPage({ viewport: { width: 430, height: 880 }, deviceScaleFactor: 2 })
const errs=[]; page.on('pageerror',e=>errs.push('PE:'+e.message))
await page.goto(`http://localhost:${PORT}/seasons-gpu/?dev=1`, { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(3000)
// 既定シーン（最初に見える窓辺）をそのまま撮る＝第一印象
await page.screenshot({ path: 'scripts/_shots/default_first.png' })
console.log('default scene captured', errs.length?'ERR '+errs[0]:'ok')
await browser.close()
