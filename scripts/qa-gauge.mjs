// 操作ゲージ（寄り引き/速さ/高さ）が、ボタンを押したとき縦バーで現れるか確認。
import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message))
await page.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(2400)
await page.evaluate(() => { window.__town3dFly(true) }); await page.waitForTimeout(900)

// ＋寄るを数回 → ズームのゲージが出るはず
const zoomIn = page.locator('.town3d-zoom__btn').first()
for (let i = 0; i < 3; i++) { await zoomIn.dispatchEvent('pointerdown'); await page.waitForTimeout(120); await zoomIn.dispatchEvent('pointerup') }
await page.waitForTimeout(150)
const gShown = await page.evaluate(() => document.querySelectorAll('.town3d-gauge.gauge--show').length)
console.log('押下直後に表示中のゲージ数:', gShown, '(>=1 期待)')
await page.screenshot({ path: 'scripts/_shots/gauge-zoom.png' })

// 速くを数回 → 速度ゲージ
const spUp = page.locator('.town3d-speed__btn').first()
for (let i = 0; i < 3; i++) { await spUp.dispatchEvent('pointerdown'); await page.waitForTimeout(120); await spUp.dispatchEvent('pointerup') }
await page.waitForTimeout(150)
await page.screenshot({ path: 'scripts/_shots/gauge-speed.png' })

// ↑上昇を長めに押す → 高さゲージ
const climbUp = page.locator('.town3d-climb__btn').first()
await climbUp.dispatchEvent('pointerdown'); await page.waitForTimeout(1200)
await page.screenshot({ path: 'scripts/_shots/gauge-climb.png' })
await climbUp.dispatchEvent('pointerup')

// 押下をやめてしばらく → 自動で消えるはず
await page.waitForTimeout(1800)
const gAfter = await page.evaluate(() => document.querySelectorAll('.town3d-gauge.gauge--show').length)
console.log('放置後に表示中のゲージ数:', gAfter, '(0 期待＝自動で消える)')
await browser.close()
