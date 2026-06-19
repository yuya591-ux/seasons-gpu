// 右壁の振り子柱時計を正面気味に確認（夜）。
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
const box = await page.locator('.town3d-stage').boundingBox()
const cx = box.x + box.width / 2, cy = box.y + box.height / 2
const drag = async (dx, dy) => { await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.move(cx + dx, cy + dy, { steps: 18 }); await page.mouse.up(); await page.waitForTimeout(700) }
await drag(205, 30); await page.screenshot({ path: 'scripts/_shots/clock-wall.png' }) // 右壁の振り子柱時計（z=2.4を画面内へ）
await drag(40, 0); await page.screenshot({ path: 'scripts/_shots/clock-wall2.png' })
console.log('clock shots done')
await browser.close()
