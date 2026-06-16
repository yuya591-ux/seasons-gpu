// 平面シェーダー情景をフルスクリーンで撮る + カードタップの実挙動 + 設定/おやすみ
import { chromium } from 'playwright'
const URL = process.env.EVAL_URL || 'https://yuya591-ux.github.io/seasons/?dev=1'
const W = 390, H = 844
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
const page = await ctx.newPage()
const shot = async (n) => { await page.screenshot({ path: `scripts/_shots/flat-${n}.png` }); console.log('  shot:', n) }
const errors = []; page.on('pageerror', (e) => errors.push(e.message))
await page.goto(URL, { waitUntil: 'networkidle' }); await page.waitForTimeout(1000)
await page.locator('.gate').click(); await page.waitForTimeout(600)

// 平面情景をフックで設定し、UIをCSSで隠して純粋な絵を撮る
const flats = ['summer-rain-dusk','summer-rain-night','summer-clear-noon','summer-dusk-downtown','winter-snow-night-downtown','summer-morning-mountains','summer-dusk-seaside']
await page.addStyleTag({ content: '.ui{opacity:0 !important}' })
for (const id of flats) {
  await page.evaluate((s)=>window.__applyScene(s), id)
  await page.waitForTimeout(2800)
  await shot('scene-'+id)
}
await page.evaluate(()=>{ document.querySelectorAll('style').forEach(s=>{ if(s.textContent.includes('.ui{opacity:0')) s.remove() }) })

// --- カードタップの実挙動: ギャラリーを開いて1枚タップ→閉じてシーンへ ---
await page.evaluate(()=>window.__applyScene('kitaterao-window-3d')); await page.waitForTimeout(1500)
await page.locator('button:has-text("情景")').click(); await page.waitForTimeout(600)
const cards = page.locator('.scene-card')
const n = await cards.count(); console.log('scene-card count:', n)
// 4枚目あたり(秋の角部屋)をタップ
await cards.nth(7).click(); await page.waitForTimeout(2600)
const galleryGone = await page.evaluate(()=>{ const g=document.querySelector('.gallery, [class*="gallery"]'); return g? getComputedStyle(g).opacity+'/'+getComputedStyle(g).display : 'no-gallery-el' })
console.log('gallery state after card tap:', galleryGone)
await shot('after-cardtap')

// --- 設定パネル ---
await page.locator('button:has-text("設定")').click(); await page.waitForTimeout(600); await shot('settings')

// --- おやすみ（あれば） ---
const sleepBtn = await page.locator('button:has-text("おやすみ"), button:has-text("やすむ"), [class*="sleep"]').count()
console.log('sleep buttons found:', sleepBtn)

// --- いま ボタン ---
await page.locator('button:has-text("設定")').click().catch(()=>{}) ; await page.waitForTimeout(300)
await page.locator('button:has-text("いま")').first().click().catch(()=>{}); await page.waitForTimeout(2200); await shot('now')

console.log('ERRORS:', JSON.stringify(errors.slice(0,8)))
await browser.close()
