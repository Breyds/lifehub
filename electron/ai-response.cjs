'use strict';
function readAnswer(result,{structured=false}={}){
 const parts=(Array.isArray(result?.output)?result.output:[]).flatMap(x=>Array.isArray(x.content)?x.content:[]);
 const text=parts.filter(x=>x.type==='output_text'&&typeof x.text==='string').map(x=>x.text).join('').trim();
 const refusal=parts.find(x=>x.type==='refusal');
 const reason=String(result?.incomplete_details?.reason||result?.error?.message||result?.status||'unknown');
 if(result?.status==='completed'&&text)return {text,partial:false};
 if(result?.status==='incomplete'&&reason==='max_output_tokens'&&!structured&&text)return {text,partial:true};
 if(refusal)throw Error('AI не зміг відповісти на цей запит. Уточни його. Автоматичного повтору немає.');
 if(result?.status==='incomplete'&&reason==='max_output_tokens')throw Error('AI вичерпав ліміт токенів відповіді. Витрачені токени можуть бути оплачені. Автоматичного повтору немає.');
 throw Error('AI не повернув завершену відповідь ('+reason.slice(0,180)+'). Автоматичного повтору немає.');
}
function outputLimit(kind,structured){return structured?10000:['fitness','nutrition'].includes(kind)?4500:1050;}
module.exports={readAnswer,outputLimit};
