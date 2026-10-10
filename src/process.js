import { spawn } from 'node:child_process';
export function run(command,args,{capture=true,...options}={}) {
  return new Promise((resolve,reject)=>{
    const child=spawn(command,args,{stdio:capture?['ignore','pipe','pipe']:'inherit',...options});
    let stdout='',stderr='';
    child.stdout?.on('data',x=>stdout+=x); child.stderr?.on('data',x=>{stderr=(stderr+x).slice(-24000);});
    child.on('error',reject); child.on('close',code=>code===0?resolve(stdout):reject(new Error(`${command} exited ${code}\n${stderr}`)));
  });
}
export async function duration(file) {
  return Number((await run('ffprobe',['-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',file])).trim());
}
