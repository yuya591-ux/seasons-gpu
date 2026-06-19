// 家具が見える角度で確認（ちゃぶ台/テレビ＝右下、床の間=左、襖/神棚=振り返り）。
import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message))
await page.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
const scene = process.argv[2] || 'kitaterao-window-3d'
await page.evaluate((s) => window.__applyScene(s), scene)
await page.waitForTimeout(2300)
await page.evaluate(() => { window.__town3dWindow(true) })
await page.waitForTimeout(1100)
const b = await page.locator('.town3d-stage').boundingBox()
const cx = b.x + b.width / 2, cy = b.y + b.height / 2
const drag = async (dx, dy) => { await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.move(cx + dx, cy + dy, { steps: 16 }); await page.mouse.up(); await page.waitForTimeout(700) }
await drag(150, -120); await page.screenshot({ path: 'scripts/_shots/furn-right-down.png' }) // 右下＝ちゃぶ台・テレビ
await drag(-150, 120); await page.waitForTimeout(200)
await drag(-180, -90); await page.screenshot({ path: 'scripts/_shots/furn-left.png' }) // 左＝床の間・茶箪笥
console.log('furn shots done', scene)
await browser.close()
