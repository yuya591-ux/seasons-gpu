import { chromium } from 'playwright'
import fs from 'node:fs'
const PORT = process.env.PORT || 4920
const OUT = 'C:\\Users\\yuya.satake\\ClaudeCode\\seasons\\.qa-shots'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 500, height: 420 }, deviceScaleFactor: 1.5 })
const errs = []; page.on('pageerror', e => errs.push('PE:' + e.message)); page.on('console', m => { if (m.type() === 'error') errs.push('CE:' + m.text().slice(0, 100)) })
await page.goto(`http://localhost:${PORT}/seasons-gpu/?dev=1`, { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(1200)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d')).catch(() => {})
await page.waitForTimeout(2600)
await page.evaluate(() => window.__town3dFlyPose(0, 40, 40, Math.PI, -0.35)).catch(() => {})
await page.waitForTimeout(1500)
for (const [tag, p] of Object.entries({
  over: [10, 38, 46, 0, 6, -30, 62],
  low: [-10, 6, 6, -40, 4, -40, 66],
})) {
  const url = await page.evaluate(a => window.__town3dShotAt(...a), p)
  if (url && url.startsWith('data:image')) { fs.writeFileSync(`${OUT}\\homeover-${tag}.png`, Buffer.from(url.split(',')[1], 'base64')); console.log('saved', tag) }
}
console.log(errs.length ? 'ERR' + JSON.stringify(errs.slice(0, 3)) : 'no console err')
await browser.close()
