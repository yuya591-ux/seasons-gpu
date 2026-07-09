import { chromium } from 'playwright'
import { writeFileSync } from 'fs'
const PORT = process.env.PORT || 4931
const OUT = 'C:\\Users\\yuya.satake\\ClaudeCode\\seasons\\.qa-shots'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 800, height: 500 }, deviceScaleFactor: 2 })
const errs = []; page.on('pageerror', e => errs.push(e.message))
await page.goto(`http://localhost:${PORT}/seasons-gpu/?dev=1`, { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.locator('.gate').click().catch(() => {}); await page.waitForTimeout(1200)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d-spring')).catch(() => {}); await page.waitForTimeout(3200)
const save = (tag, url) => { if (!url) { console.log('NO ' + tag); return } writeFileSync(`${OUT}\\${tag}.png`, Buffer.from(url.split(',')[1], 'base64')); console.log(tag) }
for (const f of [0, 1]) {
  await page.evaluate((x) => window.__town3dDrift && window.__town3dDrift(x), f).catch(() => {}); await page.waitForTimeout(700)
  const url = await page.evaluate(() => window.__town3dShotAt(180, -6.5, -90, 520, -9.3, -200, 60)).catch(() => null)
  save(`watergold-${Math.round(f * 100)}`, url)
}
console.log(errs.length ? 'ERR ' + errs.slice(0, 2).join(' | ') : 'no err')
await browser.close()
