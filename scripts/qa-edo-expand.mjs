// 拡大した江戸: 武家屋敷町・広がった城下＋共視界(現代が見えないか)の点検。EDO中心 x486,z-46。
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
await p.evaluate(() => { window.__town3dFly(true) }); await p.waitForTimeout(700)
await p.evaluate(() => { window.__town3dCruise(false) })
const shot = async (x, y, z, yaw, pit, name) => { await p.evaluate(([x, y, z, ya, pi]) => window.__town3dFlyPose(x, y, z, ya, pi), [x, y, z, yaw, pit]); await p.waitForTimeout(800); await p.screenshot({ path: `scripts/_shots/${name}.png` }) }
// 全景（東の高所から島全体）
await shot(486, 96, 30, Math.PI, -0.5, 'edo-exp-grand')
// 武家屋敷町（SEの外周 a≈5.0-6.0, rr≈100 ≈ x520,z-150付近）を望む
await shot(486, 34, -120, Math.PI / 2, -0.08, 'edo-exp-buke')
// 共視界: 江戸の西端(x≈365)で西(現代の方向)を向く＝現代が見えてはいけない
await shot(366, 50, -46, Math.PI, -0.04, 'edo-exp-covis')
await b.close()
