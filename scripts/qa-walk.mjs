// 歩行の操作性＋当たり判定の検証: 移動の追従/向き直り/見回しでカメラ360°/路地の通行
import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 960, height: 600 }, deviceScaleFactor: 1.6 })
const errs = []
p.on('pageerror', (e) => errs.push(String(e)))
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()) })
await p.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(() => {})
await p.waitForTimeout(800)
await p.evaluate(() => window.__applyScene('kitaterao-window-3d-sunset'))
await p.waitForTimeout(2600)
const dbg = () => p.evaluate(() => window.__town3dDbg())
// 住宅街の上空へ行き、着地して歩く
await p.evaluate(() => window.__town3dFly(true)); await p.waitForTimeout(700)
await p.evaluate(() => window.__town3dCruise(false))
await p.evaluate(() => window.__town3dFlyPose(-20, 24, -20, 0.2, -0.1)); await p.waitForTimeout(700)
await p.evaluate(() => window.__town3dLand(true)); await p.waitForTimeout(1800)
const d0 = await dbg(); console.log('着地:', JSON.stringify(d0))
// 前進: move(0,1)を数秒。距離が伸びれば「透明の壁で即詰まり」ではない
await p.evaluate(() => window.__town3dMove(0, 1)); await p.waitForTimeout(2600)
const d1 = await dbg()
await p.evaluate(() => window.__town3dMove(0, 0)); await p.waitForTimeout(300)
const dist = Math.hypot(d1.x - d0.x, d1.z - d0.z)
console.log('前進2.6s 後:', JSON.stringify(d1), ' 進んだ距離=', dist.toFixed(1))
await p.screenshot({ path: 'scripts/_shots/walk-fwd.png' })
// 向き直り: カメラ基準で右(move 1,0)を倒すと flyYaw が camYaw+~90°へ素早く向く
const before = await dbg()
await p.evaluate(() => window.__town3dMove(1, 0)); await p.waitForTimeout(500)
const after = await dbg()
console.log('右倒し0.5s: yaw', before.yaw, '→', after.yaw, ' camYaw', before.camYaw, '→', after.camYaw)
await p.evaluate(() => window.__town3dMove(0, 0)); await p.waitForTimeout(200)
// 見回しでカメラを大きく回す（右ドラッグ相当を数回）＝360°向ける
let cam0 = (await dbg()).camYaw
for (let i = 0; i < 6; i++) await p.evaluate(() => window.__town3dLook(0.5, 0))
await p.waitForTimeout(200)
let cam1 = (await dbg()).camYaw
console.log('見回し(右0.5×6): camYaw', cam0, '→', cam1, ' (差=', (cam1 - cam0).toFixed(2), 'rad)')
await p.screenshot({ path: 'scripts/_shots/walk-look.png' })
console.log(errs.length ? 'ERR ' + errs.slice(0, 4).join(' | ') : 'no errors')
await b.close()
