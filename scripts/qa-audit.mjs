// アプリ全体の精査: 追加/移動したオブジェクトが埋もれ/浮き/壊れていないか各所を撮影。
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
const shot = async (x, y, z, yaw, pit, name) => { await p.evaluate(([x, y, z, ya, pi]) => window.__town3dFlyPose(x, y, z, ya, pi), [x, y, z, yaw, pit]); await p.waitForTimeout(750); await p.screenshot({ path: `scripts/_shots/${name}.png` }) }
// home: 湾(港/島/大橋/灯台)・砂浜・西岸の新縁・駅・遊園地・副都心・競技場・ヨット
await shot(92, 26, -45, Math.PI / 2, -0.16, 'aud-home-bay')
await shot(60, 18, -36, Math.PI / 2, -0.08, 'aud-home-beach')
await shot(-150, 24, -30, Math.PI / 2, -0.1, 'aud-home-westcoast')
await shot(34, 20, -30, Math.PI, -0.12, 'aud-home-station')
await shot(-26, 22, -50, Math.PI, -0.12, 'aud-home-fun')
await shot(-118, 40, -30, Math.PI, -0.2, 'aud-home-downtown')
await shot(-150, 30, -88, 0, -0.18, 'aud-home-stadium')
await shot(72, 16, 2, 0.7, -0.14, 'aud-home-yacht')
// 大正(x-640): 路面電車・異人館街・駅
await shot(-640, 22, -10, Math.PI, -0.08, 'aud-taisho-tram')
await shot(-588, 30, -74, -Math.PI / 2, -0.08, 'aud-taisho-ijinkan')
// 江戸(x640): 武家屋敷・城
await shot(560, 30, -120, Math.PI / 2, -0.1, 'aud-edo-buke')
// 戦国(z-640): 山寺・城
await shot(110, 26, -648, Math.PI, -0.12, 'aud-sengoku-temple')
// 渡りの海の中間(浮いた島/マーカーが無いか)
await shot(380, 30, -44, Math.PI / 2, -0.06, 'aud-cross-east')
await shot(-400, 30, -30, -Math.PI / 2, -0.06, 'aud-cross-west')
await shot(140, 30, -360, 0, -0.06, 'aud-cross-north')
console.log('audit shots done')
await b.close()
