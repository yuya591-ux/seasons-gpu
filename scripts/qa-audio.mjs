import { chromium } from 'playwright'
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] })
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 1 })
const errs = []
page.on('pageerror', (e) => errs.push('pageerror: ' + e.message))
page.on('console', (m) => { if (m.type() === 'error') errs.push('console.error: ' + m.text()) })
await page.goto('http://localhost:4875/seasons/?dev=1', { waitUntil: 'networkidle' })
await page.evaluate(() => document.fonts.ready)
await page.locator('.gate').click().catch(() => {}) // ジェスチャ起点でaudio.start()→風レイヤー
await page.waitForTimeout(900)
const started = await page.evaluate(() => !!(window.__renderer))
// 夜の3D（花火はisNight条件）
await page.evaluate(() => window.__applyScene && window.__applyScene('kitaterao-window-3d-night'))
await page.waitForTimeout(3000)
// 花火・流れ星を強制発火（音＋画面）
await page.evaluate(() => window.__town3dEvent && window.__town3dEvent('fireworks'))
await page.waitForTimeout(1500)
await page.evaluate(() => window.__town3dEvent && window.__town3dEvent('star'))
await page.waitForTimeout(1500)
const audioState = await page.evaluate(() => {
  try { return { hasPlayEvent: typeof window.__renderer === 'object' } } catch (e) { return { err: String(e) } }
})
await page.screenshot({ path: 'scripts/_shots/qa-audio-fw.png' })
console.log('errors:', errs.length ? JSON.stringify(errs.slice(0, 8)) : 'なし')
await browser.close()
