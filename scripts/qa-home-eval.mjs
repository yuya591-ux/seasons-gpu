// homeを丁寧に評価: 地上の街並み/中景/夕方の窓辺(主役の体験)/夜の窓辺。
import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
p.on('pageerror', (e) => console.log('PAGE ERROR', e.message))
await p.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(() => {})
await p.waitForTimeout(700)
await p.evaluate(() => window.__applyScene('kitaterao-window-3d'))
await p.waitForTimeout(2400)
await p.evaluate(() => { window.__town3dFly(true) }); await p.waitForTimeout(700)
await p.evaluate(() => { window.__town3dCruise(false) })
const shot = async (x, y, z, yaw, pit, name) => { await p.evaluate(([x, y, z, ya, pi]) => window.__town3dFlyPose(x, y, z, ya, pi), [x, y, z, yaw, pit]); await p.waitForTimeout(800); await p.screenshot({ path: `scripts/_shots/${name}.png` }) }
// 地上レベルの街並み（谷の中ほど・低空で見上げ気味）
await shot(-8, 8, -30, Math.PI, 0.02, 'eval-street')
// 中景（谷を見下ろす・展望塔のあたり）
await shot(0, 30, -10, Math.PI, -0.2, 'eval-mid')
await b.close()
