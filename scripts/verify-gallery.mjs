import { chromium } from 'playwright'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 900, height: 700 } })
const errors = []
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message))
await page.goto('http://localhost:4790/seasons-gpu/', { waitUntil: 'networkidle' })
await page.evaluate(() => document.fonts.ready)
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(1500)
await page.screenshot({ path: 'scripts/_shots/onboard.png' }) // 見回しヒントが出ているはず
await page.locator('button:has-text("情景")').click()
await page.waitForTimeout(800)
await page.screenshot({ path: 'scripts/_shots/gallery.png' })
await browser.close()
console.log(errors.length ? 'ERR:\n' + errors.join('\n') : 'コンソールエラー無し ✓')
if (errors.length) process.exit(1)
