// 診断第2弾: 数値裏取り(車レーン上のコライダー)＋撮り直し(踏切/線路西端/江戸群衆/道路)
import { chromium } from 'playwright'
import fs from 'node:fs'
const port = process.env.PORT || '4890'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE EXCEPTION:', e.message))
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

const save = (dataUrl, name) => { if (!dataUrl) { console.log('SHOT失敗:', name); return } fs.writeFileSync(`scripts/_shots/diag-${name}.png`, Buffer.from(dataUrl.split(',')[1], 'base64')) }
const shotAt = async (name, cx, cy, cz, lx, ly, lz, fov) => save(await page.evaluate(([a, b, c, d, e, f, g]) => window.__town3dShotAt(a, b, c, d, e, f, g), [cx, cy, cz, lx, ly, lz, fov || 55]), name)

// ── A. 数値裏取り: 車のレーン(x=±1.5, z=-95..22)上に建物コライダーが被る地点を列挙 ──
const laneHits = await page.evaluate(() => {
  const out = []
  for (const lane of [-1.5, 1.5]) {
    let run = null
    for (let z = -95; z <= 22; z += 1) {
      const b = window.__town3dProbe(lane, z).blocked
      if (b && !run) run = z
      if (!b && run !== null) { out.push({ lane, from: run, to: z - 1 }); run = null }
    }
    if (run !== null) out.push({ lane, from: run, to: 22 })
  }
  return out
})
console.log('レーン上のコライダー区間:', JSON.stringify(laneHits))

// ── B. 踏切ズレ: 東寄りから見下ろす(煙突回避) ──
await shotAt('crossing-2', 12, 17, -38, 3, 0, -51.5, 58)

// ── C. 線路西端: 真上からの連続フレームで軌道外走行を捕捉 ──
for (let i = 0; i < 12; i++) {
  await page.waitForTimeout(1000)
  await shotAt(`west-${i}`, -13, 26, -50.5, -13, 0, -51.5, 55)
}

// ── D. 道路: 真上＋歩行者目線 ──
await shotAt('road-top', 0, 42, -9, 0, 0, -10, 55)
{
  const y = await page.evaluate(() => window.__town3dGroundAt(1.5, -2))
  await shotAt('road-eye', 1.5, y + 1.5, -2, 1.2, y + 0.8, -22, 60)
}

// ── E. 江戸: プレイヤーを実際に移動→時代カリング解除を待って群衆を撮る ──
await page.evaluate(() => window.__town3dFlyPose && window.__town3dFlyPose(660, 14, -30, 2.4, -0.2))
for (let i = 0; i < 10; i++) {
  await page.waitForTimeout(1000)
  const st = await page.evaluate(() => window.__town3dEraCull && window.__town3dEraCull())
  if (st && st.every((e) => e.vis || e.n === 0)) break
  if (i === 9) console.log('eraCull状態:', JSON.stringify(st))
}
await page.waitForTimeout(1500)
{
  const y = await page.evaluate(() => window.__town3dGroundAt(650, -40))
  await shotAt('edo-street', 650, y + 1.7, -36, 640, y + 1.0, -46, 55)
  await shotAt('edo-road-close', 655, y + 6, -30, 640, y - 1, -46, 55)
}
await browser.close()
console.log('diag3 done')
