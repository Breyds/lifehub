'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const MAX=4*1024**3,EXT=new Set(['.mp4','.mov','.webm','.m4v','.mkv']);
function scan(folder,previous={},now=Date.now()){
 const next={},rows=[];
 for(const e of fs.readdirSync(folder,{withFileTypes:true}).filter(e=>e.isFile()&&EXT.has(path.extname(e.name).toLowerCase())).slice(0,300)){
  const file=path.join(folder,e.name);let st;try{st=fs.lstatSync(file);}catch{continue;}
  if(!st.isFile()||st.isSymbolicLink()||st.size<=0||st.size>MAX)continue;
  const signature=st.size+':'+st.mtimeMs,old=previous[e.name],since=old?.signature===signature?old.since:now;
  next[e.name]={signature,since};const ready=now-since>=20000&&now-st.mtimeMs>=20000;
  rows.push({file:e.name,size:st.size,modifiedAt:st.mtime.toISOString(),ready,signature});
 }
 return {rows:rows.sort((a,b)=>b.modifiedAt.localeCompare(a.modifiedAt)),next};
}
function metadata(folder,name,legacy={}){
 const stem=path.basename(name,path.extname(name));let raw={};
 for(const candidate of [name+'.json',stem+'.json']){
  try{const p=path.join(folder,candidate),st=fs.lstatSync(p);if(st.isFile()&&!st.isSymbolicLink()&&st.size<=65536){raw=JSON.parse(fs.readFileSync(p,'utf8'));break;}}catch{}
 }
 if(!raw||typeof raw!=='object')raw={};
 const text=(x,n)=>typeof x==='string'?x.trim().slice(0,n):'';
 const when=text(raw.publishAt||legacy.publishAt,40);let publishAt='';if(when&&Number.isFinite(Date.parse(when)))publishAt=new Date(when).toISOString();
 return {title:text(raw.title||legacy.title,100)||stem.replace(/[-_]/g,' ').slice(0,100),description:text(raw.description||legacy.description,5000),tags:text(Array.isArray(raw.tags)?raw.tags.filter(x=>typeof x==='string').join(', '):raw.tags,450),format:raw.format==='long'?'long':'short',publishAt,madeForKids:typeof raw.madeForKids==='boolean'?raw.madeForKids:null,categoryId:/^\d{1,3}$/.test(String(raw.categoryId))?String(raw.categoryId):'22'};
}
async function digest(file){const h=crypto.createHash('sha256');for await(const chunk of fs.createReadStream(file))h.update(chunk);return h.digest('hex');}
async function copyStable(folder,row,dest){
 const source=path.join(folder,row.file),before=fs.lstatSync(source);
 if(!before.isFile()||before.isSymbolicLink()||before.size+':'+before.mtimeMs!==row.signature||before.size>MAX)throw Error('Файл ще змінюється');
 await fs.promises.copyFile(source,dest,fs.constants.COPYFILE_EXCL);
 try{const after=fs.lstatSync(source);if(after.size+':'+after.mtimeMs!==row.signature)throw Error('Файл змінився під час копіювання');return await digest(dest);}
 catch(e){await fs.promises.unlink(dest).catch(()=>{});throw e;}
}
function coverFile(folder,name){
 const stem=path.basename(name,path.extname(name));
 for(const ext of ['.png','.jpg','.jpeg']){try{const file=path.join(folder,stem+ext),st=fs.lstatSync(file);if(st.isFile()&&!st.isSymbolicLink()&&st.size>0&&st.size<=2*1024**2)return file;}catch{}}
 return null;
}
module.exports={scan,metadata,copyStable,coverFile};
