'use strict';
// Opt-in editorial illustration. Never present generated artwork as journalism or evidence.
const IMAGE_MODEL='gpt-image-2.5-flare';
function illustrationPrompt(article){
 const headline=String(article?.title||'').slice(0,230);
 const category=String(article?.category||'world').slice(0,30);
 return `Create an original 16:9-style editorial illustration for a news reader, suitable for an illustrated headline banner. Subject: ${headline}. Category: ${category}. Symbolic, art-directed, professional news magazine illustration, carefully relevant to the named subject, not stock art. No captions, text, watermarks or logos that could be mistaken for official branding. Absolutely NOT a factual photograph of an actual news event, NOT photorealistic reportage, NOT documentary evidence. Avoid graphic violence.`;
}
async function createIllustration(article,key,fetcher=fetch){
 const response=await fetcher('https://api.openai.com/v1/images/generations',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model:IMAGE_MODEL,prompt:illustrationPrompt(article),size:'1024x1024',quality:'low',n:1}),signal:AbortSignal.timeout(90000)});
 if(!response.ok)throw new Error(`OpenAI Images: HTTP ${response.status}`);
 const json=await response.json(),content=json?.data?.[0]?.b64_json;
 if(typeof content!=='string'||content.length>3_200_000||!/^[a-zA-Z0-9+/=]+$/.test(content))throw new Error('OpenAI не повернув коректне зображення');
 return `data:image/png;base64,${content}`;
}
module.exports={IMAGE_MODEL,illustrationPrompt,createIllustration};
