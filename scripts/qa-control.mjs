// 白猫式ポイント＆ゴーの確認: 左スティック横で「進路が向き直る（旋回）」＝カニ歩きでない、カメラ追従。
import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
page.on('console', (m) => { if (m.type() === 'error') console.log('PAGE ERROR:', m.text()) })
page.on('pageerror', (e) => console.log('PAGE EXCEPTION:', e.message))
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

await page.evaluate(() => window.__town3dFlyPose(0, 28, 0, 0, -0.05))
await page.waitForTimeout(300)
const a0 = await dbg(); console.log('開始     :', JSON.stringify(a0))

// 前進のみ（旋回なし）＝進路(yaw)はほぼ不変、まっすぐ進む
await page.evaluate(() => window.__town3dMove(0, 1))
await page.waitForTimeout(1200)
const a1 = await dbg(); console.log('前進のみ :', JSON.stringify(a1), ' yaw変化=', (a1.yaw - a0.yaw).toFixed(2))
await page.screenshot({ path: 'scripts/_shots/ctrl-0-fwd.png' })

// 右へ倒す（前進＋旋回）＝進路(yaw)が回り、カメラも追従して景色が回る（カニ歩きでない）
await page.evaluate(() => window.__town3dMove(0.85, 0.5))
await page.waitForTimeout(1600)
const a2 = await dbg(); console.log('右へ旋回 :', JSON.stringify(a2), ' yaw変化=', (a2.yaw - a1.yaw).toFixed(2), 'bank=', a2.bank)
await page.screenshot({ path: 'scripts/_shots/ctrl-1-turnright.png' })

// 離す＝惰性で停止
await page.evaluate(() => window.__town3dMove(0, 0))
const v0 = (await dbg()).vel
await page.waitForTimeout(1400)
const v1 = (await dbg()).vel
console.log('離した後 vel:', v0, '→', v1)

// 右側を横ドラッグ＝見回しオフセット（進路は変えない）。実ポインタで右半分をドラッグ。
const y0 = (await dbg()).yaw
await page.mouse.move(330, 500); await page.mouse.down(); await page.mouse.move(250, 500, { steps: 5 }); await page.waitForTimeout(200)
const yLook = (await dbg()).yaw
await page.mouse.up(); await page.waitForTimeout(800)
const yBack = (await dbg()).yaw
console.log('見回し: 進路yaw', y0.toFixed(2), '→ドラッグ中', yLook.toFixed(2), '→離して', yBack.toFixed(2), '（進路は不変＝見回しは別管理）')

await browser.close()
console.log('control shots done')
