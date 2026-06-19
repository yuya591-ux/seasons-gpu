// 室内視差の確認: 窓を開けた（乗り出さない）部屋の中の状態で見回すと、窓越しの景色が視差で動くか。
import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message))
await page.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(2300)
await page.evaluate(() => { window.__town3dWindow(true) }) // 窓をあける（部屋の中・乗り出さない）
await page.waitForTimeout(1200)
const stage = await page.locator('.town3d-stage').boundingBox()
const cx = stage.x + stage.width / 2, cy = stage.y + stage.height / 2
// 中央（見回し無し）
await page.screenshot({ path: 'scripts/_shots/room-center.png' })
// 右へ見回す（ドラッグ）＝部屋の中で頭を動かして窓の右側を覗く
await page.mouse.move(cx + 90, cy); await page.mouse.down()
await page.mouse.move(cx - 90, cy, { steps: 12 }); await page.mouse.up()
await page.waitForTimeout(900)
await page.screenshot({ path: 'scripts/_shots/room-look-right.png' })
console.log('room shots done')
await browser.close()
