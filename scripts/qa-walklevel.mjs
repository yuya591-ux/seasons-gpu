import { chromium } from 'playwright'
import fs from 'node:fs'
// 各エリアを「眼の高さ(地面+1.7m)」で点検＝歩いている時に一番粗が出る視点。
const PORT = process.env.PORT || 4920
const OUT = 'C:\\Users\\yuya.satake\\ClaudeCode\\seasons\\.qa-shots'
fs.mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 500, height: 400 }, deviceScaleFactor: 1.5 })
const errs = []
page.on('pageerror', (e) => errs.push('PE:' + e.message))
page.on('console', (m) => { if (m.type() === 'error') errs.push('CE:' + m.text().slice(0, 120)) })
await page.goto(`http://localhost:${PORT}/seasons-gpu/?dev=1`, { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(1200)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d')).catch(() => {})
await page.waitForTimeout(2600)
// [tag, 立つx, 立つz, 見るx, 見るz]
const spots = [
  ['home', -16, -34, 20, 6],     // 現代home：南西の住宅から街中心へ
  ['taisho', -620, -16, -648, -40], // 大正：街路から
  ['edo', 614, -24, 632, -52],    // 江戸：町家の通りから天守方向
  ['sengoku', 150, -598, 150, -640], // 戦国：谷の城下町から城方向
]
for (const [tag, sx, sz, lx, lz] of spots) {
  await page.evaluate(([x, z]) => window.__town3dFlyPose(x, 30, z, Math.PI, -0.2), [sx, sz]).catch(() => {})
  await page.waitForTimeout(1600)
  const gy = await page.evaluate(([x, z]) => window.__town3dGroundAt(x, z), [sx, sz]).catch(() => 6)
  const ly = await page.evaluate(([x, z]) => window.__town3dGroundAt(x, z), [lx, lz]).catch(() => gy)
  const cam = [sx, (gy || 6) + 1.7, sz, lx, (ly || gy || 6) + 2.2, lz, 62]
  const url = await page.evaluate((a) => window.__town3dShotAt(...a), cam)
  if (url && url.startsWith('data:image')) { fs.writeFileSync(`${OUT}\\walk-${tag}.png`, Buffer.from(url.split(',')[1], 'base64')); console.log('saved', `walk-${tag}.png`, 'gy=' + (gy||0).toFixed(1)) }
}
console.log(errs.length ? 'エラー:' + JSON.stringify(errs.slice(0, 4)) : 'コンソールエラー無し')
await browser.close()
