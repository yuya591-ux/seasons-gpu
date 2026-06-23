import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const b = await chromium.launch({ args:['--autoplay-policy=no-user-gesture-required'] })
const p = await b.newPage()
const errs=[]; p.on('pageerror',e=>errs.push(String(e)))
await p.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(()=>{})
await p.waitForTimeout(1000)
await p.evaluate(()=>window.__applyScene('kitaterao-window-3d-sunset'))
await p.waitForTimeout(4000) // 窓辺で安静
const dbg = await p.evaluate(()=>window.__audio && window.__audio.getDebug && window.__audio.getDebug())
console.log('audio debug (窓辺・安静):', JSON.stringify(dbg))
console.log(errs.length?'ERR '+errs.slice(0,2):'no errors')
await b.close()
