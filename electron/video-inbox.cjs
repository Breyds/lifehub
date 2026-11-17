'use strict';
const fs=require('node:fs');
const path=require('node:path');
const ALLOWED=new Set(['.mp4','.mov','.m4v','.webm']);
function scanInbox(folder){
  fs.mkdirSync(folder,{recursive:true});
  return fs.readdirSync(folder,{withFileTypes:true})
    .filter(e=>e.isFile()&&ALLOWED.has(path.extname(e.name).toLowerCase()))
    .map(e=>{const stat=fs.statSync(path.join(folder,e.name));return {file:e.name,size:stat.size,modifiedAt:stat.mtime.toISOString()};})
    .sort((a,b)=>b.modifiedAt.localeCompare(a.modifiedAt));
}
function copyToInbox(file,inbox){
  if(!ALLOWED.has(path.extname(file).toLowerCase()))throw new Error('Підтримуються MP4, MOV, M4V, WebM');
  fs.mkdirSync(inbox,{recursive:true});
  let name=path.basename(file),n=1;
  while(fs.existsSync(path.join(inbox,name))){
    const ext=path.extname(file);name=`${path.basename(file,ext)}-${n++}${ext}`;
  }
  fs.copyFileSync(file,path.join(inbox,name));
  return name;
}
module.exports={scanInbox,copyToInbox};
