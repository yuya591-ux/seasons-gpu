import { chromium } from 'playwright'
const PORT = process.env.PORT || 4804
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 880, height: 470 } })
const errs=[]; page.on('pageerror',e=>errs.push('PE:'+e.message))
await page.goto(`http://localhost:${PORT}/seasons/?dev=1`, { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(1500)
await page.evaluate(() => window.__applyScene('autumn-dusk-corner-room')).catch(()=>{})
await page.waitForTimeout(3200)
await page.screenshot({ path: 'scripts/_shots/corner_window.png' })
console.log('corner', errs.length?'ERR '+errs[0]:'ok')
await browser.close()
