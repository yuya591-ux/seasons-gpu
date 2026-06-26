import { chromium } from 'playwright'
import { writeFileSync } from 'fs'
const PORT = process.env.PORT || 4931
const OUT = 'C:\\Users\\yuya.satake\\ClaudeCode\\seasons\\.qa-shots'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 720, height: 600 }, deviceScaleFactor: 2 })
const errs = []; page.on('pageerror', e => errs.push(e.message))
await page.goto(`http://localhost:${PORT}/seasons/?dev=1`, { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.locator('.gate').click().catch(() => {}); await page.waitForTimeout(1200)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d-spring')).catch(() => {}); await page.waitForTimeout(3400)
const has = await page.evaluate(() => typeof window.__town3dShotAt).catch(() => 'x')
console.log('shotAt = ' + has)
const save = (tag, url) => { if (!url) { console.log('NO ' + tag); return } writeFileSync(`${OUT}\\${tag}.png`, Buffer.from(url.split(',')[1], 'base64')); console.log(tag) }
const lx = 614.5, lz = -28.4
const gy = await page.evaluate(([x, z]) => window.__town3dGroundAt(x, z), [lx, lz]).catch(() => 0)
// 市場を見下ろす数アングル（建物を越えて群衆の床を覗く）
for (const [tag, dy, dz, fov] of [['mkt2-edo-a', 8, 13, 46], ['mkt2-edo-b', 13, 9, 52], ['mkt2-edo-c', 6, 17, 40]]) {
  const url = await page.evaluate(([lx, lz, gy, dy, dz, fov]) => window.__town3dShotAt(lx, gy + dy, lz + dz, lx, gy + 0.7, lz, fov), [lx, lz, gy, dy, dz, fov]).catch(() => null)
  save(tag, url)
}
console.log(errs.length ? 'ERR ' + errs.slice(0, 3).join(' | ') : 'no err')
await browser.close()
