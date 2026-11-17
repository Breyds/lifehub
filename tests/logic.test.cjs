const test=require('node:test');const assert=require('node:assert/strict');
const {cleanTask,occurs,complete,occurrenceKey,validateProposal,validDate}=require('../electron/logic.cjs');
test('валідація календарних дат',()=>{assert.equal(validDate('2026-02-29'),false);assert.equal(validDate('2028-02-29'),true);});
test('одноразові прострочені завдання залишаються видимими',()=>{const t=cleanTask({title:'test',dueDate:'2026-11-17',time:'19:00'});assert.equal(occurs(t,'2026-11-18'),true);t.completions.push('2026-11-17');assert.equal(occurs(t,'2026-11-18'),false);});
test('дні тижня пропускають вихідні',()=>{const t=cleanTask({title:'test',dueDate:'2026-11-16',recurrence:'weekdays'});assert.equal(occurs(t,'2026-11-17'),true);assert.equal(occurs(t,'2026-11-21'),false);});
test('тижневий повтор кожні сім днів',()=>{const t=cleanTask({title:'test',dueDate:'2026-11-17',recurrence:'weekly'});assert.equal(occurs(t,'2026-11-24'),true);assert.equal(occurs(t,'2026-11-25'),false);});
test('повторюване завдання виконується окремо за кожен день',()=>{const t=cleanTask({title:'test',dueDate:'2026-11-17',recurrence:'daily'});t.completions.push(occurrenceKey(t,'2026-11-17'));assert.equal(complete(t,'2026-11-17'),true);assert.equal(complete(t,'2026-11-18'),false);});
test('AI не може перенести повторювану задачу',()=>{const t=cleanTask({title:'test',dueDate:'2026-11-17',recurrence:'daily'});assert.equal(validateProposal({action:'reschedule',task_id:t.id,date:'2026-11-20',time:''},[t]),null);});
