import { chromium } from 'playwright'
const URL='https://yuya591-ux.github.io/seasons/?dev=1'
const W=390,H=844
const browser=await chromium.launch()
const ctx=await browser.newContext({viewport:{width:W,height:H},deviceScaleFactor:2,isMobile:true,hasTouch:true})
const page=await ctx.newPage()
await page.goto(URL,{waitUntil:'networkidle'}); await page.waitForTimeout(900)
await page.locator('.gate').click(); await page.waitForTimeout(600)
const hint=async()=>page.evaluate(()=>{ const h=[...document.querySelectorAll('*')].find(e=>/なぞって|見回す|傾けて/.test(e.textContent||'')&&(e.textContent||'').length<30&&!e.querySelector('*')); return h?{txt:h.textContent.trim(),vis:!!(h.offsetWidth||h.offsetHeight),op:getComputedStyle(h).opacity}:null })
const winBtn=async()=>page.evaluate(()=>{ const b=document.querySelector('.iconbtn--window'); return b?{vis:!!(b.offsetWidth||b.offsetHeight),disabled:b.disabled,txt:b.textContent.trim()}:null })

// 平面シーン（山あい：明らかに3D見回し不可）を実カードで選択
await page.locator('button:has-text("情景")').click(); await page.waitForTimeout(500)
await page.locator('.scene-card:has-text("夏の朝、山あいの窓")').click(); await page.waitForTimeout(2200)
console.log('FLAT 山あい  hint:', JSON.stringify(await hint()), ' windowBtn:', JSON.stringify(await winBtn()))

// 平面シーン（夏の晴れ真昼：窓枠すら無い）
await page.locator('button:has-text("情景")').click(); await page.waitForTimeout(500)
await page.locator('.scene-card:has-text("夏の晴れ、真昼")').click(); await page.waitForTimeout(2200)
console.log('FLAT 真昼     hint:', JSON.stringify(await hint()), ' windowBtn:', JSON.stringify(await winBtn()))

// 3Dシーンに戻す
await page.locator('button:has-text("情景")').click(); await page.waitForTimeout(500)
await page.locator('.scene-card:has-text("北寺尾の窓辺、立体の街")').first().click(); await page.waitForTimeout(2200)
console.log('3D  北寺尾    hint:', JSON.stringify(await hint()), ' windowBtn:', JSON.stringify(await winBtn()))
await browser.close()
