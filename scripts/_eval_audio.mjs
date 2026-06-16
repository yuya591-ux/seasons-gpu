import { chromium } from 'playwright'
const URL='https://yuya591-ux.github.io/seasons/?dev=1'
const W=390,H=844
const browser=await chromium.launch()
const ctx=await browser.newContext({viewport:{width:W,height:H},deviceScaleFactor:2,isMobile:true,hasTouch:true})
const page=await ctx.newPage()
const shot=async(n)=>{await page.screenshot({path:`scripts/_shots/aud-${n}.png`});console.log(' shot',n)}
// AudioContext を計装
await page.addInitScript(()=>{
  window.__actx=[]
  const OAC=window.AudioContext||window.webkitAudioContext
  if(OAC){ const P=OAC.prototype; window.AudioContext=function(...a){const c=new OAC(...a); window.__actx.push(c); return c} ; window.AudioContext.prototype=P }
})
await page.goto(URL,{waitUntil:'networkidle'}); await page.waitForTimeout(800)
const wake=async()=>{ await page.mouse.move(W/2,80); await page.mouse.move(W/2,120); await page.waitForTimeout(200) }

// 開始前
let s=await page.evaluate(()=>({ctxs:(window.__actx||[]).map(c=>({state:c.state,t:Math.round(c.currentTime*100)/100}))}))
console.log('AUDIO before tap:',JSON.stringify(s))
await page.locator('.gate').click(); await page.waitForTimeout(1500)
s=await page.evaluate(()=>({ctxs:(window.__actx||[]).map(c=>({state:c.state,t:Math.round(c.currentTime*100)/100}))}))
console.log('AUDIO after tap+1.5s:',JSON.stringify(s))
await page.waitForTimeout(2500)
s=await page.evaluate(()=>({ctxs:(window.__actx||[]).map(c=>({state:c.state,t:Math.round(c.currentTime*100)/100}))}))
console.log('AUDIO after +4s:',JSON.stringify(s))

// 音ボタン(♪)でミュート切替→状態
await wake()
await page.locator('button[aria-label="音のオン・オフ"]').click(); await page.waitForTimeout(500)
const muteState=await page.evaluate(()=>document.querySelector('button[aria-label="音のオン・オフ"]')?.textContent)
console.log('after mute toggle, ♪ label:',muteState)

// 「いま」を押す（UIを起こしてから）
await wake()
const nowVisible=await page.locator('button.nowbtn').isVisible()
console.log('nowbtn visible:',nowVisible)
if(nowVisible){ await page.locator('button.nowbtn').click(); await page.waitForTimeout(2200) }
const cap=await page.evaluate(()=>document.querySelector('[class*="scene-name"],[class*="caption"],.scene-fade')?.textContent?.trim()||'')
console.log('NOW caption:',cap)
await shot('now')

// FPS 計測（3D + 平面）
await page.evaluate(()=>window.__applyScene('kitaterao-window-3d')); await page.waitForTimeout(1500)
const fps3d=await page.evaluate(async()=>{let f=0;const t=performance.now();await new Promise(r=>{function l(){f++;performance.now()-t<2000?requestAnimationFrame(l):r()}requestAnimationFrame(l)});return Math.round(f/((performance.now()-t)/1000))})
console.log('FPS 3D town:',fps3d)
await page.evaluate(()=>window.__applyScene('summer-rain-dusk')); await page.waitForTimeout(1800)
const fpsFlat=await page.evaluate(async()=>{let f=0;const t=performance.now();await new Promise(r=>{function l(){f++;performance.now()-t<2000?requestAnimationFrame(l):r()}requestAnimationFrame(l)});return Math.round(f/((performance.now()-t)/1000))})
console.log('FPS flat rain:',fpsFlat)
await browser.close()
