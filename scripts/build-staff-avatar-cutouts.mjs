// Offline asset preparation only. Vercel/PWA use the committed static WebPs.
// ImageGen supplied alpha mattes; original RGB is copied, never regenerated.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';

const root=path.resolve(import.meta.dirname,'..');
const names=['owner','bartender-1','bartender-2','waiter-1','waiter-2','manager-1','manager-2','hostess-1','hostess-2'];
const digest=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const files=[];
for(const name of names){
  const source=path.join(root,'artwork/staff-avatars/source',name+'.webp');
  const mask=path.join(root,'artwork/staff-avatars/masks',name+'.png');
  const output=path.join(root,'assets/staff-avatars',name+'.webp');
  execFileSync('magick',[source,mask,'-alpha','off','-compose','CopyOpacity','-composite','-define','webp:lossless=true','-quality','100',output]);
  const original=execFileSync('magick',[source,'-depth','8','RGBA:-']);
  const final=execFileSync('magick',[output,'-depth','8','RGBA:-']);
  if(original.length!==512*512*4||final.length!==original.length)throw Error(name+': unexpected geometry');
  let transparent=0,opaque=0,changedOpaquePixels=0;
  for(let i=0;i<final.length;i+=4){
    if(final[i+3]===0)transparent++;
    if(final[i+3]===255){opaque++;if(final[i]!==original[i]||final[i+1]!==original[i+1]||final[i+2]!==original[i+2])changedOpaquePixels++;}
  }
  if(transparent<20000||opaque<150000||changedOpaquePixels)throw Error(name+': invalid alpha or changed opaque RGB');
  files.push({name,sourceSHA256:digest(source),maskSHA256:digest(mask),outputSHA256:digest(output),bytes:fs.statSync(output).size,transparentPixels:transparent,opaquePixels:opaque,changedOpaquePixels});
}
const record={source:'User-provided BeerFactory_Staff_Avatars.zip; RGB sources copied from d52f7db assets/staff-avatars. See docs/STAFF_AVATARS_PROVENANCE.json for original upload hashes.',method:'ImageGen background-removal alpha only; mattes resized to512px and leveled2%/97% to remove faint noise and keep badge interiors opaque. Original source RGB copied with CopyOpacity, encoded lossless WebP. No face/logo redraw. Source artwork/masks do not enter public assets.',files};
fs.writeFileSync(path.join(root,'artwork/staff-avatars/cutout-provenance.json'),JSON.stringify(record,null,2)+'\n');
console.log(JSON.stringify({files:files.length,bytes:files.reduce((s,f)=>s+f.bytes,0),changedOpaquePixels:files.reduce((s,f)=>s+f.changedOpaquePixels,0)}));
