import { chromium } from 'playwright'
const URL='https://yuya591-ux.github.io/seasons/?dev=1'
const W=390,H=844
const browser=await chromium.launch()
const ctx=await browser.newContext({viewport:{width:W,height:H},deviceScaleFactor:2,isMobile:true,hasTouch:true})
const page=await ctx.newPage()
await page.goto(URL,{waitUntil:'networkidle'}); await page.waitForTimeout(900)
await page.locator('.gate').click(); await page.waitForTimeout(600)

// 指ドラッグをcanvasに合成する関数
const drag=async(a,b,c,d,s=14)=>{ await page.evaluate(([a,b,c,d,s])=>{
  const cv=document.querySelector('canvas'); const fire=(t,x,y)=>{const T=new Touch({identifier:1,target:cv,clientX:x,clientY:y});cv.dispatchEvent(new TouchEvent(t,{bubbles:true,cancelable:true,touches:t==='touchend'?[]:[T],targetTouches:t==='touchend'?[]:[T],changedTouches:[T]}))}
  fire('touchstart',a,b); for(let i=1;i<=s;i++)fire('touchmove',a+(c-a)*i/s,b+(d-b)*i/s); fire('touchend',c,d)
},[a,b,c,d,s]) }
const px=async(name)=>{ // 中央付近のピクセルをサンプリングして差分検出用に返す
  const buf=await page.screenshot(); return {name, hash: buf.length}
}

// (1) 平面シーン: summer-rain-dusk でドラッグ前後の画を比較
await page.evaluate(()=>window.__applyScene('summer-rain-dusk')); await page.waitForTimeout(2500)
await page.screenshot({path:'scripts/_shots/px-flat-before.png'})
await drag(330,420,60,420); await drag(330,500,60,500); await page.waitForTimeout(500)
await page.screenshot({path:'scripts/_shots/px-flat-after.png'})

// (2) 3D town: setViewで0と0.5radの差を確実に出す + ドラッグ感度
await page.evaluate(()=>window.__applyScene('kitaterao-window-3d')); await page.waitForTimeout(1500)
await page.evaluate(()=>window.__town3dSetView(0,0)); await page.waitForTimeout(500)
await page.screenshot({path:'scripts/_shots/px-3d-yaw0.png'})
// 1回の自然なドラッグでどれだけ振れるか
await drag(330,450,60,450,16); await page.waitForTimeout(600)
await page.screenshot({path:'scripts/_shots/px-3d-drag1.png'})
console.log('done')
await browser.close()
