// 拡大した大正: 異人館街・駅・路面電車・倉庫街＋共視界(現代が見えないか)の点検。
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
// 全景（東の海上から島を望む）
await shot(-360, 60, -30, -Math.PI / 2, -0.18, 'taisho-exp-grand')
// 異人館街の丘（tx+52,tz-44 ≈ -438,-74）を望む
await shot(-410, 34, -74, -Math.PI / 2, -0.08, 'taisho-exp-ijinkan')
// 駅・路面電車（tz+30 ≈ z0 の大通り）
await shot(-460, 26, 8, Math.PI, -0.06, 'taisho-exp-tram')
// 共視界: 大正の東端(x≈-380)で東(現代の方向)を向く＝現代が見えてはいけない
await shot(-384, 50, -30, -Math.PI / 2, -0.04, 'taisho-exp-covis')
await b.close()
