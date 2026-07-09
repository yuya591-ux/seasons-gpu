import { chromium } from 'playwright'
import { writeFileSync } from 'fs'
const PORT = process.env.PORT || 4931
const OUT = 'C:\\Users\\yuya.satake\\ClaudeCode\\seasons\\.qa-shots'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 560, height: 640 }, deviceScaleFactor: 2 })
const errs = []; page.on('pageerror', e => errs.push(e.message))
await page.goto(`http://localhost:${PORT}/seasons-gpu/?dev=1&fest=1`, { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.locator('.gate').click().catch(() => {}); await page.waitForTimeout(1200)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d')).catch(() => {}); await page.waitForTimeout(3200)
const cnt = await page.evaluate(() => window.__town3dFolkCount && window.__town3dFolkCount()).catch(() => 0)
console.log('folk count = ' + cnt)
const save = (tag, url) => { if (!url) { console.log('NO ' + tag); return } writeFileSync(`${OUT}\\${tag}.png`, Buffer.from(url.split(',')[1], 'base64')); console.log(tag) }
for (const [tag, face, cx, cz, fov] of [
  ['folk-front', Math.PI / 2 + 0.45, 2.6, 1.0, 32],
  ['folk-side', 0, 0.2, 2.7, 30],
]) {
  await page.evaluate(([face]) => window.__town3dFolkPin && window.__town3dFolkPin(0, 0, 0, face, 90), [face]).catch(() => {})
  await page.waitForTimeout(400)
  const url = await page.evaluate(([cx, cz, fov]) => window.__town3dShotAt(cx, 90.85, cz, 0, 90.78, 0, fov), [cx, cz, fov]).catch(() => null)
  save(tag, url)
}
console.log(errs.length ? 'ERR ' + errs.slice(0, 3).join(' | ') : 'no err')
await browser.close()
