export const wide = {zoom:1,x:0,y:0};
export function frameBox(box, viewport, padding=70, maxZoom=1.8) {
  // Fit the entire region. Large regions stay wide instead of cropping context.
  const zoom = Math.max(1, Math.min(maxZoom, viewport.width/(box.width+padding*2), viewport.height/(box.height+padding*2)));
  return {zoom, x:Math.max(0,Math.min(viewport.width-viewport.width/zoom,box.x+box.width/2-viewport.width/zoom/2)), y:Math.max(0,Math.min(viewport.height-viewport.height/zoom,box.y+box.height/2-viewport.height/zoom/2))};
}
export function poseAt(cues, time) {
  let pose = wide;
  for (const cue of cues) {
    if (time < cue.at) break;
    const p = cue.duration ? Math.min(1,(time-cue.at)/cue.duration) : 1;
    const t = p*p*(3-2*p);
    pose = Object.fromEntries(['zoom','x','y'].map(k=>[k,cue.from[k]+(cue.to[k]-cue.from[k])*t]));
  }
  return pose;
}
export function addCue(cues, at, to, duration=.65) {
  const cue = {at, duration, from:poseAt(cues,at), to};
  cues.push(cue); return cue;
}
export function expression(cues,key,fps=30) {
  let result = String(wide[key]);
  for (const cue of cues) {
    const p = cue.duration ? `min(1,max(0,(on/${fps}-${cue.at.toFixed(5)})/${cue.duration}))` : '1';
    const t = `(${p}*${p}*(3-2*${p}))`;
    result = `if(gte(on/${fps},${cue.at.toFixed(5)}),${cue.from[key]}+(${cue.to[key]-cue.from[key]})*${t},${result})`;
  }
  return result;
}
