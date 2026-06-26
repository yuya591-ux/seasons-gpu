import { chromium } from 'playwright'
const PORT = process.env.PORT || 4930
const b = await chromium.launch(); const p = await b.newPage()
await p.goto(`http://localhost:${PORT}/seasons/?dev=1`,{waitUntil:'domcontentloaded',timeout:60000})
await p.locator('.gate').click().catch(()=>{}); await p.waitForTimeout(1200)
await p.evaluate(()=>window.__applyScene('kitaterao-window-3d')).catch(()=>{}); await p.waitForTimeout(2600)
const info = await p.evaluate(()=>{
  const g=window.__town3dGroundAt; if(!g) return 'no hook'
  // SEA.level=-10。各zで、x=64..92を走査し heightAt が -10 を跨ぐ汀のxを求める
  const out=[]
  for(let z=-80; z<=120; z+=10){
    let wl=null, prev=null
    for(let x=62;x<=94;x+=1){ const y=g(x,z); if(prev!==null && prev> -10 && y<=-10){ wl=x-0.5; break } prev=y }
    out.push({z, waterX: wl, yAt70:+g(70,z).toFixed(1)})
  }
  return out
})
console.log(JSON.stringify(info))
await b.close()
