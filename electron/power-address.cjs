'use strict';
function cleanPowerAddress(raw){
 const x=raw&&typeof raw==='object'?raw:{};
 const settlement=String(x.settlement||'').trim().slice(0,100);
 const street=String(x.street||'').trim().slice(0,120);
 const house=String(x.house||'').trim().slice(0,20);
 if([settlement,street,house].some(v=>/[<>\x00-\x1f]/.test(v)))throw new Error('У полі адреси є недопустимі символи');
 if([settlement,street,house].some(Boolean)&&(!settlement||!street||!house))throw new Error('Заповни населений пункт, вулицю й будинок');
 return {settlement,street,house};
}
module.exports={cleanPowerAddress};
