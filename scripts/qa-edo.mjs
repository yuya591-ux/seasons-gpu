// 海を渡って向こう岸の城下町（天守）が霞から現れるか確認。東(+x)へ近づきながら数カット。
import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message))
await page.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(2400)
await page.evaluate(() => { window.__town3dWindow(true) }); await page.waitForTimeout(400)
await page.evaluate(() => { window.__town3dLean(true) }); await page.waitForTimeout(500)
await page.evaluate(() => { window.__town3dFly(true) }); await page.waitForTimeout(800)
await page.evaluate(() => { window.__town3dCruise(false) }); await page.waitForTimeout(200)
const E = Math.PI / 2 // 東(+x)を向く
const shoot = async (x, y, pit, name) => { await page.evaluate(([x, y, e, p]) => window.__town3dFlyPose(x, y, -30, e, p), [x, y, E, pit]); await page.waitForTimeout(800); await page.screenshot({ path: `scripts/_shots/${name}.png` }) }
await shoot(140, 32, -0.05, 'edo-far')   // 渡りの途中＝霞の向こうにうっすら
await shoot(205, 30, -0.08, 'edo-mid')   // 近づく＝天守が立ち上がる
await shoot(250, 28, -0.10, 'edo-near')  // 目前＝城下町まで見える
await shoot(262, 34, -0.18, 'edo-top')   // 上から見下ろし
await shoot(170, 78, -0.42, 'edo-grand')  // 高所から城下町全景
await shoot(172, 24, -0.03, 'edo-veil')   // 霞の帯をくぐる関門（白いベール）
await shoot(150, 19, -0.06, 'edo-crossing')  // 渡りの低空＝帆船・島影
await shoot(196, 21, -0.05, 'edo-crossing2')
// 夜（城下の灯り）
await page.evaluate(() => window.__applyScene('kitaterao-window-3d-night'))
await page.waitForTimeout(2400)
await page.evaluate(() => { window.__town3dWindow(true) }); await page.waitForTimeout(400)
await page.evaluate(() => { window.__town3dLean(true) }); await page.waitForTimeout(500)
await page.evaluate(() => { window.__town3dFly(true) }); await page.waitForTimeout(800)
await page.evaluate(() => { window.__town3dCruise(false) }); await page.waitForTimeout(200)
await shoot(205, 30, -0.08, 'edo-night-mid')
await shoot(250, 28, -0.10, 'edo-night-near')
console.log('edo shots done')
await browser.close()
