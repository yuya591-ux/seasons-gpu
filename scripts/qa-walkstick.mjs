// 歩行操作の検証: 左スティックがカメラを振り回さないこと（横・後ろ移動でカメラ不動／前進のみ緩やかに背後へ）
import { chromium } from 'playwright'
const port = process.env.PORT || '4890'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE EXCEPTION:', e.message))
await page.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene && window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(1800)
await page.evaluate(() => window.__town3dWindow(true)); await page.waitForTimeout(900)
await page.evaluate(() => window.__town3dLean(true)); await page.waitForTimeout(1200)
await page.evaluate(() => window.__town3dFly(true)); await page.waitForTimeout(400)
await page.evaluate(() => window.__town3dCruise(false))
await page.evaluate(() => window.__town3dFlyPose(0, 20, 0, 0, 0))
await page.waitForTimeout(300)
await page.evaluate(() => window.__town3dLand(true)) // 着地して歩行モードへ
await page.waitForTimeout(2200)

const dbg = () => page.evaluate(() => { const d = window.__town3dDbg(); return { mode: d.mode, camYaw: d.camYaw, yaw: d.yaw } })
const deg = (r) => (r * 180 / Math.PI).toFixed(1)
const trial = async (name, mx, my, ms) => {
  const a = await dbg()
  await page.evaluate(([x, y]) => window.__town3dMove(x, y), [mx, my])
  await page.waitForTimeout(ms)
  await page.evaluate(() => window.__town3dMove(0, 0))
  const b = await dbg()
  let d = b.camYaw - a.camYaw; d = Math.atan2(Math.sin(d), Math.cos(d))
  console.log(`${name}: カメラ回転=${deg(d)}° (mode=${b.mode} 進行yaw ${deg(a.yaw)}→${deg(b.yaw)})`)
  await page.waitForTimeout(400)
  return d
}
const m0 = await dbg(); console.log('開始モード:', m0.mode)
const dR = await trial('右へ全倒し1.5s', 1, 0, 1500)
const dB = await trial('後ろへ全倒し1.5s', 0, -1, 1500)
const dF = await trial('前へ全倒し2.0s', 0, 1, 2000)
const dD = await trial('斜め右前(45°)1.5s', 0.7, 0.7, 1500)
console.log(`判定: 横=${Math.abs(dR) < 0.02 ? 'OK(不動)' : 'NG'} 後ろ=${Math.abs(dB) < 0.02 ? 'OK(不動)' : 'NG'} 斜め=${Math.abs(dD) < 0.45 ? 'OK(緩やか)' : 'NG(速すぎ)'}`)
await browser.close()
console.log('qa-walkstick done')
