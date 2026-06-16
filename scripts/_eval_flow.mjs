// 体験フロー一式: ゲート→開始→UI自動消失→情景ギャラリー→選択→見回し→窓/乗り出し→設定→おやすみ
import { chromium } from 'playwright'
const URL = process.env.EVAL_URL || 'https://yuya591-ux.github.io/seasons/?dev=1'
const W = Number(process.env.W || 390), H = Number(process.env.H || 844)
const tag = process.env.TAG || `${W}x${H}`
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, isMobile: W < 700, hasTouch: true })
const page = await ctx.newPage()
const shot = async (name) => { await page.screenshot({ path: `scripts/_shots/flow-${tag}-${name}.png` }); console.log('  shot:', name) }
const errors = []
page.on('pageerror', (e) => errors.push(e.message))

await page.goto(URL, { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)

// 1) ゲート存在と中身
const gateBefore = await page.evaluate(() => {
  const g = document.querySelector('.gate')
  const ui = document.querySelector('.ui')
  return {
    gateVisible: g ? !!(g.offsetWidth||g.offsetHeight) : false,
    gateOpacity: g ? getComputedStyle(g).opacity : null,
    uiPointerEvents: ui ? getComputedStyle(ui).pointerEvents : null,
    uiOpacity: ui ? getComputedStyle(ui).opacity : null,
  }
})
console.log('GATE BEFORE TAP:', JSON.stringify(gateBefore))
await shot('01-gate')

// 2) ゲートをタップして開始（音の立ち上がり計測）
await page.locator('.gate').click()
await page.waitForTimeout(300)
const justAfter = await page.evaluate(() => {
  const g = document.querySelector('.gate')
  return { gateStillThere: !!g, gateVisible: g ? !!(g.offsetWidth||g.offsetHeight) : false, gateOpacity: g ? getComputedStyle(g).opacity : null }
})
console.log('JUST AFTER TAP:', JSON.stringify(justAfter))
await shot('02-after-tap')

// 3) UI自動消失を観察（タップ後 1s, 4s, 7s でUIの可視性）
for (const t of [1000, 3000, 3000]) {
  await page.waitForTimeout(t)
  const uiState = await page.evaluate(() => {
    const ui = document.querySelector('.ui')
    const top = document.querySelector('.ui__top, .topbar, [class*="top"]')
    return {
      uiOpacity: ui ? getComputedStyle(ui).opacity : null,
      uiClasses: ui ? ui.className : null,
      bodyClasses: document.body.className,
    }
  })
  console.log(`UI @+${t}ms:`, JSON.stringify(uiState))
}
await shot('03-idle')

// 4) ポインタを動かしてUIが戻るか
await page.mouse.move(W/2, 100); await page.mouse.move(W/2, 200)
await page.waitForTimeout(400)
const uiWake = await page.evaluate(() => { const ui = document.querySelector('.ui'); return ui ? getComputedStyle(ui).opacity : null })
console.log('UI after move:', uiWake)
await shot('04-ui-wake')

console.log('ERRORS:', JSON.stringify(errors.slice(0,5)))
await browser.close()
