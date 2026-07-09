import { chromium } from 'playwright'
import { writeFileSync } from 'fs'
const PORT = process.env.PORT || 4931
const OUT = 'C:\\Users\\yuya.satake\\ClaudeCode\\seasons\\.qa-shots'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 720, height: 600 }, deviceScaleFactor: 2 })
const errs = []; page.on('pageerror', e => errs.push(e.message))
await page.goto(`http://localhost:${PORT}/seasons-gpu/?dev=1`, { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.locator('.gate').click().catch(() => {}); await page.waitForTimeout(1200)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d-spring')).catch(() => {}); await page.waitForTimeout(3200)
const save = (tag, url) => { if (!url) { console.log('NO ' + tag); return } writeFileSync(`${OUT}\\${tag}.png`, Buffer.from(url.split(',')[1], 'base64')); console.log(tag) }
// 商店街の人だまり(0,-28)・駅前(STATION付近)を接写
for (const [tag, lx, lz, d] of [['peep2-shoten', 0, -28, 8], ['peep2-station', 0, -64, 9]]) {
  const gy = await page.evaluate(([x, z]) => window.__town3dGroundAt(x, z), [lx, lz]).catch(() => 0)
  const url = await page.evaluate(([lx, lz, gy, d]) => window.__town3dShotAt(lx, gy + 1.5, lz + d, lx, gy + 0.85, lz, 42), [lx, lz, gy, d]).catch(() => null)
  save(tag, url)
}
console.log(errs.length ? 'ERR ' + errs.slice(0, 2).join(' | ') : 'no err')
await browser.close()
