// 見回し/窓/乗り出し/ギャラリー/設定 を実操作して撮影
import { chromium } from 'playwright'
const URL = process.env.EVAL_URL || 'https://yuya591-ux.github.io/seasons/?dev=1'
const W = 390, H = 844
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
const page = await ctx.newPage()
const shot = async (n) => { await page.screenshot({ path: `scripts/_shots/int-${n}.png` }); console.log('  shot:', n) }
const errors = []; page.on('pageerror', (e) => errors.push(e.message))
await page.goto(URL, { waitUntil: 'networkidle' })
await page.waitForTimeout(1200)
await page.locator('.gate').click()
await page.waitForTimeout(800)

// --- 見回し: スワイプ（タッチ）で左右に振る ---
const sw = async (x1,y1,x2,y2,steps=12) => {
  await page.touchscreen.tap(x1,y1).catch(()=>{})
  await page.evaluate(([a,b,c,d,s])=>{
    const cv = document.querySelector('canvas.town3d, canvas') || document.body
    const fire=(type,x,y)=>{const t=new Touch({identifier:1,target:cv,clientX:x,clientY:y});cv.dispatchEvent(new TouchEvent(type,{bubbles:true,cancelable:true,touches:type==='touchend'?[]:[t],targetTouches:type==='touchend'?[]:[t],changedTouches:[t]}))}
    fire('touchstart',a,b)
    for(let i=1;i<=s;i++){const x=a+(c-a)*i/s,y=b+(d-b)*i/s;fire('touchmove',x,y)}
    fire('touchend',c,d)
  },[x1,y1,x2,y2,steps])
}
// 右へ見回す（指を左へ払う）
await sw(300,420,90,420); await page.waitForTimeout(700); await shot('01-look-right')
// 左へ見回す
await sw(90,420,300,420); await sw(90,420,300,420); await page.waitForTimeout(700); await shot('02-look-left')
// setViewフックで真横と見上げ/見下げ
await page.evaluate(()=>window.__town3dSetView && window.__town3dSetView(1.2, 0.0)); await page.waitForTimeout(600); await shot('03-view-yaw')
await page.evaluate(()=>window.__town3dSetView && window.__town3dSetView(0.0, -0.6)); await page.waitForTimeout(600); await shot('04-view-down')
await page.evaluate(()=>window.__town3dSetView && window.__town3dSetView(0.0, 0.6)); await page.waitForTimeout(600); await shot('05-view-up')

// --- 窓をあける ---
await page.evaluate(()=>window.__town3dSetView && window.__town3dSetView(0,0)); await page.waitForTimeout(300)
await page.evaluate(()=>window.__town3dWindow && window.__town3dWindow(true)); await page.waitForTimeout(1400); await shot('06-window-open')
// --- 乗り出す ---
await page.evaluate(()=>window.__town3dLean && window.__town3dLean(true)); await page.waitForTimeout(1400); await shot('07-lean-out')
await page.evaluate(()=>{window.__town3dLean(false);window.__town3dWindow(false)}); await page.waitForTimeout(1000)

// --- 情景ギャラリーを開く ---
await page.getByRole('button', { name: '情景' }).click().catch(async()=>{ await page.locator('button:has-text("情景")').click() })
await page.waitForTimeout(700); await shot('08-gallery')
// ギャラリーのスクロール下端
await page.mouse.wheel(0, 1200); await page.waitForTimeout(500); await shot('09-gallery-bottom')

// 平面シェーダー情景（夏の雨夕方）を選ぶ
await page.evaluate(()=>window.__applyScene && window.__applyScene('summer-rain-dusk')); await page.waitForTimeout(2600); await shot('10-summer-rain-dusk')
await page.evaluate(()=>window.__applyScene && window.__applyScene('summer-clear-noon')); await page.waitForTimeout(2600); await shot('11-summer-noon')
await page.evaluate(()=>window.__applyScene && window.__applyScene('summer-dusk-seaside')); await page.waitForTimeout(2600); await shot('12-seaside')

console.log('ERRORS:', JSON.stringify(errors.slice(0,8)))
await browser.close()
