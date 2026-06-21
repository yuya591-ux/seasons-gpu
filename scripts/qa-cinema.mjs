// オートシネマ修正の確認: ①とまって名所の近く→周回する ②巡航中(移動)→視点が回らない(勝手に切り替わらない)。
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
const dbg = () => page.evaluate(() => window.__town3dDbg())

// ① とまって(cruise=false)江戸の近くで眺める→周回するはず
await page.evaluate(() => { window.__town3dCruise(false) })
await page.evaluate(() => window.__town3dFlyPose(560, 44, -46, Math.PI / 2, -0.12)) // 江戸の近く(x640・近接175以内)
const a0 = await dbg(); await page.waitForTimeout(9000); const a1 = await dbg()
console.log('①とまる×名所近く yaw:', a0.yaw, '→', a1.yaw, 'vel:', a1.vel, '(周回=変化すべき)')

// ② 巡航(cruise=true)で渡りの最中→視点が回らないはず（yawがほぼ不変・cinema出ない）
await page.evaluate(() => { window.__town3dCruise(true) })
await page.evaluate(() => window.__town3dFlyPose(380, 50, -46, Math.PI / 2, -0.05)) // 海の真ん中（全名所から175以上離れる）
const b0 = await dbg(); await page.waitForTimeout(9000); const b1 = await dbg()
console.log('②巡航×渡りの最中 yaw:', b0.yaw, '→', b1.yaw, '(回らない=ほぼ不変のはず)')
await browser.close()
