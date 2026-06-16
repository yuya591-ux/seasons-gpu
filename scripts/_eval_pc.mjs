import { chromium } from 'playwright'
const URL='https://yuya591-ux.github.io/seasons/?dev=1'
// GPUを有効化して起動（headlessでも可能な範囲で）
const browser=await chromium.launch({ args:['--use-gl=angle','--use-angle=swiftshader-webgl','--ignore-gpu-blocklist','--enable-gpu-rasterization'] })

// ---- PC 横長 ----
const pc=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1})
const p1=await pc.newPage()
await p1.goto(URL,{waitUntil:'networkidle'}); await p1.waitForTimeout(1200)
await p1.screenshot({path:'scripts/_shots/pc-gate.png'}); console.log('shot pc-gate')
await p1.locator('.gate').click(); await p1.waitForTimeout(1200)
await p1.screenshot({path:'scripts/_shots/pc-scene.png'}); console.log('shot pc-scene')
// 平面情景をPC横で
await p1.evaluate(()=>window.__applyScene('summer-rain-dusk')); await p1.waitForTimeout(2600)
await p1.screenshot({path:'scripts/_shots/pc-rain-wide.png'}); console.log('shot pc-rain-wide')
await p1.evaluate(()=>window.__applyScene('summer-dusk-seaside')); await p1.waitForTimeout(2600)
await p1.screenshot({path:'scripts/_shots/pc-seaside-wide.png'}); console.log('shot pc-seaside-wide')
// 情景パネルをPCで開く
await p1.mouse.move(700,80); await p1.waitForTimeout(300)
await p1.locator('button:has-text("情景")').click().catch(()=>{}); await p1.waitForTimeout(600)
await p1.screenshot({path:'scripts/_shots/pc-gallery.png'}); console.log('shot pc-gallery')
await p1.close()

// ---- スマホ横（landscape 844x390）----
const ls=await browser.newContext({viewport:{width:844,height:390},deviceScaleFactor:2,isMobile:true,hasTouch:true})
const p2=await ls.newPage()
await p2.goto(URL,{waitUntil:'networkidle'}); await p2.waitForTimeout(1000)
await p2.locator('.gate').click(); await p2.waitForTimeout(1000)
await p2.screenshot({path:'scripts/_shots/ls-scene.png'}); console.log('shot ls-scene')
await p2.evaluate(()=>window.__applyScene('summer-rain-dusk')); await p2.waitForTimeout(2400)
await p2.screenshot({path:'scripts/_shots/ls-rain.png'}); console.log('shot ls-rain')
await p2.close()
await browser.close()
