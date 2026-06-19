// 室内＝窓越しの手応えの確認: 部屋の中（窓を閉/開）で見回すと、手前の窓枠が景色の上をすべり、
// 周辺が薄暗くなって「部屋から窓を覗く」明暗・視差になるか。
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
const box = await page.locator('.town3d-stage').boundingBox()
const cx = box.x + box.width / 2, cy = box.y + box.height / 2
const drag = async (dx, dy) => { await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.move(cx + dx, cy + dy, { steps: 14 }); await page.mouse.up(); await page.waitForTimeout(800) }
// 窓を閉じたまま部屋の中（既定）。中央。
await page.waitForTimeout(400)
await page.screenshot({ path: 'scripts/_shots/room2-closed-center.png' })
// 右へ見回す（指を右へ＝右を向く＝今回の修正後の向き）
await drag(150, 0)
await page.screenshot({ path: 'scripts/_shots/room2-closed-right.png' })
// 戻して上を見上げる（指を下へ＝見上げる）
await page.evaluate(() => window.__town3dApplyLookReset && window.__town3dApplyLookReset())
await drag(-150, 0) // 中央へ戻す
await drag(0, 160)  // 指を下へ＝見上げる
await page.screenshot({ path: 'scripts/_shots/room2-closed-up.png' })
console.log('room2 shots done')
await browser.close()
