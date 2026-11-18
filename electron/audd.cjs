'use strict';
// Music recognition from a locally selected audio fragment. No TikTok audio downloads.
function parseAudDResponse(json){
 if(!json||json.status!=='success')throw new Error('Сервіс AudD не зміг обробити запит.');
 const r=json.result;
 if(!r||!r.title||!r.artist)return {found:false,message:'Пісню не розпізнано. Спробуй інший 10–20-секундний фрагмент.'};
 const spotify=r.spotify?.external_urls?.spotify||'';
 return {found:true,title:String(r.title).slice(0,180),artist:String(r.artist).slice(0,180),album:String(r.album||'').slice(0,180),spotifyUrl:/^https:\/\/open\.spotify\.com\//.test(spotify)?spotify:'',message:'Порівняй результат із відео перед додаванням у список.'};
}
async function recognizeAudio(apiToken,buffer,name,fetcher=fetch){
 if(typeof apiToken!=='string'||!apiToken.trim())throw new Error('Вкажи токен AudD у налаштуваннях.');
 if(!Buffer.isBuffer(buffer)||buffer.length<100||buffer.length>12*1024*1024)throw new Error('Фрагмент аудіо має бути менше 12 МБ.');
 const form=new FormData();form.append('api_token',apiToken);form.append('return','spotify');form.append('file',new Blob([buffer],{type:'audio/mpeg'}),String(name||'clip.mp3').slice(0,100));
 const response=await fetcher('https://api.audd.io/',{method:'POST',body:form,signal:AbortSignal.timeout(35000)});
 if(!response.ok)throw new Error('AudD API: HTTP '+response.status);
 return parseAudDResponse(await response.json());
}
module.exports={parseAudDResponse,recognizeAudio};
