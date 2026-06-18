// 夜景の窓灯りの確認。夜の街が窓灯りで瞬くか（窓辺の俯瞰＋低空の街並み）。
import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE EXCEPTION:', e.message))
page.on('console', (m) => { if (m.type() === 'error') console.log('PAGE ERROR:', m.text()) })
await page.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene && window.__applyScene('kitaterao-window-3d-night'))
await page.waitForTimeout(2400)
await page.addStyleTag({ content: '.ui{display:none !important}' })

// 窓辺の俯瞰（夜の街の灯り）
await page.evaluate(() => window.__town3dWindow(true)); await page.waitForTimeout(900)
await page.evaluate(() => window.__town3dLean(true)); await page.waitForTimeout(1300)
await page.screenshot({ path: 'scripts/_shots/night-0-lean.png' })

// 低空で街並みの窓灯り
await page.evaluate(() => window.__town3dFly(true)); await page.waitForTimeout(400)
await page.evaluate(() => { window.__town3dCruise(false); window.__town3dZoom(1.0); window.__town3dFlyPose(6, 10, -22, 0, -0.2) })
await page.waitForTimeout(700)
await page.screenshot({ path: 'scripts/_shots/night-1-street.png' })

// 高めから夜の街を一望（灯りの広がり）
await page.evaluate(() => { window.__town3dZoom(1.3); window.__town3dFlyPose(0, 40, -6, 0, -0.4) })
await page.waitForTimeout(700)
await page.screenshot({ path: 'scripts/_shots/night-2-wide.png' })

await browser.close()
console.log('night shots done')
