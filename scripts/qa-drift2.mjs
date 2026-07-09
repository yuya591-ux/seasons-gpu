import { chromium } from 'playwright'
const PORT = process.env.PORT || 4931
const OUT = 'C:\\Users\\yuya.satake\\ClaudeCode\\seasons\\.qa-shots'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 880, height: 560 }, deviceScaleFactor: 2 })
const errs = []; page.on('pageerror', e => errs.push(e.message))
await page.goto(`http://localhost:${PORT}/seasons-gpu/?dev=1`, { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.locator('.gate').click().catch(() => {}); await page.waitForTimeout(1200)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d')).catch(() => {}); await page.waitForTimeout(3000)
for (const f of [0, 0.5, 1]) {
  await page.evaluate((x) => window.__town3dDrift && window.__town3dDrift(x), f).catch(() => {}); await page.waitForTimeout(800)
  await page.screenshot({ path: `${OUT}\\drift2-${Math.round(f * 100)}.png` }); console.log('drift2-' + Math.round(f * 100))
}
console.log(errs.length ? 'ERR ' + errs.slice(0, 2).join(' | ') : 'no err')
await browser.close()
