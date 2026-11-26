'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const MAX=4*1024**3,EXT=new Set(['.mp4','.mov','.webm','.m4v','.mkv']);
function safePath(folder,name){const root=fs.realpathSync(folder),file=path.resolve(folder,name),rel=path.relative(root,fs.realpathSync(file));if(!rel||rel==='..'||rel.startsWith('..'+path.sep)||path.isAbsolute(rel))throw Error('Файл поза папкою каналу');return file;}
function scan(folder,previous={},now=Date.now()){
 const next={},rows=[],diagnostics={folders:0,files:0,unsupported:0,invalid:0,truncated:false};let visits=0;
 function visit(dir,depth){if(depth>3||visits>=1800||rows.length>=300){diagnostics.truncated=true;return;}diagnostics.folders++;
 for(const e of fs.readdirSync(dir,{withFileTypes:true})){if(++visits>1800||rows.length>=300){diagnostics.truncated=true;break;}
 const absolute=path.join(dir,e.name);if(e.isSymbolicLink())continue;
 if(e.isDirectory()){if(depth<3)visit(absolute,depth+1);else diagnostics.truncated=true;continue;}
 if(!e.isFile())continue;diagnostics.files++;if(!EXT.has(path.extname(e.name).toLowerCase())){diagnostics.unsupported++;continue;}
 const file=path.relative(folder,absolute);let st;try{st=fs.lstatSync(safePath(folder,file));}catch{diagnostics.invalid++;continue;}
 if(!st.isFile()||st.isSymbolicLink()||st.size<=0||st.size>MAX){diagnostics.invalid++;continue;}
 const signature=st.size+':'+st.mtimeMs,old=previous[file],since=old?.signature===signature?old.since:now;
 next[file]={signature,since};const ready=now-since>=20000&&now-st.mtimeMs>=20000;
 rows.push({file,size:st.size,modifiedAt:st.mtime.toISOString(),ready,signature});
 }}
 visit(folder,0);
 return {rows:rows.sort((a,b)=>b.modifiedAt.localeCompare(a.modifiedAt)),next,diagnostics};
}
function metadata(folder,name,legacy={}){
 const dir=path.dirname(safePath(folder,name)),base=path.basename(name),stem=path.basename(base,path.extname(base));let raw={};
 const unique=fs.readdirSync(dir,{withFileTypes:true}).filter(e=>e.isFile()&&EXT.has(path.extname(e.name).toLowerCase())).length===1;
 for(const candidate of [base+'.json',stem+'.json',...(unique?['upload_ready.json','upload-ready.json','metadata.json']:[])]){
  try{const p=safePath(dir,candidate),st=fs.lstatSync(p);if(st.isFile()&&!st.isSymbolicLink()&&st.size<=65536){raw=JSON.parse(fs.readFileSync(p,'utf8'));break;}}catch{}
 }
 if(!raw||typeof raw!=='object')raw={};if(raw.metadata&&typeof raw.metadata==='object')raw={...raw,...raw.metadata};
 const readText=n=>{try{const p=safePath(dir,n),st=fs.lstatSync(p);return st.isFile()&&!st.isSymbolicLink()&&st.size<=65536?fs.readFileSync(p,'utf8').trim():'';}catch{return '';}};
 if(unique){raw.title=raw.title||readText('title.txt');raw.description=raw.description||readText('description.txt');raw.tags=raw.tags||readText('tags.txt');}
 const text=(x,n)=>typeof x==='string'?x.trim().slice(0,n):'';
 const when=text(raw.publishAt||legacy.publishAt,40);let publishAt='';if(when&&Number.isFinite(Date.parse(when)))publishAt=new Date(when).toISOString();
 return {title:text(raw.title||legacy.title,100)||stem.replace(/[-_]/g,' ').slice(0,100),description:text(raw.description||legacy.description,5000),tags:text(Array.isArray(raw.tags)?raw.tags.filter(x=>typeof x==='string').join(', '):raw.tags,450),format:raw.format==='long'?'long':'short',publishAt,madeForKids:typeof raw.madeForKids==='boolean'?raw.madeForKids:null,categoryId:/^\d{1,3}$/.test(String(raw.categoryId))?String(raw.categoryId):'22'};
}
async function digest(file){const h=crypto.createHash('sha256');for await(const chunk of fs.createReadStream(file))h.update(chunk);return h.digest('hex');}
async function copyStable(folder,row,dest){
 const source=safePath(folder,row.file),before=fs.lstatSync(source);
 if(!before.isFile()||before.isSymbolicLink()||before.size+':'+before.mtimeMs!==row.signature||before.size>MAX)throw Error('Файл ще змінюється');
 await fs.promises.copyFile(source,dest,fs.constants.COPYFILE_EXCL);
 try{const after=fs.lstatSync(safePath(folder,row.file));if(after.size+':'+after.mtimeMs!==row.signature)throw Error('Файл змінився під час копіювання');return await digest(dest);}
 catch(e){await fs.promises.unlink(dest).catch(()=>{});throw e;}
}
function coverFile(folder,name){
 const dir=path.dirname(safePath(folder,name)),stem=path.basename(name,path.extname(name));
 for(const ext of ['.png','.jpg','.jpeg']){try{const file=safePath(dir,stem+ext),st=fs.lstatSync(file);if(st.isFile()&&!st.isSymbolicLink()&&st.size>0&&st.size<=2*1024**2)return file;}catch{}}
 return null;
}
module.exports={scan,metadata,copyStable,coverFile};
