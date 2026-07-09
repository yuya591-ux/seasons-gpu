// 夜の居間の作り込み確認: 招き猫(テレビ台)・観葉植物(窓辺)・灯りの光だまり(床)。夜シーンで撮る。
import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message))
await page.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d-night'))
await page.waitForTimeout(2400)
const box = await page.locator('.town3d-stage').boundingBox()
const cx = box.x + box.width / 2, cy = box.y + box.height / 2
const drag = async (dx, dy) => { await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.move(cx + dx, cy + dy, { steps: 18 }); await page.mouse.up(); await page.waitForTimeout(700) }
await page.screenshot({ path: 'scripts/_shots/detail-center.png' })       // 窓辺＋観葉植物
await drag(320, -120); await page.screenshot({ path: 'scripts/_shots/detail-right.png' }) // 右の壁＝テレビ台の招き猫
await drag(-320, 120); await page.waitForTimeout(200) // 中央へ戻す
await drag(-90, -260); await page.screenshot({ path: 'scripts/_shots/detail-plant.png' }) // 窓辺の床＝観葉植物
console.log('room detail shots done')
await browser.close()
