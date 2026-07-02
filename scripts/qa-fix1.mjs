// Phase1修正の検証: 車レーンのクリア化・電車のレール外非表示・踏切x=0・時代の家コライダー・歩行衝突の動作
import { chromium } from 'playwright'
import fs from 'node:fs'
const port = process.env.PORT || '4890'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE EXCEPTION:', e.message))
page.on('console', (m) => { if (m.type() === 'error') console.log('PAGE ERROR:', m.text()) })
await page.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene && window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(1800)
await page.evaluate(() => window.__town3dWindow(true)); await page.waitForTimeout(1000)
await page.evaluate(() => window.__town3dLean(true)); await page.waitForTimeout(1300)
await page.evaluate(() => window.__town3dFly(true)); await page.waitForTimeout(400)
await page.evaluate(() => window.__town3dCruise(false))
await page.addStyleTag({ content: '.ui{display:none !important}' })

const save = (dataUrl, name) => { if (!dataUrl) { console.log('SHOT失敗:', name); return } fs.writeFileSync(`scripts/_shots/fix1-${name}.png`, Buffer.from(dataUrl.split(',')[1], 'base64')) }
const shotAt = async (name, cx, cy, cz, lx, ly, lz, fov) => save(await page.evaluate(([a, b, c, d, e, f, g]) => window.__town3dShotAt(a, b, c, d, e, f, g), [cx, cy, cz, lx, ly, lz, fov || 55]), name)

// A. 車レーン: 新走行区間(z=-16..22)にコライダーが無いこと＋旧貫通区間に車が入らないこと
const laneCheck = await page.evaluate(() => {
  let bad = 0
  for (const lane of [-1.7, -1.5, 1.5, 1.7]) for (let z = -16; z <= 22; z += 0.5) if (window.__town3dProbe(lane, z).blocked) bad++
  return bad
})
console.log('新走行区間のコライダー衝突点:', laneCheck, '(0なら合格)')

// B. 江戸の町家コライダー: 家の中心座標で blocked=true になるか（時代エリアすり抜け対策）
const eraCol = await page.evaluate(() => {
  // 江戸中心(640,-46)周辺の格子を走査し、blockedな点の数を数える（修正前はほぼ0だった）
  let blocked = 0, total = 0
  for (let dx = -40; dx <= 40; dx += 2) for (let dz = -40; dz <= 40; dz += 2) { total++; if (window.__town3dProbe(640 + dx, -46 + dz).blocked) blocked++ }
  return { blocked, total, nColliders: window.__town3dProbe(0, 0).nColliders }
})
console.log('江戸中心80x80mのblocked率:', JSON.stringify(eraCol))

// C. 踏切: x=0 の中央通りと線路の交点を俯瞰（遮断機が主道路の両肩に立つ）
await shotAt('crossing-x0', 9, 15, -40, 0, 0, -51.5, 58)

// D. 電車: 旧軌道外区間(x=-24..-6)で車両が見えないこと＋レール上で見えること（連続フレーム）
for (let i = 0; i < 10; i++) {
  await page.waitForTimeout(1100)
  await shotAt(`train-${i}`, -6, 22, -50.5, -6, 0, -51.5, 60)
}

// E. 車の走行風景（新区間の街並みで自然か）
await shotAt('cars-street', 6, 10, 10, -2, 0.5, -4, 60)
await browser.close()
console.log('fix1 done')
