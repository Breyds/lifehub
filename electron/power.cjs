'use strict';
// Manual schedules, not a live utility feed. Kyiv-local times.
function validateBlackouts(raw){
 const lines=String(raw||'').split(/[,;\n]+/).map(s=>s.trim()).filter(Boolean);
 if(lines.length>12)throw new Error('Максимум 12 проміжків відключень.');
 const parsed=[];
 for(const line of lines){
  const m=line.match(/^([01]\d|2[0-3]):([0-5]\d)\s*[-–]\s*([01]\d|2[0-3]):([0-5]\d)$/);
  if(!m)throw new Error('Формат графіка: 09:00-12:00, 16:00-19:00');
  const a=+m[1]*60 + +m[2], b=+m[3]*60 + +m[4];
  if(b<=a)throw new Error('Кінець проміжку має бути пізніше початку. Для переходу через північ створи два проміжки.');
  parsed.push({start:`${m[1]}:${m[2]}`,end:`${m[3]}:${m[4]}`,startMinutes:a,endMinutes:b});
 }
 return parsed.sort((a,b)=>a.startMinutes-b.startMinutes);
}
function isBlackoutAt(time,raw){const m=/^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);if(!m)return false;const n=+m[1]*60+ +m[2];return validateBlackouts(raw).some(s=>n>=s.startMinutes&&n<s.endMinutes);}
module.exports={validateBlackouts,isBlackoutAt};
