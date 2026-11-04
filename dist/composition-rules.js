/* Authored scene rules. Coordinates are in the source S artwork's units.
   L uses the same scene grammar with a 2x coordinate reference. */
(function(root,factory){const value=factory(typeof module==="object"&&module.exports?require("./interaction-registry.js"):root.InteractionRegistry);if(typeof module==="object"&&module.exports)module.exports=value;else root.CompositionRules=value})(typeof globalThis!=="undefined"?globalThis:this,function(registry){
"use strict";
const depth={folder:10,flowers:15,book:20,phone:30,wallet:35,headphones:40,lamp:50,puzzle:60,pen:70,coin:80};
const defaults={
 book:[520,630],lamp:[1030,390],phone:[1160,790],headphones:[240,290],
 pen:[830,850],folder:[420,910],coin:[1230,960],wallet:[1320,570],
 puzzle:[860,180],flowers:[1360,220]
};
const tallDefaults={
 book:[550,1040],lamp:[920,520],phone:[1020,1110],headphones:[250,450],
 pen:[810,1380],folder:[450,1320],coin:[1140,1400],wallet:[1050,780],
 puzzle:[600,200],flowers:[1130,230]
};
const recipes=[
 {id:"study",name:"Учёба и идеи",description:"Книга — основа сцены; лампа и ручка дополняют рабочее место.",
  words:["свет","знан","обуч","учеб","учит","чтен","читат","идея","идеи","идею","вдохнов","понят","объясн","разобрат"],
  affinity:{book:6,lamp:6,pen:2,headphones:1},
  main:["book","lamp"],support:["lamp","headphones","pen","flowers"],
  positions:{book:[520,630],lamp:[1030,390],pen:[820,800],phone:[1180,770],headphones:[250,280],flowers:[1320,250]},
  tall:{book:[560,1030],lamp:[920,530],pen:[840,1320],phone:[1040,1030],headphones:[250,410],flowers:[1100,210]},
  background:{book:[520,630],lamp:[1080,360],headphones:[210,270],pen:[1050,810],flowers:[1320,210],phone:[1260,750]}},
 {id:"online",name:"Онлайн-обучение",description:"Телефон рядом с книгой; наушники поддерживают цифровой учебный контекст.",
  words:["онлайн","online","приложен","цифров","технолог","интернет","мобильн"],
  affinity:{phone:6,book:5,headphones:2,puzzle:1},
  main:["phone","book"],support:["headphones","lamp"],
  positions:{book:[530,660],phone:[1010,530],headphones:[270,240],lamp:[1390,380],puzzle:[1000,230],pen:[850,900]},
  tall:{book:[580,1060],phone:[920,630],headphones:[290,280],lamp:[1300,750],puzzle:[920,270]},
  background:{headphones:[260,230],lamp:[1330,340],book:[520,670],phone:[1050,400]}},
 {id:"finance",name:"Личные финансы",description:"Кошелёк задаёт тему, монета находится на переднем плане.",
  words:["финанс","бюджет","расход","деньг","безопас","защит","накоп","оплат","платеж","сбереж","ценност"],
  affinity:{wallet:7,coin:7,phone:2,folder:1},
  main:["wallet","coin"],support:["phone","folder","wallet"],
  positions:{wallet:[720,610],coin:[930,730],phone:[430,280],folder:[340,620],pen:[1090,430]},
  tall:{wallet:[650,1010],coin:[890,1170],phone:[470,460],folder:[430,800],pen:[1090,800]},
  background:{phone:[420,270],folder:[320,570],wallet:[680,390],coin:[1020,400]}},
 {id:"work",name:"Документы и планы",description:"Папка и ручка лежат рядом; лампа дополняет рабочее место.",
  words:["план","поряд","организац","хранен","оформлен","документ","работ","рабоч","письм","замет","подпис","состав"],
  affinity:{folder:7,pen:6,lamp:2,phone:1,book:1},
  main:["folder","pen"],support:["lamp","phone","book"],
  positions:{folder:[590,680],pen:[800,740],lamp:[1150,320],phone:[1050,770],book:[290,350],coin:[1120,930]},
  tall:{folder:[570,1050],pen:[760,1140],lamp:[950,420],phone:[1050,850],book:[300,550]},
  background:{lamp:[1150,300],phone:[1100,740],book:[280,320],folder:[570,680]}},
 {id:"audio",name:"Музыка и аудио",description:"Наушники — главный предмет; телефон рядом, дополнительные объекты остаются позади.",
  words:["музык","аудио","слуш","подкаст","концентрац","звук","вниман"],
  affinity:{headphones:7,phone:4,book:1,flowers:1},
  main:["headphones"],support:["flowers","phone","book"],
  positions:{headphones:[610,620],phone:[1060,580],flowers:[270,240],book:[420,900],lamp:[1220,230]},
  tall:{headphones:[580,1000],phone:[950,680],flowers:[310,280],book:[500,1330],lamp:[1240,280]},
  background:{flowers:[260,230],book:[420,880],phone:[1050,450],lamp:[1240,240]}},
 {id:"team",name:"Совместное решение",description:"Пазл — смысловой акцент; телефон и книга создают дополнительный контекст.",
  words:["решен","решаем","задач","вместе","команд","сотруднич","объедин","сложн","недоста"],
  affinity:{puzzle:9,phone:2,book:1},
  main:["puzzle"],support:["book","pen","phone"],
  positions:{puzzle:[900,440],phone:[680,680],book:[350,400],pen:[1050,900],lamp:[1310,350]},
  tall:{puzzle:[850,420],phone:[650,850],book:[330,1170],pen:[1050,1140]},
  background:{book:[330,410],pen:[1110,900],phone:[690,690],lamp:[1300,350]}},
 {id:"care",name:"Забота и подарки",description:"Цветы — центральный образ. Остальные предметы добавляются только по запросу.",
  words:["забот","уют","подар","весн","благополуч","рост"],
  affinity:{flowers:9,wallet:1},
  main:["flowers"],support:[],
  positions:{flowers:[700,580],book:[230,770],phone:[1190,720],wallet:[1130,350],lamp:[1280,270],pen:[920,970]},
  tall:{flowers:[650,850],book:[320,1350],phone:[1050,1200],wallet:[1020,400]},
  background:{}}
];
const relations=[
 {back:"book",front:"lamp",allRoles:true,lockPlacement:true,side:"left",text:"Слева направо: сначала лампа, затем книга. Предметы стоят раздельно."},
 {back:"book",front:"pen",text:"Ручка справа от книги, ближе к зрителю."},
 {back:"book",front:"phone",text:"Телефон перед книгой."},
 {back:"folder",front:"pen",text:"Ручка справа от документов, ближе к зрителю."},
 {back:"folder",front:"wallet",text:"Кошелёк перед документами."},
 {back:"wallet",front:"coin",text:"Монета перед кошельком."},
 {back:"phone",front:"puzzle",text:"Пазл перед телефоном."}
];
// Approved by the reference sheet: flat objects can rest on a book. These
// are authored attachment slots, not general permission to intersect boxes.
const focusDefaults={study:"book",online:"phone",finance:"wallet",work:"folder",audio:"headphones",team:"puzzle",care:"flowers"};
const focusWords={coin:["накоп","сбереж","безопас","защит"],lamp:["идея","идеи","идею","озарен","ясно"],pen:["письм","замет","подпис"],phone:["онлайн","online","цифров","мобильн"]};
return {version:7,clearance:24,groundClearance:24,depth,defaults,tallDefaults,recipes,relations,contacts:registry.supports,registry,focusDefaults,focusWords};
});
