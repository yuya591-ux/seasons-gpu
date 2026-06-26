import { chromium } from 'playwright'
import { writeFileSync } from 'fs'
const PORT = process.env.PORT || 4931
const OUT = 'C:\\Users\\yuya.satake\\ClaudeCode\\seasons\\.qa-shots'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 800, height: 500 }, deviceScaleFactor: 2 })
const errs = []; page.on('pageerror', e => errs.push(e.message))
await page.goto(`http://localhost:${PORT}/seasons/?dev=1`, { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.locator('.gate').click().catch(() => {}); await page.waitForTimeout(1200)
const scene = process.argv[2] || 'kitaterao-window-3d-spring'
await page.evaluate((s) => window.__applyScene(s), scene).catch(() => {}); await page.waitForTimeout(3400)
const has = await page.evaluate(() => typeof window.__town3dShotAt).catch(() => 'x')
console.log('shotAt=' + has + ' scene=' + scene)
const save = (tag, url) => { if (!url) { console.log('NO ' + tag); return } writeFileSync(`${OUT}\\${tag}.png`, Buffer.from(url.split(',')[1], 'base64')); console.log(tag) }
for (const [tag, cx, cy, cz, lx, ly, lz, fov] of [
  ['sea2-open', 240, 9, -120, 560, -9.4, -240, 62],
  ['sea2-low', 180, -6.5, -90, 520, -9.3, -200, 60],
]) {
  const url = await page.evaluate(([cx, cy, cz, lx, ly, lz, fov]) => window.__town3dShotAt(cx, cy, cz, lx, ly, lz, fov), [cx, cy, cz, lx, ly, lz, fov]).catch(() => null)
  save(tag, url)
}
console.log(errs.length ? 'ERR ' + errs.slice(0, 2).join(' | ') : 'no err')
await browser.close()
