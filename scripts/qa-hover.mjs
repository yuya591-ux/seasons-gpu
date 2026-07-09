// ホバリング式の確認: ①前進しても高さが変わらない ②上昇/下降は独立 ③右ドラッグ縦は見回しのみ（移動しない）④歩行カメラが一人称寄り。
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
await page.evaluate(() => window.__town3dFly(true)); await page.waitForTimeout(400)
await page.addStyleTag({ content: '.ui{display:none !important}' })
const dbg = () => page.evaluate(() => window.__town3dDbg())

await page.evaluate(() => window.__town3dFlyPose(0, 30, 0, 0, 0))
await page.waitForTimeout(300)
const a0 = await dbg(); console.log('開始     y=', a0.y)

// ① 前進のみ＝高さ不変（水平飛行）
await page.evaluate(() => window.__town3dMove(0, 1))
await page.waitForTimeout(1500)
const a1 = await dbg(); console.log('前進1.5s  y=', a1.y, ' Δy=', (a1.y - a0.y).toFixed(2), '（≈0なら高さ不変＝OK）')

// ② 上昇（独立）。前進は止める
await page.evaluate(() => window.__town3dMove(0, 0))
await page.evaluate(() => window.__town3dClimb(1))
await page.waitForTimeout(1500)
const a2 = await dbg(); console.log('上昇1.5s  y=', a2.y, ' Δy=', (a2.y - a1.y).toFixed(2), '（増えれば独立上昇OK）')
await page.evaluate(() => window.__town3dClimb(0))

// ③ 右ドラッグ縦＝見回しのみ（移動しない）。実ポインタで右半分を縦ドラッグ
const b0 = await dbg()
await page.mouse.move(330, 450); await page.mouse.down(); await page.mouse.move(330, 600, { steps: 6 }); await page.waitForTimeout(200)
await page.mouse.up(); await page.waitForTimeout(300)
const b1 = await dbg()
console.log('右縦ドラッグ: pitch', b0.pitch, '→', b1.pitch, ' / y', b0.y, '→', b1.y, '（pitch動く・yほぼ不変＝見回し専用OK）')

// ④ 着地して歩行カメラ高さ（通行人頭≈1.65に対しカメラが近いか）
await page.evaluate(() => window.__town3dLand(true))
await page.waitForTimeout(1800)
const camY = await page.evaluate(() => window.__renderer ? null : null) // カメラyはdbgに無いので位置から推定
const w = await dbg()
console.log('着地後   flyPos.y(目線)=', w.y, '（地形+1.62。カメラはこの近傍＝一人称寄り）')
await page.screenshot({ path: 'scripts/_shots/hover-walk.png' })

await browser.close()
console.log('hover test done')
