// 白飛び検証: 飛行中に視界が真っ白になる箇所の検出（修正前後で同条件比較する）
// 指標: A.雲の分布（漂流折返しバグ=遠方エリアの雲がhomeへ吹き溜まる） B.雲接触位置の不透明度（近接フェード）
//       C.雲へ接近する連続ショット（見た目） D.巡航グリッドの白画素率スイープ（他の白飛び源の網）
// 使い方: TAG=before node scripts/qa-whiteout.mjs → 修正後 TAG=after で再実行し比較
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

const save = (dataUrl, name) => { if (!dataUrl) { console.log('SHOT失敗:', name); return } fs.writeFileSync(`scripts/_shots/wo-${TAG}-${name}.png`, Buffer.from(dataUrl.split(',')[1], 'base64')) }
const shotAt = (cx, cy, cz, lx, ly, lz, fov) => page.evaluate(([a, b, c, d, e, f, g]) => window.__town3dShotAt(a, b, c, d, e, f, g), [cx, cy, cz, lx, ly, lz, fov || 58])
// 画像の「白っぽさ」= 明るく彩度の低い画素の割合（全体と下半分）。下半分は通常は地面＝白飛びの検出感度が高い
const whiteFrac = (dataUrl) => page.evaluate((url) => new Promise((res) => {
  const img = new Image()
  img.onload = () => {
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height
    const x = c.getContext('2d'); x.drawImage(img, 0, 0)
    const d = x.getImageData(0, 0, c.width, c.height).data
    let w = 0, wLow = 0
    const n = c.width * c.height, half = c.height >> 1
    for (let py = 0; py < c.height; py++) for (let px = 0; px < c.width; px++) {
      const i = (py * c.width + px) * 4, r = d[i], g = d[i + 1], b = d[i + 2]
      const lum = (r + g + b) / 3, sat = Math.max(r, g, b) - Math.min(r, g, b)
      if (lum > 150 && sat < 62) { w++; if (py >= half) wLow++ } // 生WebGLでは雲は灰ベージュに写る（CSSグレードで白く見える）＝明るめ×低彩度を「雲/白系の塗りつぶし」とみなす
    }
    res({ all: +(w / n).toFixed(3), low: +(wLow / (n / 2)).toFixed(3) })
  }
  img.src = url
}), dataUrl)

// ── A. 雲の分布 ──
const cl = await page.evaluate(() => window.__town3dClouds())
const edoSky = cl.filter((c) => c[0] > 400).length
const taiSky = cl.filter((c) => c[0] < -400).length
const pileW = cl.filter((c) => Math.abs(c[0] + 130) < 16).length
console.log(`A: 雲=${cl.length} 江戸の空(x>400)=${edoSky} 大正の空(x<-400)=${taiSky} 西端x≈-130の吹き溜まり=${pileW}`)

// ── B/C. home付近の雲へ接近（正面から距離を詰める）。接触距離で不透明度と画面の白さを測る ──
const nearHome = cl.filter((c) => Math.abs(c[0]) < 180 && c[2] > -190 && c[2] < 40 && c[1] < 102)
  .sort((a, b) => Math.hypot(a[0], a[2]) - Math.hypot(b[0], b[2]))
console.log('B: home付近の雲:', nearHome.slice(0, 4).map((c) => c.join(',')).join(' | '))
for (let k = 0; k < Math.min(2, nearHome.length); k++) {
  const [cx, cy, cz] = nearHome[k]
  for (const dist of [44, 30, 21, 14]) {
    const px = cx, py = cy, pz = cz + dist // 南から北向きに接近
    await page.evaluate(([x, y, z]) => window.__town3dFlyPose(x, y, z, Math.PI, 0), [px, py, pz]) // yaw=π: -zの雲を向く
    await page.waitForTimeout(280)
    const cl2 = await page.evaluate(() => window.__town3dClouds())
    const me = cl2.reduce((m, c) => { const d = Math.hypot(c[0] - px, c[1] - py, c[2] - pz); return d < m.d ? { d, op: c[3] !== undefined ? c[3] : 1 } : m }, { d: 1e9, op: 1 })
    const du = await shotAt(px, py, pz, cx, cy, cz - 6, 58)
    const wf = du ? await whiteFrac(du) : { all: -1, low: -1 }
    console.log(`B: 雲${k} dist=${dist} 最寄り雲の不透明度=${me.op} 白画素率 all=${wf.all} low=${wf.low}`)
    if (dist !== 30) save(du, `cloud${k}-d${dist}`)
  }
}

// ── D. 巡航グリッドの白飛びスイープ（他の未知の白飛び源の網） ──
let worst = { f: 0 }
if (process.env.SKIP_D) { await browser.close(); console.log('qa-whiteout done (D skip) TAG=' + TAG); process.exit(0) }
for (const y of [50, 68, 76]) for (const x of [-120, -60, 0, 60, 120]) for (const z of [-120, -60, 0]) for (const yaw of [0, Math.PI]) {
  const lx = x + Math.sin(yaw) * -30, lz = z + Math.cos(yaw) * -30 // yaw=0で-z向き
  await page.evaluate(([a, b, c, w]) => window.__town3dFlyPose(a, b, c, w, 0), [x, y, z, yaw])
  await page.waitForTimeout(90)
  const du = await shotAt(x, y, z, lx, y - 6, lz, 58)
  if (!du) continue
  const wf = await whiteFrac(du)
  if (wf.low > worst.f) { worst = { f: wf.low, x, y, z, yaw: +yaw.toFixed(2), du } }
  if (wf.low > 0.8) { console.log(`D: 白飛び疑い x=${x} y=${y} z=${z} yaw=${yaw.toFixed(2)} low=${wf.low}`); save(du, `sweep-${x}_${y}_${z}_${yaw.toFixed(1)}`) }
}
console.log(`D: 最悪点 low=${worst.f} @ x=${worst.x} y=${worst.y} z=${worst.z} yaw=${worst.yaw}`)
if (worst.du) save(worst.du, 'sweep-worst')
await browser.close()
console.log('qa-whiteout done TAG=' + TAG)
