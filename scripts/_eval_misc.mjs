import { chromium } from 'playwright'
const URL = 'https://yuya591-ux.github.io/seasons/?dev=1'
const W=390,H=844
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport:{width:W,height:H}, deviceScaleFactor:2, isMobile:true, hasTouch:true })
const page = await ctx.newPage()
const shot=async(n)=>{await page.screenshot({path:`scripts/_shots/misc-${n}.png`});console.log(' shot',n)}
await page.goto(URL,{waitUntil:'networkidle'}); await page.waitForTimeout(1000)
await page.locator('.gate').click(); await page.waitForTimeout(600)

// (A) 音が鳴っているか: AudioContext状態と再生中要素
const audio = await page.evaluate(()=>{
  const out={}
  out.htmlAudio = Array.from(document.querySelectorAll('audio')).map(a=>({src:(a.currentSrc||a.src||'').split('/').pop(),paused:a.paused,vol:a.volume,loop:a.loop,ct:Math.round(a.currentTime*10)/10}))
  return out
})
console.log('AUDIO:', JSON.stringify(audio,null,2))

// (B) ギャラリーをタッチでスクロールして最下端の情景まで到達できるか
await page.locator('button:has-text("情景")').click(); await page.waitForTimeout(500)
const scrollInfo = await page.evaluate(()=>{
  // スクロール可能な要素を探す
  const all=[...document.querySelectorAll('*')].filter(e=>e.scrollHeight>e.clientHeight+20 && /gallery|grid|panel|sheet|scroll/i.test(e.className))
  const el = all[0] || document.querySelector('.gallery')
  if(!el) return 'no-scroll-container'
  const before=el.scrollTop
  el.scrollTop = el.scrollHeight
  const after=el.scrollTop
  return {cls:el.className, scrollHeight:el.scrollHeight, clientHeight:el.clientHeight, movedTo:after, before}
})
console.log('GALLERY SCROLL:', JSON.stringify(scrollInfo))
await page.waitForTimeout(400); await shot('gallery-scrolled')
await page.locator('.gallery .iconbtn, button[aria-label="閉じる"], button:has-text("×")').first().click().catch(()=>{})
await page.waitForTimeout(400)

// (C) 「いま」ボタンの結果（6月=夏）
await page.locator('button:has-text("いま")').first().click(); await page.waitForTimeout(2200)
const nowScene = await page.evaluate(()=> document.querySelector('.scene-name, [class*="scene-name"], [class*="caption"]')?.textContent?.trim() || (window.__currentScene||'?'))
console.log('NOW -> scene caption:', nowScene)
await shot('now-result')

// (D) おやすみ 15分をセットして暗転オーバーレイを確認
await page.locator('button:has-text("設定")').click(); await page.waitForTimeout(400)
await page.locator('button:has-text("15分")').click(); await page.waitForTimeout(400)
await page.locator('.settings .iconbtn, button:has-text("×")').first().click().catch(()=>{})
await page.waitForTimeout(600); await shot('sleep-set')

// (E) FPS 計測（3Dシーン）
await page.evaluate(()=>window.__applyScene('kitaterao-window-3d')); await page.waitForTimeout(1500)
const fps = await page.evaluate(async()=>{
  let frames=0; const t0=performance.now()
  await new Promise(res=>{ function l(){frames++; if(performance.now()-t0<2000) requestAnimationFrame(l); else res()} requestAnimationFrame(l)})
  return Math.round(frames/((performance.now()-t0)/1000))
})
console.log('FPS (3D town):', fps)
await browser.close()
