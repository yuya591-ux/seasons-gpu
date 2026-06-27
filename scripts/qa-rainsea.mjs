// 雨が雲海より上で止む演出の確認。雨の3D街シーンで、雲海(SEA_Y=88)の下→中→上 と高度を上げ、
// 雨脚・濡れ路面・波紋が高度に応じてフェードして上空で消えることを目視＋ランタイムエラー検知。
import { chromium } from 'playwright'
const port = process.env.PORT || '4990'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 600, height: 420 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message))
await page.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(600)
await page.addStyleTag({ content: '.ui{display:none !important}' })
async function fly(scene) {
  await page.evaluate((s) => window.__applyScene(s), scene)
  await page.waitForTimeout(2300)
  await page.evaluate(() => { window.__town3dWindow(true) }); await page.waitForTimeout(300)
  await page.evaluate(() => { window.__town3dLean(true) }); await page.waitForTimeout(800)
  await page.evaluate(() => { window.__town3dFly(true) }); await page.waitForTimeout(300)
  await page.evaluate(() => { window.__town3dCruise(false); window.__town3dZoom(1.0) })
}
async function shot(label, pose) {
  await page.evaluate((p) => window.__town3dFlyPose(p[0], p[1], p[2], p[3], p[4]), pose)
  await page.waitForTimeout(1600)
  await page.screenshot({ path: `scripts/_shots/rainsea-${label}.png` })
  console.log(label, 'done')
}
await fly('kitaterao-window-3d-rain')
// y=40 下界(満雨) / y=88 雲海の中(雨フェード中) / y=120 雲の上(晴れ＝雨ゼロ) を見上げ/見下ろし
await shot('below-y40', [0, 40, -40, 0, 0.06])    // 下界＝しっかり雨
await shot('mid-y88', [0, 88, -40, 0, 0.04])      // 雲海の中＝雨が薄れる
await shot('above-y120', [0, 120, -40, 0, -0.05]) // 雲の上＝晴れ（雨が無い）
await browser.close()
console.log('check done')
