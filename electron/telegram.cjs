'use strict';
function validToken(x){return typeof x==='string'&&/^\d{5,20}:[A-Za-z0-9_-]{30,}$/.test(x.trim());}
async function telegramRequest(token,method,payload,fetcher=fetch){
 if(!validToken(token))throw new Error('Некоректний токен Telegram-бота.');
 const response=await fetcher(`https://api.telegram.org/bot${token}/${method}`,{
   method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload||{}),signal:AbortSignal.timeout(15000)
 });
 const result=await response.json().catch(()=>null);
 if(!response.ok||!result?.ok)throw new Error(`Telegram: ${String(result?.description||'запит відхилено').slice(0,120)}`);
 return result.result;
}
function findStartedChat(items){
 const messages=(Array.isArray(items)?items:[]).map(x=>x?.message).filter(x=>x&&x.chat?.type==='private'&&String(x.text||'').trim().startsWith('/start')&&Number.isSafeInteger(x.chat.id));
 return messages.length?String(messages[messages.length-1].chat.id):'';
}
module.exports={validToken,telegramRequest,findStartedChat};
