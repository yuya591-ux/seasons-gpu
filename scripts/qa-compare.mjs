// 全4エリアを同じ相対ポーズ(中心の南100・高さ90・見下ろし)で空撮し、サイズ/品質を客観比較。
import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
p.on('pageerror', (e) => console.log('PAGE ERROR', e.message))
await p.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(() => {})
await p.waitForTimeout(700)
await p.evaluate(() => window.__applyScene('kitaterao-window-3d'))
await p.waitForTimeout(2400)
await p.evaluate(() => { window.__town3dFly(true) }); await p.waitForTimeout(700)
await p.evaluate(() => { window.__town3dCruise(false) })
const areas = [['home', 0, 0], ['edo', 486, -46], ['sengoku', 120, -486], ['taisho', -490, -30]]
for (const [name, cx, cz] of areas) {
  // 中心の南(+z)100, 高さ85, 中心へ見下ろし
  await p.evaluate(([cx, cz]) => window.__town3dFlyPose(cx, 85, cz + 105, Math.PI, -0.62), [cx, cz])
  await p.waitForTimeout(900)
  await p.screenshot({ path: `scripts/_shots/cmp-${name}.png` })
  // 接地レベルの眺めも
  await p.evaluate(([cx, cz]) => window.__town3dFlyPose(cx, 24, cz + 60, Math.PI, -0.14), [cx, cz])
  await p.waitForTimeout(900)
  await p.screenshot({ path: `scripts/_shots/cmp-${name}-low.png` })
}
console.log('compare shots done')
await b.close()
