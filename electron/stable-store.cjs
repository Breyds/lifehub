'use strict';
const fs=require('node:fs'),path=require('node:path');
function atomicStore(){
 let lastPath='',lastSerialized=null;
 function write(filename,data){
  const serialized=JSON.stringify(data,null,2);
  if(filename===lastPath&&serialized===lastSerialized&&fs.existsSync(filename))return false;
  fs.mkdirSync(path.dirname(filename),{recursive:true});const tmp=filename+'.tmp';
  try{fs.writeFileSync(tmp,serialized,{encoding:'utf8',mode:0o600});fs.renameSync(tmp,filename);}
  catch(e){try{fs.unlinkSync(tmp);}catch{}throw e;}
  lastPath=filename;lastSerialized=serialized;return true;
 }
 return {write};
}
function shouldCheckpoint(last,now,important=false){return important||!last||now<last||now-last>=300000;}
module.exports={atomicStore,shouldCheckpoint};
