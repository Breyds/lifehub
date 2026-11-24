'use strict';
function chooseCover(items,cache,state,now=Date.now()){
 return items.filter(a=>!cache[a.id]&&(!a.imageUrl||state[a.id]?.broken)&&!state[a.id]?.done&&Number(state[a.id]?.nextAt||0)<=now&&Number(state[a.id]?.attempts||0)<3).sort((a,b)=>Number(['deals','ukraine'].includes(b.category))-Number(['deals','ukraine'].includes(a.category)))[0]||null;
}
function canGenerate({enabled,hasKey,count,busy,spent,limit,now=Date.now(),pauseUntil=0}){
 return enabled&&hasKey&&!busy&&count<20&&spent<limit-0.6&&now>=pauseUntil;
}
module.exports={chooseCover,canGenerate};
