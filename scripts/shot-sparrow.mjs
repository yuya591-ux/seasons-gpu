// 電線のスズメを確認する。乗り出して手前の電線（上段）を見る角度で撮影。console.error も捕捉。
import { chromium } from 'playwright'
const port = process.env.PORT || '4855'
const id = process.env.SCENE || 'kitaterao-window-3d'
const errors = []
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()) })
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
await page.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate((sid) => window.__applyScene && window.__applyScene(sid), id)
await page.waitForTimeout(2200)
await page.addStyleTag({ content: '.ui{display:none !important}' })
await page.evaluate(() => window.__town3dLean && window.__town3dLean(true))
await page.waitForTimeout(2000)
for (const [yaw, pitch, name] of [[-0.15, 0.32, 'wires-up'], [-0.1, 0.06, 'wires-mid']]) {
  await page.evaluate(([y, p]) => window.__town3dSetView && window.__town3dSetView(y, p), [yaw, pitch])
  await page.waitForTimeout(900)
  await page.screenshot({ path: `scripts/_shots/sparrow-${id}-${name}.png` })
}
console.log('errors =', errors.length)
for (const e of errors) console.log('  ', e)
await browser.close()
