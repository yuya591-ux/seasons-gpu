// 歩行目線(地上~2.6m)で現代homeの各所を近接撮影し、ローポリ/安っぽさを洗い出す
import { chromium } from 'playwright'
import fs from 'fs'
const port = process.env.PORT || '4801'
const scene = process.argv[2] || 'kitaterao-window-3d'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 720, height: 900 }, deviceScaleFactor: 2 })
const errs = []
p.on('pageerror', (e) => errs.push(String(e).slice(0, 120)))
await p.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(() => {})
await p.waitForTimeout(700)
await p.evaluate((s) => window.__applyScene(s), scene)
await p.waitForTimeout(2600)
// [name, cx,cz, lx,lz, fov] ＝ 開けた所(道/中央)から建物群を見る。Y は地面高さから算出して地中に潜らせない。
const spots = [
  ['p-resi-east', 4, -8, 16, -19, 60],   // 中央の道から東の住宅街
  ['p-shoten', 0, -13, 0, -27, 60],      // 商店街を見通す
  ['p-resi-west', -4, -9, -17, -22, 60], // 西の住宅街
  ['p-park-edge', 10, -18, 16, -27, 62], // 公園の縁
  ['p-river', -44, -16, -50, -30, 60],   // 川辺の遊歩道
  ['p-corner', 0, 1, 0, -18, 64],        // 中央の道・商店街ゲート
  ['p-house', 5, -10, 12, -16, 56],      // 住宅の近景
  ['p-tower', -7, -38, -7, -48, 62],     // 展望塔の足元
]
for (const [name, cx, cz, lx, lz, fov] of spots) {
  const cy = await p.evaluate(([x, z]) => window.__town3dGroundAt(x, z) + 2.6, [cx, cz])
  const ly = await p.evaluate(([x, z]) => window.__town3dGroundAt(x, z) + 1.6, [lx, lz])
  const url = await p.evaluate((args) => window.__town3dShotAt(...args), [cx, cy, cz, lx, ly, lz, fov])
  if (url) fs.writeFileSync(`scripts/_shots/${name}.png`, Buffer.from(url.split(',')[1], 'base64'))
}
console.log(errs.length ? 'ERR ' + errs.slice(0, 2).join(' | ') : 'errors=0')
await b.close()
