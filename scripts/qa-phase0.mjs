// Phase0検証: 遠ざけた各時代が到達でき、渡りの海が賑やか、共視界が保たれるか。
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
// 各時代が見えるか（中心の手前から）
await shot(640, 50, 70, Math.PI, -0.14, 'p0-edo')
await shot(140, 50, -560, 0, -0.14, 'p0-sengoku')
await shot(-640, 50, 50, Math.PI, -0.14, 'p0-taisho')
// 渡りの海（home東→江戸方向。島/澪標/帆船）
await shot(300, 40, -44, Math.PI / 2, -0.1, 'p0-crossing-east')
// 共視界: home東端(x~150)で東(江戸方向)＝江戸が霧で隠れるはず
await shot(150, 46, -30, Math.PI / 2, -0.05, 'p0-covis-home')
// 共視界: 江戸西端(x~520)で西(home方向)＝homeが霧で隠れるはず
await shot(520, 50, -46, Math.PI / 2, -0.05, 'p0-covis-edo')
console.log('phase0 shots done')
await b.close()
