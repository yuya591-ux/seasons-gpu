// 各時代の夜（新拠点）を確認＝灯る窓の密度を点検。home水準の煌めきか。
import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
p.on('pageerror', (e) => console.log('PAGE ERROR', e.message))
await p.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(() => {})
await p.waitForTimeout(700)
await p.evaluate(() => window.__applyScene('kitaterao-window-3d-night'))
await p.waitForTimeout(2600)
await p.evaluate(() => { window.__town3dFly(true) }); await p.waitForTimeout(700)
await p.evaluate(() => { window.__town3dCruise(false) })
const shot = async (x, y, z, yaw, pit, name) => { await p.evaluate(([x, y, z, ya, pi]) => window.__town3dFlyPose(x, y, z, ya, pi), [x, y, z, yaw, pit]); await p.waitForTimeout(800); await p.screenshot({ path: `scripts/_shots/${name}.png` }) }
await shot(560, 34, -46, Math.PI / 2, -0.12, 'night-edo')
await shot(-588, 30, -30, -Math.PI / 2, -0.1, 'night-taisho')
await shot(140, 46, -560, 0, -0.1, 'night-sengoku')
await shot(-60, 38, -56, -Math.PI / 2, -0.12, 'night-home-downtown')
console.log('night era shots done')
await b.close()
