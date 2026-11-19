'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {extractFactResponse,mapDtekResponse,slotsToDay}=require('../electron/dtek-live.cjs');
const {parseMirror}=require('../electron/dtek-mirror.cjs');
const src=(name)=>fs.readFileSync(path.join(__dirname,'../',name),'utf8');

test('Official DTEK address lookup retains group when no daily schedule is published',()=>{
 const raw={result:true,showTableFact:false,data:{'26':{sub_type_reason:['GPV3.2']}},fact:{data:{}}};
 const found=extractFactResponse(raw,'26');
 assert.equal(found.group,'GPV3.2');
 assert.equal(found.days.length,0);
 const state=mapDtekResponse(found);
 assert.equal(state.status,'unavailable');
 assert.equal(state.group,'GPV3.2');
 assert.equal(state.groupSource,'official');
});
test('Ambiguous house group never guesses a queue',()=>{
 const raw={result:true,showTableFact:false,data:{'26':{sub_type_reason:['GPV3.1','GPV3.2']}},fact:{data:{}}};
 assert.equal(extractFactResponse(raw,'26').group,undefined);
});
test('An official day distinguishes half-hour on/off and unknown slots',()=>{
 const day=slotsToDay({'1':'first','2':'second','3':'maybe'},'2026-11-19');
 assert.deepEqual(day.slots.slice(0,5).map(x=>x.status),['off','on','off','possible','unknown']);
});
test('Public mirror weekly preset is separate from actual DTEK daily facts',()=>{
 const now=new Date('2026-11-19T14:00:00Z');
 const raw={regionId:'kyiv-region',lastUpdated:'2026-11-19T12:00:00Z',fact:{data:{}},preset:{data:{'GPV3.2':{'4':{'1':'first','2':'yes'},'5':{'1':'no'}}}}};
 const result=parseMirror(raw,'3.2',now);
 assert.equal(result.status,'mirror');
 assert.equal(result.days.length,0);
 assert.equal(result.intervals.length,0);
 assert.equal(result.weeklyDays.length,2);
 assert.equal(result.weeklyDays[0].date,'2026-11-19');
 assert.equal(result.weeklyDays[0].slots[0].status,'off');
 assert.equal(result.weeklyDays[0].slots[1].status,'on');
 assert.match(result.message,/прогноз/i);
});
test('Stale weekly source remains labeled as stale, not confirmed',()=>{
 const now=new Date('2026-11-19T14:00:00Z');
 const raw={regionId:'kyiv-region',lastUpdated:'2026-11-18T01:00:00Z',fact:{data:{}},preset:{data:{'GPV4.2':{'4':{'1':'yes'}}}}};
 const result=parseMirror(raw,'4.2',now);
 assert.equal(result.status,'stale');
 assert.equal(result.weeklyDays.length,1);
 assert.equal(result.intervals.length,0);
});
test('Power UI has week/day modes, half-hour details, clear unknown states and automatic address queue',()=>{
 const ui=src('src/PowerPage.tsx'),grid=src('src/power-grid.ts'),logic=src('electron/main.cjs');
 assert.match(ui,/Сьогодні/);assert.match(ui,/Завтра/);assert.match(ui,/7 днів/);
 assert.match(ui,/hourView\(day,h\)/);assert.match(ui,/timeRange\(selected.hour,n\)/);
 assert.match(grid,/halves:\[PowerStatus,PowerStatus\]/);
 assert.match(grid,/unknown/);assert.match(grid,/minutes\(slot.start\)/);
 assert.match(ui,/Чергу визначив ДТЕК/);
 assert.match(logic,/db\.powerGroupOrigin='official'/);
 assert.match(logic,/powerSchedule:db\.powerLive\?\.status==='verified'&&Date\.now\(\)-Date\.parse/);
});
