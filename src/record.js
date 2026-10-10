import { chromium } from 'playwright';
import { mkdir, writeFile, chmod } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { duration } from './process.js';
import { addCue, frameBox, wide } from './camera.js';

export async function record(plan, output, {headed=false,state}={}) {
  const dir=resolve(output);
  // Refuse reuse: a failed recording must never inherit an old successful manifest.
  await mkdir(dir,{recursive:false,mode:0o700});
  await chmod(dir,0o700);
  const audioDurations = new Map();
  for (const s of [...plan.prepare,...plan.steps]) if(s.audio) audioDurations.set(s.audio,await duration(s.audio));
  const browser=await chromium.launch({headless:!headed});
  let context, page, video;
  const manifest={version:1,status:'recording',viewport:plan.viewport,cues:[],audio:[],steps:[],duration:0};
  let start=0, pointer={x:30,y:30};
  const now=()=> (Date.now()-start)/1000;
  async function locate(selector) {
    const item=page.locator(selector);
    await item.waitFor({state:'visible'});
    if(await item.count()!==1) throw new Error(`Target must match exactly one visible element: ${selector}`);
    return item;
  }
  async function position(item) {
    await item.evaluate(el=>{const r=el.getBoundingClientRect(); const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);if(r.top<20||r.left<0||r.bottom>innerHeight-20||r.right>innerWidth||!(hit===el||el.contains(hit)))el.scrollIntoView({block:'center',inline:'center',behavior:'instant'});});
    await item.evaluate(async()=>{await document.fonts.ready; await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
    let previous=null;
    for(let i=0;i<30;i++) {
      const box=await item.boundingBox();
      if(box && previous && ['x','y','width','height'].every(k=>Math.abs(box[k]-previous[k])<.5)) return box;
      previous=box; await page.waitForTimeout(50);
    }
    throw new Error('Target did not settle; stop animations or use a stable container');
  }
  async function glide(box) {
    const destination={x:box.x+box.width/2,y:box.y+box.height/2};
    for(let i=1;i<=18;i++) {
      const t=i/18, eased=t*t*(3-2*t);
      await page.mouse.move(pointer.x+(destination.x-pointer.x)*eased,pointer.y+(destination.y-pointer.y)*eased);
      await page.waitForTimeout(16);
    }
    pointer=destination;
  }
  async function assertTarget(condition) {
    const el=await locate(condition.target);
    if(condition.text!==undefined) await el.filter({hasText:condition.text}).waitFor({state:'visible'});
    return el;
  }
  async function step(s, filming) {
    const began=filming?now():0;
    const item=s.target?await locate(s.target):null;
    let box;
    if(item && s.action!=='wait') {
      const willScroll=await item.evaluate(el=>{const r=el.getBoundingClientRect();const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return r.top<20||r.left<0||r.bottom>innerHeight-20||r.right>innerWidth||!(hit===el||el.contains(hit));});
      if(filming&&willScroll) {addCue(manifest.cues,now(),wide,.25);await page.waitForTimeout(260);}
      box=await position(item);
    }
    const cam=s.camera ?? (['click','type','focus'].includes(s.action)?{target:s.target,padding:70,maxZoom:1.8,durationMs:650}:undefined);
    if(filming && cam) {
      if(cam==='wide') addCue(manifest.cues,now(),wide,.65);
      else {
        const frame=await locate(cam.target);
        // Framing must not scroll the action target away: measure, never scroll here.
        const region=await frame.boundingBox();
        if(!region || region.x<-.5 || region.y<-.5 || region.x+region.width>plan.viewport.width+.5 || region.y+region.height>plan.viewport.height+.5) throw new Error(`Camera region is not fully visible: ${cam.target}. Use a smaller region or an explicit scroll step.`);
        addCue(manifest.cues,now(),frameBox(region,plan.viewport,cam.padding,cam.maxZoom),cam.durationMs/1000);
      }
      await page.waitForTimeout(cam==='wide'?650:cam.durationMs);
    }
    const actionAt=filming?now():0;
    if(filming && s.audio) manifest.audio.push({file:s.audio,at:actionAt,duration:audioDurations.get(s.audio)});
    switch(s.action) {
      case 'click':
        // Playwright's actionability check rejects sticky-header overlays.
        await item.click({trial:true});
        box=await item.boundingBox();
        await glide(box); await item.click({position:{x:box.width/2,y:box.height/2}}); break;
      case 'type':
        await item.click({trial:true}); await glide(box); await item.fill(''); await item.pressSequentially(s.text,{delay:s.delayMs}); break;
      case 'press': await page.keyboard.press(s.key); break;
      case 'focus': await glide(box); break;
      case 'wait': await assertTarget(s); break;
      case 'scroll': break;
      case 'pause': break;
    }
    if(s.expect) await assertTarget(s.expect);
    const remaining=filming&&s.audio ? (audioDurations.get(s.audio)-(now()-actionAt))*1000+180 : 0;
    await page.waitForTimeout(Math.max(s.holdMs,remaining));
    if(filming) {
      const index=manifest.steps.length;
      await page.screenshot({path:join(dir,`step-${String(index+1).padStart(2,'0')}.png`)});
      manifest.steps.push({index,action:s.action,label:s.label??s.action,at:began,actionAt,end:now()});
    }
  }
  try {
    context=await browser.newContext({viewport:plan.viewport,deviceScaleFactor:1,storageState:state,recordVideo:{dir:join(dir,'capture'),size:plan.viewport}});
    context.setDefaultTimeout(plan.timeoutMs);
    await context.addInitScript(()=>{
      addEventListener('DOMContentLoaded',()=>{
        const host=document.createElement('div'); host.setAttribute('data-browser-director','cursor');
        host.style.cssText='position:fixed;left:0;top:0;z-index:2147483646;pointer-events:none;transform:translate(30px,30px)';
        const root=host.attachShadow({mode:'closed'});
        root.innerHTML='<svg width="28" height="34" viewBox="0 0 28 34" style="filter:drop-shadow(0 2px 2px #0006)"><path d="M3 2L3 27L9 21L14 31L19 28L14 19L24 18Z" fill="white" stroke="#172338" stroke-width="2"/></svg>';
        document.documentElement.append(host);
        addEventListener('mousemove',e=>host.style.transform=`translate(${e.clientX}px,${e.clientY}px)`);
        addEventListener('mousedown',()=>root.querySelector('path').setAttribute('fill','#80d8ff'));
        addEventListener('mouseup',()=>root.querySelector('path').setAttribute('fill','white'));
      });
    });
    page=await context.newPage(); video=page.video();
    await page.goto(plan.url,{waitUntil:'domcontentloaded'});
    if(plan.ready) await locate(plan.ready);
    await page.evaluate(async()=>{await document.fonts.ready;scrollTo({top:0,left:0,behavior:'instant'});});
    for(const s of plan.prepare) await step(s,false);
    // Full-frame sync marker calibrates Playwright video startup and preparation.
    await page.evaluate(()=>{const m=document.createElement('div');m.id='browser-director-sync';m.style.cssText='position:fixed;inset:0;background:#ff00ff;z-index:2147483647';document.documentElement.append(m);});
    await page.waitForTimeout(360);
    start=await page.evaluate(()=>{document.getElementById('browser-director-sync').remove();return Date.now();});
    await page.waitForTimeout(200);
    for(let i=0;i<plan.steps.length;i++) {process.stderr.write(`  ${i+1}/${plan.steps.length} ${plan.steps[i].label??plan.steps[i].action}\n`);await step(plan.steps[i],true);}
    addCue(manifest.cues,now(),wide,.65);
    await page.waitForTimeout(plan.tailMs);
    manifest.duration=now(); manifest.status='complete';
  } catch(error) {
    manifest.status='failed'; manifest.error=error.message;
    if(page&&!page.isClosed()) await page.screenshot({path:join(dir,'failure.png')}).catch(()=>{});
    throw error;
  } finally {
    await context?.close();
    if(video) manifest.video=await video.path();
    await browser.close();
    await writeFile(join(dir,'recording.json'),JSON.stringify(manifest,null,2)+'\n',{mode:0o600});
  }
  return join(dir,'recording.json');
}
