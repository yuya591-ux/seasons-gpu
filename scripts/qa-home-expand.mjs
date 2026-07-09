// home拡張: ①窓辺の眺めが不変か ②南の丘の住宅街 ③西の街区。
import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
p.on('pageerror', (e) => console.log('PAGE ERROR', e.message))
await p.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(() => {})
await p.waitForTimeout(700)
await p.evaluate(() => window.__applyScene('kitaterao-window-3d'))
await p.waitForTimeout(2400)
// ① 窓辺（乗り出し前）の眺め＝不変であるべき
await p.screenshot({ path: 'scripts/_shots/home-window-view.png' })
await p.evaluate(() => { window.__town3dFly(true) }); await p.waitForTimeout(700)
await p.evaluate(() => { window.__town3dCruise(false) })
const shot = async (x, y, z, yaw, pit, name) => { await p.evaluate(([x, y, z, ya, pi]) => window.__town3dFlyPose(x, y, z, ya, pi), [x, y, z, yaw, pit]); await p.waitForTimeout(800); await p.screenshot({ path: `scripts/_shots/${name}.png` }) }
// ② 南の丘の住宅街（z>36 の手前の丘を、谷側から振り返る）
await shot(0, 40, -10, 0, -0.18, 'home-south-hill')
// ③ 西の街区（x<-100 を東から望む）
await shot(-70, 34, -40, -Math.PI / 2, -0.1, 'home-west')
await b.close()
