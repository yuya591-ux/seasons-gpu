import { chromium } from 'playwright'
import fs from 'node:fs'
// 主観視点・ごく近い距離での点検。眼の高さ(地面+1.6m)で数m先の近接オブジェクトを撮る(生WebGL=造形の粗さがよく分かる)。
const PORT = process.env.PORT || 4920
const SCENE = process.env.SCENE || 'kitaterao-window-3d'
const TAG = process.env.TAG || 'home'
const OUT = 'C:\\Users\\yuya.satake\\ClaudeCode\\seasons\\.qa-shots'
fs.mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 540, height: 460 }, deviceScaleFactor: 2 })
const errs = []; page.on('pageerror', e => errs.push(e.message))
await page.goto(`http://localhost:${PORT}/seasons/?dev=1`, { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(1200)
await page.evaluate(s => window.__applyScene(s), SCENE).catch(() => {})
await page.waitForTimeout(2800)
const spots = JSON.parse(process.env.SPOTS || '[]')
let n = 0
for (const [tag, sx, sz, lx, lz] of spots) {
  await page.evaluate(([x, z]) => window.__town3dFlyPose(x, 26, z, Math.PI, -0.1), [sx, sz]).catch(() => {})
  await page.waitForTimeout(1100)
  const gy = await page.evaluate(([x, z]) => window.__town3dGroundAt(x, z), [sx, sz]).catch(() => 0)
  const ly = await page.evaluate(([x, z]) => window.__town3dGroundAt(x, z), [lx, lz]).catch(() => gy)
  const cam = [sx, (gy || 0) + 1.6, sz, lx, (ly || gy || 0) + 1.2, lz, 58]
  const url = await page.evaluate(a => window.__town3dShotAt(...a), cam)
  if (url && url.startsWith('data:image')) { fs.writeFileSync(`${OUT}\\cu-${TAG}-${tag}.png`, Buffer.from(url.split(',')[1], 'base64')); console.log(`cu-${TAG}-${tag} gy=${(gy || 0).toFixed(1)}`); n++ }
}
console.log('saved', n, errs.length ? 'ERR ' + errs.slice(0, 3).join('|') : 'no err')
await browser.close()
