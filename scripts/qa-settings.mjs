import { chromium } from 'playwright'
const PORT = process.env.PORT || 4931
const OUT = 'C:\\Users\\yuya.satake\\ClaudeCode\\seasons\\.qa-shots'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 500, height: 760 }, deviceScaleFactor: 2 })
const errs = []; page.on('pageerror', e => errs.push(e.message))
await page.goto(`http://localhost:${PORT}/seasons-gpu/?dev=1`, { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.locator('.gate').click().catch(() => {}); await page.waitForTimeout(1800)
// 設定ボタンを押す
const btn = page.locator('button', { hasText: '設定' }).first()
await btn.click().catch(() => {}); await page.waitForTimeout(600)
await page.screenshot({ path: `${OUT}\\settings-panel.png` }); console.log('settings-panel')
console.log(errs.length ? 'ERR ' + errs.slice(0, 2).join(' | ') : 'no err')
await browser.close()
