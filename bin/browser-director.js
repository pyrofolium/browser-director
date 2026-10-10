#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve, dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { readFile, writeFile, mkdir, access, chmod } from 'node:fs/promises';
import { chromium } from 'playwright';
import { loadPlan } from '../src/plan.js';
import { record } from '../src/record.js';
import { render } from '../src/render.js';
import { installSkill } from '../src/skills.js';
import { run } from '../src/process.js';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const help=`browser-director — script real browser demos with a moving camera

Usage:
  browser-director init [directory]          Create a runnable example
  browser-director validate PLAN             Validate a JSON plan and audio files
  browser-director run PLAN --out DIRECTORY  Record and render DIRECTORY/demo.mp4
  browser-director record PLAN --out DIR     Record only; keep editable camera cues
  browser-director render RECORDING --output VIDEO.mp4
  browser-director setup                    Install the matching Chromium browser
  browser-director login URL --state FILE    Save a login for later recordings
  browser-director doctor                   Check Node, browser, FFmpeg, ffprobe
  browser-director install-skill [--codex] [--claude] [--force]

Options: --headed (visible recording), --state FILE (saved login), --version
Skill installation defaults to both agents. Recordings always use a NEW directory.
Plans execute real clicks. Inspect them before running against a live service.
`;
async function main() {
  const {values:v,positionals:p}=parseArgs({allowPositionals:true,options:{out:{type:'string'},output:{type:'string'},state:{type:'string'},headed:{type:'boolean'},codex:{type:'boolean'},claude:{type:'boolean'},force:{type:'boolean'},help:{type:'boolean',short:'h'},version:{type:'boolean'}}});
  if(v.version) {console.log(JSON.parse(await readFile(join(root,'package.json'),'utf8')).version);return;}
  const command=p[0];if(!command||v.help){console.log(help);return;}
  if(command==='setup') {
    const cli=join(dirname(fileURLToPath(import.meta.resolve('playwright/package.json'))),'cli.js');
    await run(process.execPath,[cli,'install','chromium'],{capture:false});return;
  }
  if(command==='doctor') {
    let failed=false;
    for(const [name,check] of [
      ['Node >=22',async()=>{if(Number(process.versions.node.split('.')[0])<22)throw new Error('Upgrade Node');return process.versions.node;}],
      ['FFmpeg',()=>run('ffmpeg',['-version'])],['ffprobe',()=>run('ffprobe',['-version'])],
      ['Chromium',async()=>{const b=await chromium.launch();try{return b.version();}finally{await b.close();}}],
    ]) {try{console.log(`OK ${name}: ${(await check()).split('\n')[0]}`);}catch(e){failed=true;console.error(`MISSING ${name}: ${e.message.split('\n')[0]}`);}}
    if(failed) {console.error('Install ffmpeg, then run browser-director setup. Linux may also need Playwright OS libraries.');process.exitCode=1;}return;
  }
  if(command==='install-skill') {
    const both=!v.codex&&!v.claude;
    const destinations=[];
    if(both||v.codex) destinations.push(join(process.env.CODEX_HOME??join(homedir(),'.agents'),'skills','browser-director'));
    if(both||v.claude) destinations.push(join(process.env.CLAUDE_CONFIG_DIR??join(homedir(),'.claude'),'skills','browser-director'));
    for(const dest of new Set(destinations)) console.log(await installSkill(join(root,'skill'),dest,{force:v.force}));return;
  }
  if(command==='init') {
    const dir=resolve(p[1]??'browser-demo');await mkdir(dir,{recursive:false});
    for(const name of ['index.html','plan.json']) await writeFile(join(dir,name),await readFile(join(root,'examples',name)));
    const plan=JSON.parse(await readFile(join(dir,'plan.json'),'utf8'));plan.url=pathToFileURL(join(dir,'index.html')).href;
    await writeFile(join(dir,'plan.json'),JSON.stringify(plan,null,2)+'\n');
    console.log(`Created ${dir}\nRun: browser-director run ${JSON.stringify(join(dir,'plan.json'))} --out ${JSON.stringify(join(dir,'take-1'))}`);return;
  }
  if(command==='login') {
    if(!p[1]||!v.state)throw new Error('login requires URL --state FILE');
    if(!['https:','http:'].includes(new URL(p[1]).protocol))throw new Error('Login requires HTTP(S)');
    const file=resolve(v.state);try{await access(file);throw new Error('State file exists; choose a new filename');}catch(e){if(e.code!=='ENOENT')throw e;}
    await mkdir(dirname(file),{recursive:true,mode:0o700});
    const b=await chromium.launch({headless:false});
    try {
      const c=await b.newContext();const page=await c.newPage();await page.goto(p[1]);
      const {createInterface}=await import('node:readline/promises');const rl=createInterface({input:process.stdin,output:process.stdout});
      try{await rl.question('Sign in in the browser, then press Enter here to save the session. ');}finally{rl.close();}
      const state=await c.storageState({indexedDB:true});await writeFile(file,JSON.stringify(state),{mode:0o600,flag:'wx'});await chmod(file,0o600);console.log(`Saved ${file} (contains credentials; do not commit it)`);
    }finally{await b.close();}return;
  }
  if(command==='render') {if(!p[1]||!v.output)throw new Error('render requires RECORDING --output VIDEO.mp4');console.log(await render(resolve(p[1]),v.output));return;}
  if(['run','record','validate'].includes(command)) {
    if(!p[1])throw new Error('A JSON plan is required');
    const plan=await loadPlan(resolve(p[1]));
    for(const s of [...plan.prepare,...plan.steps]) if(s.audio)await access(s.audio);
    if(command==='validate'){console.log(`Valid: ${plan.steps.length} steps`);return;}
    if(!v.out)throw new Error('--out must name a new recording directory');
    const file=await record(plan,v.out,{headed:v.headed,state:v.state});console.log(`Recorded ${file}`);
    if(command==='run')console.log(await render(file,join(resolve(v.out),'demo.mp4')));return;
  }
  throw new Error(`Unknown command: ${command}. Use --help.`);
}
main().catch(e=>{console.error(`browser-director: ${e.message}`);process.exitCode=1;});
