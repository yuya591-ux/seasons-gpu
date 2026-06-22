// 雲上の回遊群島＝空から眺める→着地→吊り橋を歩いて渡る の検証
import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 920, height: 560 }, deviceScaleFactor: 2 })
const errs = []
p.on('pageerror', (e) => errs.push(String(e)))
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()) })
await p.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(() => {})
await p.waitForTimeout(700)
await p.evaluate(() => window.__applyScene('kitaterao-window-3d'))
await p.waitForTimeout(2400)
await p.evaluate(() => window.__town3dFly(true)); await p.waitForTimeout(700)
await p.evaluate(() => window.__town3dCruise(false))

// (A) 空から回遊群島を望む（中心の東屋・茶屋・見晴らし・祠＋吊り橋）
await p.evaluate(() => window.__town3dFlyPose(-12, 128, -228, 0, -0.5)); await p.waitForTimeout(1100)
await p.screenshot({ path: 'scripts/_shots/rest-1-air.png' })

// (B) 中心の広場に着地（中心ぴったりに降りて橋の中心線へ）
await p.evaluate(() => window.__town3dFlyPose(-20, 120, -290, 0, -0.02)); await p.waitForTimeout(500)
await p.evaluate(() => window.__town3dLand(true)); await p.waitForTimeout(1900)
const land = await p.evaluate(() => window.__town3dDbg())

// (C) 茶屋(40,-298)へ向き、吊り橋を歩いて渡る（橋の半ば）
await p.evaluate(() => window.__town3dFaceWalk(1.44)); await p.waitForTimeout(150)
await p.evaluate(() => window.__town3dMove(0, 1)); await p.waitForTimeout(7000)
const mid = await p.evaluate(() => window.__town3dDbg())
await p.screenshot({ path: 'scripts/_shots/rest-2-bridge.png' })

// (D) 渡り切って茶屋の島へ
await p.waitForTimeout(8000); await p.evaluate(() => window.__town3dMove(0, 0))
await p.waitForTimeout(400)
const end = await p.evaluate(() => window.__town3dDbg())
await p.screenshot({ path: 'scripts/_shots/rest-3-teahouse.png' })

console.log('LAND:', JSON.stringify(land))
console.log('MID :', JSON.stringify(mid))
console.log('END :', JSON.stringify(end))
console.log(errs.length ? 'ERR ' + errs.slice(0, 4).join(' | ') : 'no errors')
await b.close()
