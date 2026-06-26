import { chromium } from 'playwright'
import { writeFileSync } from 'fs'
const PORT = process.env.PORT || 4931
const OUT = 'C:\\Users\\yuya.satake\\ClaudeCode\\seasons\\.qa-shots'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 720, height: 600 }, deviceScaleFactor: 2 })
const errs = []; page.on('pageerror', e => errs.push(e.message))
await page.goto(`http://localhost:${PORT}/seasons/?dev=1`, { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.locator('.gate').click().catch(() => {}); await page.waitForTimeout(1200)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d-spring')).catch(() => {}); await page.waitForTimeout(3200)
const save = (tag, url) => { if (!url) { console.log('NO ' + tag); return } writeFileSync(`${OUT}\\${tag}.png`, Buffer.from(url.split(',')[1], 'base64')); console.log(tag) }
// 群衆クラスタ（mkCrowdPerson）の中心を接写。[tag, 注視x, 注視z, カメラ距離, fov]
const spots = [
  ['mkt-edo', 614.4, -28.5, 9, 40],   // 江戸 市場（売り子9＋買い物客7）
  ['mkt-sengoku', 140, -628, 11, 46],  // 戦国 街道沿いの人々
  ['mkt-taisho', -640, -30, 13, 48],   // 大正 通りの人々
]
for (const [tag, lx, lz, dist, fov] of spots) {
  const gy = await page.evaluate(([x, z]) => window.__town3dGroundAt(x, z), [lx, lz]).catch(() => 0)
  const url = await page.evaluate(([lx, lz, gy, dist, fov]) => window.__town3dShotAt(lx, gy + 1.55, lz + dist, lx, gy + 0.85, lz, fov), [lx, lz, gy, dist, fov]).catch(() => null)
  save(tag, url)
}
console.log(errs.length ? 'ERR ' + errs.slice(0, 3).join(' | ') : 'no err')
await browser.close()
