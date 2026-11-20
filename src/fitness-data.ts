// Оригінальний навчальний каталог LifeHub. Без несанкціонованого брендингу чи обіцянок результату.
export type Level='beginner'|'intermediate'|'advanced';
export type FitnessGoal='general'|'loss'|'muscle'|'endurance';
export type Gear='bodyweight'|'dumbbells'|'bands'|'treadmill'|'mat'|'chair';
export type Exercise={id:string;title:string;muscle:string;gear:Gear;level:Level;instructions:string[];caution:string;search:string;minutes?:number};
export type RoutineStep={id:string;sets:number;reps:string;rest:number};
export type Routine={title:string;duration:number;steps:RoutineStep[];kind:'strength'|'cardio'|'mobility'};
export type FitnessProgram={id:string;name:string;tag:string;description:string;goal:FitnessGoal|'any';level:Level;days:number;gear:Gear[];routines:Routine[]};
const E=(id:string,title:string,muscle:string,gear:Gear,level:Level,steps:string[],caution:string,search:string):Exercise=>({id,title,muscle,gear,level,instructions:steps,caution,search});
export const exercises:Exercise[]=[
 E('squat','Присідання','Ноги · сідниці','bodyweight','beginner',['Стопи на ширині плечей, вага рівномірно на стопах.','Відведи таз назад і зігни коліна в комфортній амплітуді.','Піднімайся плавно, без ривка.'],'Не тренуйся через гострий біль у колінах чи спині.','bodyweight squat technique'),
 E('chair-squat','Присідання до стільця','Ноги · сідниці','chair','beginner',['Постав стійкий стілець позаду.','Повільно сядь із контролем, потім піднімися.'],'Використовуй нерухомий стілець.','sit to stand exercise technique'),
 E('lunge','Випади назад','Ноги · баланс','bodyweight','beginner',['Зроби крок назад, тримай корпус рівним.','Опустися у зручну амплітуду й повернись.','Поміняй ногу.'],'Для балансу тримайся за опору.','reverse lunges proper form'),
 E('glute-bridge','Сідничний міст','Сідниці · задня поверхня стегна','mat','beginner',['Ляж на спину, зігни коліна.','Підніми таз без прогину в попереку.','Опусти контрольовано.'],'Не закидай голову назад.','glute bridge technique'),
 E('calf-raise','Підйоми на носки','Литки','bodyweight','beginner',['Стань біля опори, стопи паралельні.','Підніми п’яти, коротко затримайся та опусти.'],'Тримай баланс.','standing calf raise technique'),
 E('wall-pushup','Віджимання від стіни','Груди · трицепс','bodyweight','beginner',['Постав долоні на стіну на рівні плечей.','Зігни лікті та наблизься до стіни.','Повернись у вихідне положення.'],'Лікті не розводь надто широко.','wall push up proper form'),
 E('pushup','Віджимання','Груди · трицепс','bodyweight','intermediate',['Долоні під плечима, корпус рівний.','Опускайся контрольовано, видихни на підйомі.'],'За потреби почни з упору на коліна.','push ups proper form'),
 E('knee-pushup','Віджимання з колін','Груди · трицепс','mat','beginner',['Коліна на килимку, корпус прямий від колін до плечей.','Плавно опустися та виштовхнись назад.'],'Не провалюй поперек.','modified push up form'),
 E('plank','Планка','Кор · стабілізація','mat','beginner',['Лікті під плечима, корпус рівний.','Дихай рівномірно, утримуй короткі інтервали.'],'Завершуй підхід при втраті техніки.','forearm plank proper form'),
 E('side-plank','Бічна планка','Кор · косі м’язи','mat','intermediate',['Лікоть під плечем, стегна підняті.','Утримуй положення без завалювання корпуса.'],'Почни з опори на зігнуті коліна.','side plank technique'),
 E('dead-bug','Dead bug','Кор · координація','mat','beginner',['Ляж на спину, руки й ноги підняті.','Повільно опускай протилежні руку та ногу.','Поперек зберігай нейтральним.'],'Не поспішай.','dead bug exercise form'),
 E('bird-dog','Bird dog','Спина · кор','mat','beginner',['Стань навкарачки.','Витягни протилежні руку й ногу, не обертаючи таз.','Повернись і поміняй сторони.'],'Рух повільний і контрольований.','bird dog exercise technique'),
 E('superman','Підйом рук і ніг лежачи','Спина','mat','intermediate',['Ляж обличчям униз.','Трохи підніми руки й ноги та опусти.'],'Не перенапружуй поперек.','prone back extension floor'),
 E('dumbbell-row','Тяга гантелі в нахилі','Спина · біцепс','dumbbells','beginner',['Спирайся вільною рукою на стійку опору.','Підтягни гантель до таза без скручування.','Опусти плавно.'],'Підбирай вагу, з якою контролюєш рух.','one arm dumbbell row form'),
 E('dumbbell-press','Жим гантелей лежачи','Груди · трицепс','dumbbells','intermediate',['Ляж на стійку поверхню, гантелі біля грудей.','Вижми вгору контрольовано, опусти.'],'Не виконуй без безпечної опори.','dumbbell floor press form'),
 E('dumbbell-ohp','Жим гантелей над головою','Плечі','dumbbells','intermediate',['Стань стійко, гантелі біля плечей.','Вижми вгору без прогину в попереку.'],'За дискомфорту плеча пропусти вправу.','dumbbell shoulder press form'),
 E('dumbbell-curl','Згинання рук з гантелями','Біцепс','dumbbells','beginner',['Лікті біля корпуса.','Зігни руки без розгойдування та повільно опусти.'],'Не бери вагу, що змушує хитатися.','dumbbell bicep curls form'),
 E('dumbbell-rdl','Румунська тяга з гантелями','Задня поверхня стегна · сідниці','dumbbells','intermediate',['Злегка зігни коліна.','Відведи таз назад, гантелі йдуть уздовж ніг.','Повернись без ривка.'],'Зберігай нейтральне положення спини.','dumbbell romanian deadlift form'),
 E('dumbbell-squat','Goblet-присідання','Ноги · кор','dumbbells','intermediate',['Тримай одну гантель біля грудей.','Присідай у комфортній амплітуді.','Плавно встань.'],'Не затримуй дихання.','goblet squat technique'),
 E('band-row','Тяга еспандера','Спина','bands','beginner',['Закріпи еспандер безпечно.','Потягни лікті назад і повільно відпусти.'],'Перевір кріплення еспандера.','resistance band row form'),
 E('band-pull-apart','Розведення еспандера','Верх спини · постава','bands','beginner',['Тримай стрічку перед собою.','Розведи руки, зведи лопатки без ривка.'],'Не піднімай плечі до вух.','band pull apart form'),
 E('step-up','Кроки на невисоку платформу','Ноги · кардіо','chair','intermediate',['Використовуй спеціальну стійку невисоку платформу, не звичайний стілець.','Піднімайся контрольовано, поміняй ногу.'],'Не використовуй нестійкі меблі.','low step ups exercise'),
 E('march','Ходьба на місці','Легке кардіо','bodyweight','beginner',['Іди на місці в комфортному темпі.','Тримай плечі розслабленими, дихай рівно.'],'Сповільнись при запамороченні.','marching in place exercise'),
 E('jumping-jacks','Стрибки ноги-руки','Кардіо','bodyweight','intermediate',['Пружно розводь ноги й піднімай руки.','Приземляйся м’яко.'],'За дискомфорту суглобів заміни на кроки в сторони.','jumping jacks exercise form'),
 E('mountain-climber','Альпініст','Кор · кардіо','mat','intermediate',['Стань у планку на прямих руках.','Підтягуй коліна по черзі без стрибків.'],'Утримуй стабільний корпус.','slow mountain climbers exercise'),
 E('tread-walk','Ходьба на доріжці','Кардіо · відновлення','treadmill','beginner',['Почни зі спокійної швидкості.','Поступово змінюй темп, орієнтуючись на комфорт і можливість говорити.','Наприкінці зроби кілька хвилин повільнішої ходьби.'],'Використовуй страховий ключ і правила своєї доріжки.','treadmill walking beginner form'),
 E('tread-intervals','Ходьба інтервалами','Кардіо · витривалість','treadmill','intermediate',['5 хвилин легкої ходьби.','Чергуй короткі помірні та легкі відрізки.','Завершуй спокійною ходьбою.'],'Не починай зі спринтів.','treadmill walking interval workout'),
 E('hip-hinge','Нахил із відведенням таза','Рухливість · задній ланцюг','bodyweight','beginner',['Коліна м’які, руки на стегнах.','Відведи таз назад без округлення спини.','Повернись у вертикальне положення.'],'Амплітуда лише комфортна.','hip hinge drill proper form'),
 E('cat-cow','Кішка-корова','Мобільність спини','mat','beginner',['На четвереньках плавно округли спину.','Потім м’яко перейди до зворотного руху.'],'Без різких прогинів.','cat cow stretch exercise'),
 E('thoracic-rotation','Повороти грудного відділу','Мобільність грудної клітки','mat','beginner',['На четвереньках поклади руку біля потилиці.','Повертай грудну клітку повільно, не рухаючи тазом.'],'Не форсуй амплітуду.','quadruped thoracic rotation'),
 E('hamstring-stretch','М’яка розтяжка задньої поверхні стегна','Мобільність ніг','mat','beginner',['Ляж на спину, підніми ногу з трохи зігнутим коліном.','Тримай легке натягнення без болю.'],'Уникай пружинних рухів.','supine hamstring stretch'),
 E('breathing','Спокійне дихання','Відновлення','bodyweight','beginner',['Сядь зручно, розслаб плечі.','Дихай спокійно, без затримок.'],'Зупини вправу при дискомфорті.','relaxed breathing exercise')
];
const S=(id:string,sets:number,reps:string,rest:number):RoutineStep=>({id,sets,reps,rest});
const R=(title:string,duration:number,kind:Routine['kind'],steps:RoutineStep[]):Routine=>({title,duration,kind,steps});
export const programs:FitnessProgram[]=[
 {id:'home-base',name:'Домашній старт',tag:'STARTER',description:'М’який силовий старт без тренажерів. Основи рухів, кор і відновлення.',goal:'general',level:'beginner',days:3,gear:['bodyweight','mat'],routines:[
 R('Усе тіло A',30,'strength',[S('chair-squat',3,'8–12',75),S('wall-pushup',3,'8–12',75),S('glute-bridge',3,'10–12',60),S('dead-bug',2,'8/сторона',45)]),
 R('Усе тіло B',30,'strength',[S('lunge',2,'8/нога',75),S('bird-dog',3,'8/сторона',45),S('knee-pushup',2,'6–10',75),S('calf-raise',3,'12–15',45)]),
 R('Рухливість + кор',25,'mobility',[S('cat-cow',2,'8',30),S('hip-hinge',3,'10',45),S('plank',3,'15–30 с',45),S('hamstring-stretch',2,'30 с/нога',30)])]},
 {id:'home-strength',name:'Сила вдома',tag:'STRENGTH',description:'Прогресія сили з доступним інвентарем і достатнім відновленням.',goal:'muscle',level:'intermediate',days:4,gear:['dumbbells','mat'],routines:[
 R('Ноги',45,'strength',[S('dumbbell-squat',3,'8–12',90),S('dumbbell-rdl',3,'8–12',90),S('lunge',3,'8/нога',75),S('calf-raise',3,'15',45)]),
 R('Верх',45,'strength',[S('dumbbell-row',3,'10/рука',90),S('dumbbell-press',3,'8–12',90),S('dumbbell-ohp',2,'8–10',90),S('dumbbell-curl',2,'12',60)]),
 R('Ноги + кор',40,'strength',[S('dumbbell-squat',3,'10',90),S('glute-bridge',3,'15',60),S('dead-bug',3,'10/сторона',45)]),
 R('Верх + постава',40,'strength',[S('dumbbell-row',3,'10',90),S('pushup',3,'6–12',90),S('side-plank',2,'20 с/сторона',45)])]},
 {id:'tread-fit',name:'Доріжка + сила',tag:'HOME CARDIO',description:'Поєднання ходьби на доріжці й базової силової підготовки.',goal:'loss',level:'beginner',days:4,gear:['treadmill','mat'],routines:[
 R('Ходьба у комфортному темпі',30,'cardio',[S('tread-walk',1,'25–30 хв',0)]),
 R('Силове A',30,'strength',[S('squat',3,'10',60),S('wall-pushup',3,'10',60),S('glute-bridge',3,'12',60),S('plank',2,'20 с',45)]),
 R('Кардіо + рухливість',35,'cardio',[S('tread-walk',1,'25 хв',0),S('cat-cow',2,'8',30),S('hip-hinge',2,'10',30)]),
 R('Силове B',30,'strength',[S('lunge',2,'8/нога',60),S('bird-dog',3,'8/сторона',45),S('knee-pushup',3,'8',60)])]},
 {id:'mobility',name:'Рухливість і відновлення',tag:'RECOVERY',description:'Спокійні заняття для гнучкості, контролю рухів і відпочинку.',goal:'any',level:'beginner',days:3,gear:['mat'],routines:[
 R('Спина й таз',20,'mobility',[S('cat-cow',2,'8',20),S('hip-hinge',2,'10',30),S('bird-dog',2,'8/сторона',30)]),
 R('Ноги та баланс',20,'mobility',[S('hamstring-stretch',2,'25 с/сторона',20),S('calf-raise',2,'12',20),S('glute-bridge',2,'10',30)]),
 R('Спокійний рух',20,'mobility',[S('march',1,'10 хв',0),S('thoracic-rotation',2,'8/сторона',30),S('breathing',1,'3 хв',0)])]},
 {id:'football-condition',name:'Футбольна функціоналка',tag:'ATHLETIC',description:'Оригінальна програма на витривалість, баланс і силу ніг; це не офіційна програма футболіста.',goal:'endurance',level:'intermediate',days:4,gear:['bodyweight','mat'],routines:[
 R('Сила ніг',40,'strength',[S('squat',3,'12',75),S('lunge',3,'10/нога',75),S('calf-raise',3,'15',45),S('plank',3,'30 с',45)]),
 R('Стабілізація',30,'strength',[S('bird-dog',3,'10',40),S('glute-bridge',3,'12',45),S('side-plank',3,'20 с/сторона',45)]),
 R('Помірне кардіо',30,'cardio',[S('march',1,'20 хв',0),S('cat-cow',2,'10',30)]),
 R('Функціональне коло',35,'strength',[S('squat',3,'12',60),S('knee-pushup',3,'10',60),S('mountain-climber',3,'20 с',60)])]},
 {id:'bands',name:'Еспандери: усе тіло',tag:'BANDS',description:'Доступні силові заняття зі стрічкою для домашніх умов.',goal:'muscle',level:'beginner',days:3,gear:['bands'],routines:[
 R('Верх тіла',30,'strength',[S('band-row',3,'12',60),S('band-pull-apart',3,'12',45),S('wall-pushup',3,'10',60)]),
 R('Ноги й кор',30,'strength',[S('squat',3,'12',60),S('lunge',2,'8/нога',60),S('dead-bug',3,'8/сторона',45)]),
 R('Комбіноване',30,'strength',[S('band-row',3,'12',60),S('glute-bridge',3,'12',60),S('plank',3,'20 с',45)])]},
 {id:'short-20',name:'20 хвилин для себе',tag:'TIME SAVER',description:'Короткі та реалістичні заняття, якщо мало вільного часу.',goal:'general',level:'beginner',days:4,gear:['bodyweight'],routines:[
 R('Коротка сила A',20,'strength',[S('chair-squat',2,'12',45),S('wall-pushup',2,'10',45),S('dead-bug',2,'8',30)]),
 R('Легке кардіо',20,'cardio',[S('march',1,'15 хв',0),S('breathing',1,'3 хв',0)]),
 R('Коротка сила B',20,'strength',[S('lunge',2,'8/нога',45),S('glute-bridge',2,'12',45),S('bird-dog',2,'8',30)]),
 R('Рухливість',20,'mobility',[S('cat-cow',2,'8',30),S('thoracic-rotation',2,'8',30),S('hamstring-stretch',2,'30 с',20)])]},
 {id:'endurance',name:'Витривалість без спринтів',tag:'ENDURANCE',description:'Розумне нарощування активності та контрольовані кардіосесії.',goal:'endurance',level:'beginner',days:4,gear:['treadmill'],routines:[
 R('Ходьба I',25,'cardio',[S('tread-walk',1,'20–25 хв',0)]),
 R('Кор і ноги',25,'strength',[S('squat',2,'10',60),S('glute-bridge',2,'12',60),S('bird-dog',2,'8',40)]),
 R('Ходьба II',30,'cardio',[S('tread-walk',1,'25–30 хв',0)]),
 R('Легке тренування',25,'mobility',[S('march',1,'12 хв',0),S('cat-cow',2,'8',30),S('hamstring-stretch',2,'30 с',30)])]}
];
export function localISO(d:Date){return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');}
export function addDays(date:string,offset:number){const d=new Date(date+'T12:00:00');d.setDate(d.getDate()+offset);return localISO(d);}
export function monday(date:string){const d=new Date(date+'T12:00:00');return addDays(date,-((d.getDay()+6)%7));}
export function applicable(program:FitnessProgram,equipment:string){
 const gear=equipment.toLowerCase();
 return program.gear.every(g=>g==='bodyweight'||(g==='mat'&&(/килим|мат|mat/.test(gear)||true))||(g==='dumbbells'&&/гантел|dumbbell/.test(gear))||(g==='bands'&&/резин|еспандер|стріч|band/.test(gear))||(g==='treadmill'&&/доріж|tread|fitshow/.test(gear))||(g==='chair'&&/стілець|chair/.test(gear)));
}
export function safeRoutine(r:Routine,equipment:string):Routine{
 const available=(id:string)=>{const e=exercises.find(v=>v.id===id);return !e||e.gear==='bodyweight'||e.gear==='mat'||(e.gear==='dumbbells'&&/гантел|dumbbell/i.test(equipment))||(e.gear==='bands'&&/еспандер|резин|стріч|band/i.test(equipment))||(e.gear==='treadmill'&&/доріж|tread|fitshow/i.test(equipment))||(e.gear==='chair'&&/стілець|chair/i.test(equipment));};
 const fallback:Record<string,string>={'dumbbell-squat':'squat','dumbbell-rdl':'hip-hinge','dumbbell-row':'bird-dog','dumbbell-press':'wall-pushup','dumbbell-ohp':'wall-pushup','dumbbell-curl':'wall-pushup','band-row':'bird-dog','band-pull-apart':'bird-dog','tread-walk':'march','tread-intervals':'march','chair-squat':'squat','step-up':'lunge'};
 return {...r,steps:r.steps.map(s=>available(s.id)?s:{...s,id:fallback[s.id]||'march'})};
}
export function routineText(r:Routine){return r.steps.map(s=>{const e=exercises.find(v=>v.id===s.id);return (e?.title||s.id)+': '+s.sets+' підх. × '+s.reps+(s.rest?' · відпочинок '+s.rest+' с':'');}).join('\n');}
export function weeklySchedule(program:FitnessProgram,start:string,days:number,equipment:string){
 const count=Math.min(Math.max(1,days),5,program.routines.length);
 const indices=count===1?[0]:Array.from({length:count},(_,i)=>Math.round(i*6/(count-1)));
 return indices.map((n,i)=>({date:addDays(start,n),routine:safeRoutine(program.routines[i],equipment)}));
}
