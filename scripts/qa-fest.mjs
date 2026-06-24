// 夏祭りの検証: 夜シーンで会場が建つか(視覚)＋囃子が距離で満ち引きするか(音)
import { chromium } from 'playwright'
import fs from 'fs'
const port = process.env.PORT || '4801'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 480, height: 880 }, deviceScaleFactor: 2 })
const errs = []
p.on('pageerror', (e) => errs.push(String(e).slice(0, 120)))
await p.goto(`http://localhost:${port}/seasons/?dev=1&fest=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(() => {})
await p.waitForTimeout(700)
await p.evaluate(() => window.__applyScene('kitaterao-window-3d-night'))
await p.waitForTimeout(2800)

// ── 視覚: 学校の校庭の盆踊り(54,-14)と公園の祭り(16,-36)を撮る ──
const shots = [
  ['fest-school', [44, 13, 0, 54, 2.5, -14, 58]],   // 校庭の盆踊りを斜め上から
  ['fest-park', [6, 13, -22, 16, 2.5, -36, 58]],     // 公園の祭りを斜め上から
  ['fest-school-eye', [54, 4, 2, 54, 3, -14, 62]],   // 校庭を地上目線で
]
for (const [name, args] of shots) {
  const url = await p.evaluate((a) => window.__town3dShotAt(...a), args)
  if (url) fs.writeFileSync(`scripts/_shots/${name}.png`, Buffer.from(url.split(',')[1], 'base64'))
}

// ── 音: 囃子が距離で満ち引きするか。飛行で会場へ近づきながら getDebug().fest を読む ──
await p.evaluate(() => window.__town3dFly && window.__town3dFly(true))
await p.waitForTimeout(400)
const samples = [
  ['遠 (250,6,250)', [250, 6, 250]],
  ['中 (54,6,80)', [54, 6, 80]],
  ['近 学校 (54,6,-2)', [54, 6, -2]],
  ['至近 学校中心 (54,5,-14)', [54, 5, -14]],
  ['近 公園 (16,6,-26)', [16, 6, -26]],
]
const out = []
for (const [label, pose] of samples) {
  await p.evaluate((pp) => window.__town3dFlyPose(pp[0], pp[1], pp[2], 0, -0.2), pose)
  await p.waitForTimeout(900)
  const dbg = await p.evaluate(() => window.__audio && window.__audio.getDebug && window.__audio.getDebug())
  out.push(`${label}: fest=${dbg ? dbg.fest : '?'}`)
}
console.log(out.join('\n'))
console.log(errs.length ? 'ERR ' + errs.slice(0, 2).join(' | ') : 'errors=0')
await b.close()
