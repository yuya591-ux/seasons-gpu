import { chromium } from 'playwright'
import fs from 'node:fs'
// 背後の丘を正面から本物の見え方(page.screenshot=グレード込み)で。森が丘を埋めたか。
const PORT = process.env.PORT || 4920
const OUT = 'C:\\Users\\yuya.satake\\ClaudeCode\\seasons\\.qa-shots'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 560, height: 420 }, deviceScaleFactor: 1.6 })
const errs = []; page.on('pageerror', e => errs.push('PE:' + e.message)); page.on('console', m => { if (m.type() === 'error') errs.push('CE:' + m.text().slice(0, 100)) })
await page.goto(`http://localhost:${PORT}/seasons-gpu/?dev=1`, { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(1200)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d')).catch(() => {})
await page.waitForTimeout(2600)
for (const [tag, pose] of Object.entries({
  north: [-10, 26, 10, Math.PI, -0.04],   // 街の上から北の丘を望む
  west: [-90, 24, -40, -Math.PI / 2, -0.04], // 西の丘を望む
})) {
  await page.evaluate(p => window.__town3dFlyPose(...p), pose).catch(() => {})
  await page.waitForTimeout(2200)
  await page.screenshot({ path: `${OUT}\\hills-${tag}.png` }); console.log('saved hills-' + tag)
}
console.log(errs.length ? 'ERR' + JSON.stringify(errs.slice(0, 3)) : 'no console err')
await browser.close()
