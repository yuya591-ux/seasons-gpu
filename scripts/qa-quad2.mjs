import { chromium } from 'playwright'
import { writeFileSync } from 'fs'
const PORT = process.env.PORT || 4896
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 640, height: 560 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message))
await page.goto(`http://localhost:${PORT}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(2600)
await page.evaluate(() => window.__town3dFly(true)); await page.waitForTimeout(500)
const n = await page.evaluate(() => window.__town3dQuadCount())
console.log('quadCount', n)
const idx = [0, 5, 12]
for (let k = 0; k < idx.length; k++) {
  const i = idx[k], bx = 200 + k * 6, by = 96, bz = 200
  const info = await page.evaluate(({ i, bx, by, bz }) => {
    window.__town3dQuadPin(i, bx, bz, by, Math.PI * 0.62)
    const q = window.__town3dQuadDbg(i)
    const dat = window.__town3dShotAt(bx + 1.5, by + 0.7, bz + 1.4, bx, by + 0.45, bz, 40)
    return { q, dat }
  }, { i, bx, by, bz })
  console.log('idx', i, 'pos', JSON.stringify(info.q))
  writeFileSync(`scripts/_shots/quad2_${k}.png`, Buffer.from(info.dat.split(',')[1], 'base64'))
}
await browser.close()
