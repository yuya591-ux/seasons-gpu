// 目的地で自動減速を確認: 江戸へ近づく各地点で巡航速度(vel)が落ちるか。
import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message))
await page.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(2400)
await page.evaluate(() => { window.__town3dFly(true) }); await page.waitForTimeout(700)
await page.evaluate(() => { window.__town3dCruise(true) }) // すすむ（自動巡航）
const dbg = () => page.evaluate(() => window.__town3dDbg())
const sample = async (x, tag) => {
  await page.mouse.click(220, 430) // 画面に触れて無操作タイマーを更新（オートシネマ抑止）
  await page.evaluate((xx) => window.__town3dFlyPose(xx, 30, -30, Math.PI / 2, -0.08), x)
  await page.waitForTimeout(1500)
  const d = await dbg(); const dEdo = Math.round(Math.hypot(d.x - 340, d.z + 30))
  console.log(`${tag} x=${x} dEdo=${dEdo} vel=${d.vel}`)
}
await sample(150, '遠い  ')
await sample(235, '霞の帯')
await sample(285, '城下  ')
console.log('decel check done')
await browser.close()
