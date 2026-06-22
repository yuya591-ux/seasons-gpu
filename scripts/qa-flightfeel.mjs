// 夢の浮遊感の検証: 上昇気流(サーマル)でふわっと昇るか／突風で位置が暴れないか／風音連動
import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 480, height: 880 }, deviceScaleFactor: 2 })
const errs = []
p.on('pageerror', (e) => errs.push(String(e)))
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()) })
await p.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(() => {})
await p.waitForTimeout(700)
await p.evaluate(() => window.__applyScene('kitaterao-window-3d'))
await p.waitForTimeout(2400)
await p.evaluate(() => window.__town3dFly(true)); await p.waitForTimeout(600)
await p.evaluate(() => window.__town3dCruise(true)) // 巡航ON＝サーマルが効く

// サーマル上（くつろぎ群島 -20,-290 r46）の中心で巡航し、y が上がるか
await p.evaluate(() => window.__town3dFlyPose(-20, 42, -290, 0, 0)); await p.waitForTimeout(500)
const y0 = (await p.evaluate(() => window.__town3dDbg())).y
await p.waitForTimeout(3000)
const y1 = (await p.evaluate(() => window.__town3dDbg())).y

// サーマル外（街から離れた海上 400,-? ）では昇らない確認＝x=400,z=-46（江戸寄り・THERMAL無し）
await p.evaluate(() => window.__town3dFlyPose(400, 42, -46, 0, 0)); await p.waitForTimeout(500)
const z0 = (await p.evaluate(() => window.__town3dDbg())).y
await p.waitForTimeout(3000)
const z1 = (await p.evaluate(() => window.__town3dDbg())).y

// 突風安定性: 10秒間 位置をサンプルし、急なジャンプ(>20u/サンプル)が無いか
await p.evaluate(() => window.__town3dFlyPose(0, 60, -40, 0, 0)); await p.waitForTimeout(300)
let prev = await p.evaluate(() => window.__town3dDbg()); let maxJump = 0
for (let i = 0; i < 20; i++) { await p.waitForTimeout(500); const d = await p.evaluate(() => window.__town3dDbg()); maxJump = Math.max(maxJump, Math.hypot(d.x - prev.x, d.y - prev.y, d.z - prev.z)); prev = d }

console.log(`THERMAL(群島): y ${y0.toFixed(1)} -> ${y1.toFixed(1)} (Δ${(y1 - y0).toFixed(1)} ＝昇るはず)`)
console.log(`NO-THERMAL(海上): y ${z0.toFixed(1)} -> ${z1.toFixed(1)} (Δ${(z1 - z0).toFixed(1)} ＝ほぼ0のはず)`)
console.log(`GUST 最大サンプル間移動: ${maxJump.toFixed(1)}u (暴れず巡航相応なら可)`)
console.log(errs.length ? 'ERR ' + errs.slice(0, 4).join(' | ') : 'no errors')
await b.close()
