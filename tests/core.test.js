import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { planSchema,loadPlan } from '../src/plan.js';
import { frameBox,addCue,poseAt,wide } from '../src/camera.js';
import { installSkill } from '../src/skills.js';

test('camera contains the full target and padding without escaping viewport',()=>{
  const viewport={width:1440,height:900};
  for(const box of [{x:0,y:0,width:100,height:100},{x:1240,y:750,width:200,height:150},{x:100,y:50,width:1200,height:800},{x:500,y:300,width:200,height:100}]) {
    const p=frameBox(box,viewport);
    assert.ok(p.x>=0&&p.y>=0);
    assert.ok(p.x<=box.x&&p.y<=box.y);
    assert.ok(p.x+viewport.width/p.zoom>=box.x+box.width-1e-6);
    assert.ok(p.y+viewport.height/p.zoom>=box.y+box.height-1e-6);
    assert.ok(p.x+viewport.width/p.zoom<=viewport.width+1e-6);
  }
});
test('camera remains continuous when a new cue interrupts a transition',()=>{
  const cues=[];addCue(cues,1,{zoom:2,x:200,y:100},1);
  const halfway=poseAt(cues,1.5);addCue(cues,1.5,wide,.5);
  assert.deepEqual(poseAt(cues,1.5),halfway);assert.deepEqual(poseAt(cues,2),wide);
  assert.deepEqual(poseAt(cues,0),wide);
});
test('strict plans reject misspellings and unsupported actions before browser launch',()=>{
  const plan={version:1,url:'https://example.org',steps:[{action:'click',target:'#a'}]};
  assert.equal(planSchema.parse(plan).steps[0].holdMs,1200);
  assert.throws(()=>planSchema.parse({...plan,steps:[{action:'click',target:'#a',hold:2000}]}));
  assert.throws(()=>planSchema.parse({...plan,steps:[{action:'shell',command:'echo no'}]}));
});
test('environment URL is required, audio resolves relative to the plan',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'director-plan-'));const file=join(dir,'plan.json');
  await writeFile(file,JSON.stringify({version:1,url:'${DEMO_URL}',steps:[{action:'pause',audio:'voice.wav'}]}));
  await assert.rejects(loadPlan(file,{}),/Missing environment/);
  const p=await loadPlan(file,{DEMO_URL:'https://example.org'});assert.equal(p.steps[0].audio,join(dir,'voice.wav'));
});
test('skill installs are idempotent, update untouched files, and protect user edits',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'director-skill-'));const source=join(dir,'source'),dest=join(dir,'dest');
  await mkdir(source);await writeFile(join(source,'SKILL.md'),'version 1');
  await installSkill(source,dest);await installSkill(source,dest);
  await writeFile(join(source,'SKILL.md'),'version 2');await installSkill(source,dest);
  assert.equal(await readFile(join(dest,'SKILL.md'),'utf8'),'version 2');
  await writeFile(join(dest,'SKILL.md'),'personal edits');await writeFile(join(source,'SKILL.md'),'version 3');
  await assert.rejects(installSkill(source,dest),/Edited skill/);
  assert.equal(await readFile(join(dest,'SKILL.md'),'utf8'),'personal edits');
  await installSkill(source,dest,{force:true});assert.equal(await readFile(join(dest,'SKILL.md'),'utf8'),'version 3');
});
