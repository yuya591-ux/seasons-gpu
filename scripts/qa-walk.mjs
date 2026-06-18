// 着地して歩く（一人称散策）の確認: 空→おりる→着地→数歩あるく→建物に当たって止まる→また飛ぶ→窓辺へ。
import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const id = process.argv[2] || 'kitaterao-window-3d'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
page.on('console', (m) => { if (m.type() === 'error') console.log('PAGE ERROR:', m.text()) })
page.on('pageerror', (e) => console.log('PAGE EXCEPTION:', e.message))
await page.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate((sid) => window.__applyScene && window.__applyScene(sid), id)
await page.waitForTimeout(1800)
await page.addStyleTag({ content: '.ui{display:none !important}' })

const dbg = () => page.evaluate(() => window.__town3dDbg && window.__town3dDbg())

// 実フロー通りに 窓あけ→乗り出し（枠が消える）→空へ
await page.evaluate(() => window.__town3dWindow(true))
await page.waitForTimeout(1300)
await page.evaluate(() => window.__town3dLean(true))
await page.waitForTimeout(1800)
await page.evaluate(() => window.__town3dFlyToggle(true))
await page.waitForTimeout(800)
await page.evaluate(() => window.__town3dFlyPose(0, 24, -22, 0, -0.2)) // 中央の道の上空
await page.waitForTimeout(300)
await page.evaluate(() => window.__town3dLandToggle(true)) // おりる
await page.waitForTimeout(1800) // 着地のイージング
console.log('着地後:', JSON.stringify(await dbg()))
await page.screenshot({ path: 'scripts/_shots/walk-0-stand.png' })

// 数歩あるく（タップ＝stepを数回）
for (let i = 0; i < 5; i++) { await page.evaluate(() => window.__town3dStep()); await page.waitForTimeout(420) }
await page.waitForTimeout(600)
console.log('5歩前進後:', JSON.stringify(await dbg()))
await page.screenshot({ path: 'scripts/_shots/walk-1-forward.png' })

// 横(+x方向=建物が並ぶ側)を向いて建物へ突き進む→当たって止まる（貫通しない）。mode=walkは保ったまま向きだけ変える。
await page.evaluate(() => { const d = window.__town3dDbg(); window.__town3dFlyPose(d.x, d.y, d.z, Math.PI / 2, -0.05) })
await page.waitForTimeout(400)
const before = await dbg()
await page.evaluate(() => { for (let i = 0; i < 60; i++) window.__town3dStep() }) // たっぷり前進をためて建物へ
await page.waitForTimeout(6000) // 消化（建物で止まるはず＝xが建物手前で頭打ち）
const after = await dbg()
console.log('横向き開始:', JSON.stringify(before))
console.log('建物へ突進後:', JSON.stringify(after))
await page.screenshot({ path: 'scripts/_shots/walk-2-walled.png' })

// また空へ（歩き→飛行）
await page.evaluate(() => window.__town3dLandToggle(false))
await page.waitForTimeout(1600)
console.log('飛び立ち後:', JSON.stringify(await dbg()))
await page.screenshot({ path: 'scripts/_shots/walk-3-takeoff.png' })

// 窓辺へもどる
await page.evaluate(() => window.__town3dFlyToggle(false))
await page.waitForTimeout(2000)
console.log('窓辺へ:', JSON.stringify(await dbg()))
await page.screenshot({ path: 'scripts/_shots/walk-4-window.png' })

await browser.close()
console.log('shot walk states done')
