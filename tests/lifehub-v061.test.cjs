'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../src/WorkspacePages.tsx'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'../src/studio.css'),'utf8');

test('planner first click selects date, second click opens details',()=>{
 assert.match(source,/if\(armedDate===x\)\{setPopupDate\(x\)/);
 assert.match(source,/else\{setFocus\(x\);setArmedDate\(x\)/);
 assert.match(source,/setArmedDate\(null\)/);
});
test('planner detail modal has summary, pending view and navigation',()=>{
 assert.match(source,/hub-date-popup-pro/);
 assert.match(source,/hub-popup-metrics/);
 assert.match(source,/detailsFilter==='pending'/);
 assert.match(source,/hub-popup-date-switch/);
 assert.match(source,/e\.key==='Escape'/);
});
test('planner sidebar groups tasks and retains edit and delete',()=>{
 assert.match(source,/hub-planner-right-groups/);
 assert.match(source,/rightOpen\[group\.id\]/);
 assert.match(source,/onEditTask\(t\)/);
 assert.match(source,/onDeleteTask\(t\)/);
 assert.match(css,/hub-planner-v061/);
});
