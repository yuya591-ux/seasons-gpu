import { chromium } from 'playwright'
const PORT = process.env.PORT || 4922
const OUT = 'C:\\Users\\yuya.satake\\ClaudeCode\\seasons\\.qa-shots'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
const errs = []; page.on('pageerror', e => errs.push(e.message))
await page.goto(`http://localhost:${PORT}/seasons/?dev=1`, { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.locator('.gate').click().catch(() => {}); await page.waitForTimeout(1200)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d')).catch(() => {}); await page.waitForTimeout(2600)
await page.evaluate(() => window.__town3dFly && window.__town3dFly(true)).catch(() => {}); await page.waitForTimeout(500)
const spots = [['openroad', 0, 12, Math.PI], ['park', 17, -22, 0.7], ['hill', -16, 16, 2.0]]
for (const [tag, x, z, yaw] of spots) {
  await page.evaluate(([x, z, y]) => window.__town3dFlyPose(x, 18, z, y, -0.1), [x, z, yaw]).catch(() => {}); await page.waitForTimeout(700)
  await page.evaluate(() => window.__town3dLand && window.__town3dLand(true)).catch(() => {}); await page.waitForTimeout(2200)
  await page.screenshot({ path: `${OUT}\\grnd-${tag}.png` }); console.log('grnd-' + tag)
  await page.evaluate(() => window.__town3dFly && window.__town3dFly(true)).catch(() => {}); await page.waitForTimeout(500)
}
console.log(errs.length ? 'ERR ' + errs.slice(0, 2).join(' | ') : 'no err')
await browser.close()
