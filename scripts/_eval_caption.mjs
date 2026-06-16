import { chromium } from 'playwright'
const URL='https://yuya591-ux.github.io/seasons/?dev=1'
const W=390,H=844
const browser=await chromium.launch()
const ctx=await browser.newContext({viewport:{width:W,height:H},deviceScaleFactor:2,isMobile:true,hasTouch:true})
const page=await ctx.newPage()
await page.goto(URL,{waitUntil:'networkidle'}); await page.waitForTimeout(900)
await page.locator('.gate').click(); await page.waitForTimeout(600)

const cap=async()=>page.evaluate(()=>{
  // 左下のキャプション要素を探す
  const cands=[...document.querySelectorAll('div,p,span')].filter(e=>/北寺尾|窓辺|角部屋|夏の|秋の|谷戸|海辺|山あい/.test(e.textContent||'')&&(e.textContent||'').length<40&&!e.querySelector('*'))
  return cands.map(e=>({cls:(e.className||'').toString().slice(0,40),txt:e.textContent.trim()})).slice(0,4)
})
// 1) 実際のギャラリーから「夏の雨、夕暮れ」カードを選ぶ
await page.locator('button:has-text("情景")').click(); await page.waitForTimeout(500)
await page.locator('.scene-card:has-text("夏の雨、夕暮れ")').click(); await page.waitForTimeout(2500)
console.log('via CARD 夏の雨夕暮れ -> caption:', JSON.stringify(await cap()))

// 2) フック経由で別シーンに変えてキャプションが追従するか
await page.evaluate(()=>window.__applyScene('summer-dusk-seaside')); await page.waitForTimeout(2000)
console.log('via HOOK seaside -> caption:', JSON.stringify(await cap()))

// 3) 実カードで角部屋
await page.locator('button:has-text("情景")').click().catch(()=>{}); await page.waitForTimeout(500)
await page.locator('.scene-card:has-text("夏の朝、山あいの窓")').click().catch(()=>{}); await page.waitForTimeout(2200)
console.log('via CARD 山あい -> caption:', JSON.stringify(await cap()))
await browser.close()
