// 広域リベール検証: ①現代から拠点が見えない ②近づくと広く霞から街が立ち上がる ③2拠点が共視界に入らない。
// EDO(470,-46) SENGOKU(36,-486) home(0,0)。dbgでfog farも確認。
import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message))
await page.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(2400)
await page.evaluate(() => { window.__town3dFly(true) }); await page.waitForTimeout(700)
await page.evaluate(() => { window.__town3dCruise(false) })
const E = Math.PI / 2
const shot = async (x, y, z, yaw, pit, name) => {
  await page.evaluate(([x, y, z, e, p]) => window.__town3dFlyPose(x, y, z, e, p), [x, y, z, yaw, pit])
  await page.waitForTimeout(750)
  await page.screenshot({ path: `scripts/_shots/${name}.png` })
}
await shot(60, 28, -46, E, -0.05, 'reveal-home-east')   // 現代の近くから東(江戸方向)＝霞のみ・城下町は見えない
await shot(255, 40, -46, E, -0.08, 'reveal-far')        // dEdo≈215＝霞の向こうに街が立ち上がり始める
await shot(330, 36, -46, E, -0.10, 'reveal-mid')        // dEdo≈140＝城下町が広く見える
await shot(405, 30, -46, E, -0.12, 'reveal-near')       // dEdo≈65＝目前
await shot(253, 50, -266, E, -0.06, 'reveal-midpoint')  // 2拠点の中間(各309)＝どちらも見えない海
await shot(40, 30, -240, 0, -0.06, 'reveal-north')      // 北(戦国方向)dSen≈246＝立ち上がり始め
console.log('reveal shots done')
await browser.close()
