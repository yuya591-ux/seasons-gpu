// 3Dの室内を見渡せるか確認: 中央(窓)・大きく右へ(側壁/棚)・見上げ(天井/照明)・見下ろし(床/卓)。
import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message))
await page.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(2300)
await page.evaluate(() => { window.__town3dWindow(true) })
await page.waitForTimeout(1100)
const box = await page.locator('.town3d-stage').boundingBox()
const cx = box.x + box.width / 2, cy = box.y + box.height / 2
const drag = async (dx, dy) => { await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.move(cx + dx, cy + dy, { steps: 18 }); await page.mouse.up(); await page.waitForTimeout(800) }
await page.screenshot({ path: 'scripts/_shots/room2-closed-center.png' })
await drag(-330, 0); await page.screenshot({ path: 'scripts/_shots/room2-look-right.png' }) // 指を左へ大きく＝右を向く…いや横は素直: 指右で右。室内右を見るには指を左へ引く向きに依存
await drag(660, 0); await page.screenshot({ path: 'scripts/_shots/room2-look-left.png' })
await drag(-330, 0); await page.waitForTimeout(300) // 中央へ
await drag(0, 300); await page.screenshot({ path: 'scripts/_shots/room2-look-up.png' })
await drag(0, -560); await page.screenshot({ path: 'scripts/_shots/room2-look-down.png' })
console.log('room look-around shots done')
await browser.close()
