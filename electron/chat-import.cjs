'use strict';
// Offline parsing of a ChatGPT conversations.json export. Nothing is uploaded here.
const MAX_CANDIDATES=120;
const KEYWORDS=/(?:кожн(?:ий|ого|а|у|і)|щодн|daily|регуляр|план|тренув|стрім|стрим|twitch|youtube|rank\s*(?:it|daily)|відео|відос|видео|контент|лабораторн|дедлайн|н(?:а|у)да\s+(?:зроб|сдел)|треба\s+(?:зроб|зд)|хочу\s+(?:роб|сдел|зроб)|буду\s+(?:роб|дел)|публікац|опублік)/i;
function textParts(message){
  const content=message?.content;
  if(!content)return '';
  const p=Array.isArray(content.parts)?content.parts:[];
  return p.filter(x=>typeof x==='string').join('\n').trim();
}
function extractCandidates(conversations, limit=MAX_CANDIDATES){
  if(!Array.isArray(conversations))throw new Error('Це не conversations.json з експорту ChatGPT');
  const result=[];
  for(const conversation of conversations){
    if(!conversation||typeof conversation!=='object'||!conversation.mapping)continue;
    for(const node of Object.values(conversation.mapping)){
      const m=node?.message;
      if(m?.author?.role!=='user')continue;
      const text=textParts(m);
      if(text.length<12||!KEYWORDS.test(text))continue;
      const secs=Number(m.create_time||conversation.create_time||0);
      const createdAt=secs>0?new Date(secs*1000).toISOString():'';
      const title=String(conversation.title||'Без назви').slice(0,90);
      result.push({id:String(m.id||`${conversation.id}:${result.length}`),chat:title,date:createdAt,excerpt:text.slice(0,650)});
    }
  }
  result.sort((a,b)=>b.date.localeCompare(a.date));
  return {scannedConversations:conversations.length,candidates:result.slice(0,Math.min(300,Math.max(1,limit))),matchedMessages:result.length};
}
module.exports={extractCandidates};
