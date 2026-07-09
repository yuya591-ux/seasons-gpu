// スキームA（オート巡航＋ドラッグ操舵）の確認: ①何もしなくても前進 ②上ドラッグ=上昇/下=下降/左右=旋回 ③とまる=ホバリング。
import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE EXCEPTION:', e.message))
page.on('console', (m) => { if (m.type() === 'error') console.log('PAGE ERROR:', m.text()) })
await page.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene && window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(1800)
await page.evaluate(() => window.__town3dWindow(true)); await page.waitForTimeout(1300)
await page.evaluate(() => window.__town3dLean(true)); await page.waitForTimeout(1800)
await page.evaluate(() => window.__town3dFly(true)); await page.waitForTimeout(500)
await page.addStyleTag({ content: '.ui{display:none !important}' })
const dbg = () => page.evaluate(() => window.__town3dDbg())

await page.evaluate(() => window.__town3dFlyPose(0, 30, 10, 0, 0))
await page.waitForTimeout(300)
const a0 = await dbg(); console.log('開始     :', JSON.stringify(a0))

// ① 何もしないで前進（オート巡航）
await page.waitForTimeout(1500)
const a1 = await dbg(); console.log('無操作1.5s:', JSON.stringify(a1), ' Δz=', (a1.z - a0.z).toFixed(1), '（-方向へ自動前進＝OK）')

// ② 上へドラッグ＝上昇（dy負）
await page.evaluate(() => window.__town3dSteer(0, -0.5))
await page.waitForTimeout(1500)
const a2 = await dbg(); console.log('上ドラッグ:', JSON.stringify(a2), ' Δy=', (a2.y - a1.y).toFixed(1), 'pitch=', a2.pitch, '（上昇＝OK）')
await page.evaluate(() => window.__town3dSteer(0, 0)) // ドラッグ終了（pitchはそのまま保持）
await page.evaluate(() => window.__town3dFlyPose(0, 30, -20, 0, 0)) // 水平へ戻す

// ③ 右へドラッグ＝旋回
await page.evaluate(() => window.__town3dSteer(0.4, 0))
await page.waitForTimeout(1000)
const a3 = await dbg(); console.log('右ドラッグ:', 'yaw=', a3.yaw, 'bank=', a3.bank, '（yawが回り旋回＝OK）')

// ④ とまる＝ホバリング（前進0へ）
await page.evaluate(() => window.__town3dSteer(0, 0))
await page.evaluate(() => window.__town3dCruise(false))
const v0 = (await dbg()).vel
await page.waitForTimeout(1500)
const v1 = (await dbg()).vel
console.log('とまる: vel', v0, '→', v1, '（0へ＝ホバリングOK）')

await browser.close()
console.log('schemeA test done')
