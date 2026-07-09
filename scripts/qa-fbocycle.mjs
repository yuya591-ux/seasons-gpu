import { chromium } from 'playwright'
const PORT = process.env.PORT || 4931
const OUT = 'C:\\Users\\yuya.satake\\ClaudeCode\\seasons\\.qa-shots'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 700, height: 500 }, deviceScaleFactor: 2 })
const errs = []; page.on('pageerror', e => errs.push(e.message))
await page.goto(`http://localhost:${PORT}/seasons-gpu/?dev=1`, { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.locator('.gate').click().catch(() => {}); await page.waitForTimeout(1200)
// シェーダー→立体の街→シェーダー の往復で FBO 解放→自動再作成が黒画面にならないか
await page.evaluate(() => window.__applyScene('summer-rain-dusk')).catch(() => {}); await page.waitForTimeout(2500)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d-spring')).catch(() => {}); await page.waitForTimeout(2800)
await page.evaluate(() => window.__applyScene('summer-rain-dusk')).catch(() => {}); await page.waitForTimeout(2800)
await page.screenshot({ path: `${OUT}\\fbocycle-back.png` }); console.log('fbocycle-back')
console.log(errs.length ? 'ERR ' + errs.slice(0, 3).join(' | ') : 'no err')
await browser.close()
