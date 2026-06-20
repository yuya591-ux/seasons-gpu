import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message))
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE ERROR:', m.text()) })
await page.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
const hasFn = await page.evaluate(() => typeof window.__applyScene)
console.log('__applyScene type:', hasFn)
try { await page.evaluate(() => window.__applyScene('kitaterao-window-3d')) } catch (e) { console.log('applyScene threw:', e.message.split('\n')[0]) }
await page.waitForTimeout(2600)
console.log('done')
await browser.close()
