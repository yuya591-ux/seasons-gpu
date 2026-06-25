import { chromium } from 'playwright'
import fs from 'node:fs'
const PORT = process.env.PORT || 4920
const OUT = 'C:\\Users\\yuya.satake\\ClaudeCode\\seasons\\.qa-shots'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 520, height: 460 }, deviceScaleFactor: 1.6 })
const errs = []; page.on('pageerror', e => errs.push('PE:' + e.message)); page.on('console', m => { if (m.type() === 'error') errs.push('CE:' + m.text().slice(0, 100)) })
await page.goto(`http://localhost:${PORT}/seasons/?dev=1`, { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(1200)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d-night')).catch(() => {})
await page.waitForTimeout(2800)
for (const [tag, pose] of Object.entries({
  flyhigh: [0, 40, 70, Math.PI, -0.22],
  flylow: [-10, 14, -6, Math.PI, -0.05],
})) {
  await page.evaluate(p => window.__town3dFlyPose(...p), pose).catch(() => {})
  await page.waitForTimeout(2200)
  await page.screenshot({ path: `${OUT}\\night-${tag}.png` }); console.log('saved night-' + tag)
}
console.log(errs.length ? 'ERR' + JSON.stringify(errs.slice(0, 3)) : 'no console err')
await browser.close()
