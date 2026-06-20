// 大正の港町(西 -490,-30)が霞から立ち上がるか確認。西(-x)へ近づきながら数カット。
import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message))
await page.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
const W = -Math.PI / 2 // 西(-x)を向く（forward=(sin,−cos): sin(-π/2)=-1 → -x）
const run = async (scene, tag) => {
  await page.evaluate((s) => window.__applyScene(s), scene); await page.waitForTimeout(2400)
  await page.evaluate(() => { window.__town3dFly(true) }); await page.waitForTimeout(700)
  await page.evaluate(() => { window.__town3dCruise(false) })
  const shoot = async (x, y, pit, name) => { await page.evaluate(([x, y, w, p]) => window.__town3dFlyPose(x, y, -30, w, p), [x, y, W, pit]); await page.waitForTimeout(750); await page.screenshot({ path: `scripts/_shots/${name}-${tag}.png` }) }
  await shoot(-250, 38, -0.05, 'taisho-far')   // dTai≈240
  await shoot(-360, 34, -0.09, 'taisho-mid')   // dTai≈130
  await shoot(-430, 28, -0.12, 'taisho-near')  // dTai≈60
  await shoot(-410, 88, -0.5, 'taisho-grand')  // 高所から港町全景
}
await run('kitaterao-window-3d', 'day')
await run('kitaterao-window-3d-night', 'night')
console.log('taisho shots done')
await browser.close()
