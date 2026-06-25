import { chromium } from 'playwright'
import fs from 'node:fs'
// homeエリアを眼の高さ(地面+1.7)で複数地点点検。歩行で見える粗さ＋黒いリングの正体。
const PORT = process.env.PORT || 4920
const OUT = 'C:\\Users\\yuya.satake\\ClaudeCode\\seasons\\.qa-shots'
fs.mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 500, height: 400 }, deviceScaleFactor: 1.5 })
const errs = []
page.on('pageerror', (e) => errs.push('PE:' + e.message))
page.on('console', (m) => { if (m.type() === 'error') errs.push('CE:' + m.text().slice(0, 120)) })
await page.goto(`http://localhost:${PORT}/seasons/?dev=1`, { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(1200)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d')).catch(() => {})
await page.waitForTimeout(2600)
// [tag, 立つx,z, 見るx,z]
const spots = [
  ['park', 16, -20, 16, -30],
  ['station', 30, -52, 34, -44],
  ['resi', -36, -22, -10, -22],
  ['shop', -90, -48, -118, -56],
]
for (const [tag, sx, sz, lx, lz] of spots) {
  await page.evaluate(([x, z]) => window.__town3dFlyPose(x, 24, z, Math.PI, -0.2), [sx, sz]).catch(() => {})
  await page.waitForTimeout(1400)
  const gy = await page.evaluate(([x, z]) => window.__town3dGroundAt(x, z), [sx, sz]).catch(() => 0)
  const ly = await page.evaluate(([x, z]) => window.__town3dGroundAt(x, z), [lx, lz]).catch(() => gy)
  const cam = [sx, (gy || 0) + 1.7, sz, lx, (ly || gy || 0) + 2.0, lz, 64]
  const url = await page.evaluate((a) => window.__town3dShotAt(...a), cam)
  if (url && url.startsWith('data:image')) { fs.writeFileSync(`${OUT}\\hw-${tag}.png`, Buffer.from(url.split(',')[1], 'base64')); console.log('saved', `hw-${tag}.png`, 'gy=' + (gy||0).toFixed(1)) }
}
console.log(errs.length ? 'エラー:' + JSON.stringify(errs.slice(0, 4)) : 'コンソールエラー無し')
await browser.close()
