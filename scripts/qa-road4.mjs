// Phase4 道路統一の検証: 中央通りの横断ピアス（幅分割1）・時代エリアの坂の浮き/刺さり・交差の重ね置き
// 使い方: TAG=before node scripts/qa-road4.mjs → 修正後 TAG=after で同条件比較
import { chromium } from 'playwright'
import fs from 'node:fs'
const port = process.env.PORT || '4890'
const TAG = process.env.TAG || 'after'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE EXCEPTION:', e.message))
await page.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene && window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(1800)
await page.evaluate(() => window.__town3dWindow(true)); await page.waitForTimeout(1000)
await page.evaluate(() => window.__town3dLean(true)); await page.waitForTimeout(1300)
await page.evaluate(() => window.__town3dFly(true)); await page.waitForTimeout(400)
await page.evaluate(() => window.__town3dCruise(false))
await page.addStyleTag({ content: '.ui{display:none !important}' })

const save = (dataUrl, name) => { if (!dataUrl) { console.log('SHOT失敗:', name); return } fs.writeFileSync(`scripts/_shots/road-${TAG}-${name}.png`, Buffer.from(dataUrl.split(',')[1], 'base64')) }
const shotAt = (cx, cy, cz, lx, ly, lz, fov) => page.evaluate(([a, b, c, d, e, f, g]) => window.__town3dShotAt(a, b, c, d, e, f, g), [cx, cy, cz, lx, ly, lz, fov || 55])
const pose = async (x, y, z, yaw = 0) => { await page.evaluate(([a, b, c, w]) => window.__town3dFlyPose(a, b, c, w, 0), [x, y, z, yaw]); await page.waitForTimeout(900) }

// ── A. 中央通り: 幅分割1で路面中央に地形が突き抜けるかの数値プローブ ──
const probe = await page.evaluate(() => {
  const rows = []
  for (let z = -97; z <= 27; z += 1) {
    const e0 = window.__town3dGroundAt(-3.75, z), e1 = window.__town3dGroundAt(3.75, z)
    const road = (e0 + e1) / 2 + 0.07 // 幅分割1の路面（両端の直線補間）@中央
    let worst = -1e9, wx = 0
    for (const x of [-1.9, 0, 1.9]) { const d = window.__town3dGroundAt(x, z) - road; if (d > worst) { worst = d; wx = x } }
    rows.push([z, +worst.toFixed(3), wx])
  }
  rows.sort((a, b) => b[1] - a[1])
  return rows.slice(0, 6)
})
console.log('A: 中央通りの地形突き抜け上位（z, 地面-路面, x）:', JSON.stringify(probe))
{
  const [z0] = probe[0]
  const gy = await page.evaluate((z) => window.__town3dGroundAt(0, z), z0)
  await pose(1.2, gy + 1.7, z0 + 13, Math.PI)
  save(await shotAt(1.2, gy + 1.7, z0 + 13, 0, gy + 0.3, z0, 55), 'home-worst')
  save(await shotAt(6, gy + 9, z0 + 9, 0, gy, z0 - 6, 55), 'home-worst-air')
}

// ── B. 江戸: 参道（西向き）×環状道路の交差＋街路網の俯瞰 ──
{
  const g1 = await page.evaluate(() => window.__town3dGroundAt(574, -46))
  await pose(574, g1 + 24, -16)
  save(await shotAt(574, g1 + 24, -16, 574, g1, -46, 58), 'edo-cross-air')
  await pose(574, g1 + 1.8, -34)
  save(await shotAt(574, g1 + 1.8, -34, 574, g1 + 0.2, -50, 55), 'edo-cross-eye')
  save(await shotAt(640, g1 + 90, 40, 640, 0, -46, 60), 'edo-net-air')
}

// ── C. 戦国: 谷の街道と城への坂道（浮き/刺さり） ──
{
  const g2 = await page.evaluate(() => window.__town3dGroundAt(140, -600))
  await pose(140, g2 + 30, -560)
  save(await shotAt(140, g2 + 30, -560, 140, g2 - 6, -640, 58), 'sen-valley-air')
  save(await shotAt(120, g2 + 14, -600, 155, g2, -640, 55), 'sen-road-low')
}

// ── D. 大正: 碁盤の縦×横の交差（重ね置き）＋俯瞰 ──
{
  const g3 = await page.evaluate(() => window.__town3dGroundAt(-640, -30))
  await pose(-640, g3 + 26, -6)
  save(await shotAt(-640, g3 + 26, -6, -640, g3, -30, 58), 'tai-cross-air')
  await pose(-632, g3 + 1.8, -30)
  save(await shotAt(-632, g3 + 1.8, -30, -646, g3 + 0.1, -30, 55), 'tai-cross-eye')
}
await browser.close()
console.log('qa-road4 done TAG=' + TAG)
