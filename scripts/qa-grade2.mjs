import { chromium } from 'playwright'
const PORT = process.env.PORT || 4931
const OUT = 'C:\\Users\\yuya.satake\\ClaudeCode\\seasons\\.qa-shots'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 880, height: 560 }, deviceScaleFactor: 2 })
const errs = []; page.on('pageerror', e => errs.push(e.message))
await page.goto(`http://localhost:${PORT}/seasons-gpu/?dev=1`, { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.locator('.gate').click().catch(() => {}); await page.waitForTimeout(1200)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d-spring')).catch(() => {}); await page.waitForTimeout(3200)
await page.screenshot({ path: `${OUT}\\grade2-window.png` }); console.log('grade2-window')
// 空が広く見える低空へ（グレード込みのページ撮影）
await page.evaluate(() => window.__town3dFly && window.__town3dFly(true)).catch(() => {}); await page.waitForTimeout(500)
await page.evaluate(() => window.__town3dFlyPose && window.__town3dFlyPose(0, 30, 60, Math.PI, 0.15)).catch(() => {}); await page.waitForTimeout(900)
await page.screenshot({ path: `${OUT}\\grade2-sky.png` }); console.log('grade2-sky')
console.log(errs.length ? 'ERR ' + errs.slice(0, 2).join(' | ') : 'no err')
await browser.close()
