/* Art-direction decisions. Geometry is always copied from the supplied SVGs.
   Unlisted pairs are separate; an unreviewed proposal never enables contact. */
(function(root,factory){const value=factory();if(typeof module==="object"&&module.exports)module.exports=value;else root.InteractionRegistry=value})(typeof globalThis!=="undefined"?globalThis:this,function(){
"use strict";
const subjects=["book","phone","puzzle","coin","headphones","lamp","flowers","wallet","folder","pen"];
// Physical behavior is independent of main/background color presentation.
const physicalGroups={surfaces:["book","folder"],portable:["phone","puzzle","coin","pen","wallet"],independent:["headphones"],standing:["lamp","flowers"]};
function physicalClass(id){return Object.keys(physicalGroups).find(key=>physicalGroups[key].includes(id))||null}
const supports=[
 {id:"book-phone",back:"book",front:"phone",basis:"reference",anchors:[[.20,-.18],[.16,-.22],[.24,-.13]],text:"Телефон на странице книги"},
 {id:"book-puzzle",back:"book",front:"puzzle",basis:"reference",anchors:[[.06,-.22],[.18,-.16],[-.18,.10]],text:"Пазл на странице книги"},
 {id:"book-coin",back:"book",front:"coin",basis:"visual-review",anchors:[[.23,-.10],[-.24,.10],[.13,-.21]],text:"Монета на странице книги"},
 {id:"book-pen",back:"book",front:"pen",basis:"visual-review",anchors:[[.11,-.18],[-.22,.12],[.08,-.13]],text:"Ручка на странице книги"},
 {id:"book-wallet",back:"book",front:"wallet",basis:"visual-review",anchors:[[.19,-.15],[-.19,.12],[.24,-.08]],text:"Кошелёк на странице книги"},
 {id:"folder-phone",back:"folder",front:"phone",basis:"visual-review",anchors:[[0,.04],[.06,.01],[-.06,.06]],text:"Телефон на папке"},
 {id:"folder-puzzle",back:"folder",front:"puzzle",basis:"visual-review",anchors:[[.02,-.04],[-.10,.02],[.08,-.08]],text:"Пазл на папке"},
 {id:"folder-coin",back:"folder",front:"coin",basis:"visual-review",anchors:[[.16,.12],[-.14,.14],[.02,.02]],text:"Монета на папке"},
 {id:"folder-pen",back:"folder",front:"pen",basis:"visual-review",anchors:[[0,-.10],[-.12,-.15],[.10,-.18]],text:"Ручка на папке"},
 {id:"folder-wallet",back:"folder",front:"wallet",basis:"visual-review",anchors:[[.06,.01],[-.06,.04],[.08,-.07]],text:"Кошелёк на папке"}
].map(r=>({...r,reviewed:true,baseRoles:["main","background"],childRoles:["main"],sizes:["S","L"],orientation:"matched",zoneRadius:.028}));
const protectedRegions={
 book:{name:"Страницы и переплёт",rect:[.08,.12,.81,.67],optical:[.47,.45]},
 phone:{name:"Экран телефона",rect:[.10,.12,.69,.66],optical:[.45,.43]},
 puzzle:{name:"Силуэт пазла",rect:[.05,.08,.77,.74],optical:[.43,.43]},
 coin:{name:"Знак на монете",rect:[.08,.09,.60,.65],optical:[.38,.40]},
 headphones:{name:"Дужка и чашки",rect:[.10,.09,.73,.72],optical:[.46,.47]},
 lamp:{name:"Плафон и основание",rect:[.05,.04,.80,.86],optical:[.47,.40]},
 flowers:{name:"Цветы и ваза",rect:[.06,.04,.74,.83],optical:[.44,.43]},
 wallet:{name:"Корпус и застёжка",rect:[.06,.07,.75,.72],optical:[.43,.43]},
 folder:{name:"Лицевая плоскость папки",rect:[.07,.10,.77,.72],optical:[.46,.46]},
 pen:{name:"Корпус, колпачок и наконечник ручки",rect:[.02,.02,.96,.96],optical:[.46,.45]}
};
// Authored composition grammar, not a universal claim about physical objects.
// Each pair has an explicit side/vertical alternative. A valid support contact
// overrides separate placement; its child inherits the parent group's position.
const objectRules={
 book:{kind:"surface",canRestOn:[],text:"Опора для плоских предметов. Не ставится на лампу или вазу."},
 folder:{kind:"surface",canRestOn:[],text:"Опора для плоских предметов. Рядом с книгой, без наложения."},
 phone:{kind:"flat",canRestOn:["book","folder"],text:"На странице или папке; иначе справа либо ниже опоры."},
 puzzle:{kind:"flat",canRestOn:["book","folder"],text:"На странице или папке; отдельно — справа либо выше телефона."},
 coin:{kind:"flat",canRestOn:["book","folder"],text:"На опоре или рядом с кошельком справа / снизу."},
 pen:{kind:"flat",canRestOn:["book","folder"],text:"На странице или папке; отдельно — справа / снизу от них."},
 wallet:{kind:"flat",canRestOn:["book","folder"],text:"На опоре или перед ней справа / снизу; монета рядом."},
 headphones:{kind:"flat",canRestOn:[],text:"Лежат отдельно; телефон справа / снизу, ваза слева / сверху."},
 lamp:{kind:"standing",canRestOn:[],text:"Стоит отдельно слева от книги. Основание не стоит на книге; книгу не перекрывает."},
 flowers:{kind:"standing",canRestOn:[],text:"Ваза стоит отдельно слева / сверху от плоских предметов; на книгу не ставится."}
};
const spatialOrder=["flowers","lamp","headphones","book","folder","phone","wallet","puzzle","pen","coin"];
const verticalOrder=["flowers","puzzle","lamp","headphones","phone","book","folder","wallet","coin","pen"];
const opposite={left:"right",right:"left",above:"below",below:"above"};
const directionNames={left:"слева",right:"справа",above:"сверху",below:"снизу"};
const pairOverrides={
 "lamp:book":{allowed:["right"],grounded:true},
 "lamp:folder":{allowed:["right"]},
 "lamp:phone":{allowed:["right"]},
 "lamp:pen":{allowed:["right"]},
 "book:folder":{allowed:["right","below"]},
 "book:phone":{allowed:["right","below"]},
 "book:puzzle":{allowed:["right","above"]},
 "book:pen":{allowed:["right","below"]},
 "book:wallet":{allowed:["right","below"]},
 "book:coin":{allowed:["right","below"]},
 "folder:pen":{allowed:["right","below"]},
 "folder:wallet":{allowed:["right","below"]},
 "folder:phone":{allowed:["right","below"]},
 "folder:puzzle":{allowed:["right","above"]},
 "folder:coin":{allowed:["right","below"]},
 "wallet:coin":{allowed:["right","below"]},
 "phone:puzzle":{allowed:["right","above"]},
 "headphones:phone":{allowed:["right","below"]}
};
const spatialPairs=[];
for(let i=0;i<spatialOrder.length;i++)for(let j=i+1;j<spatialOrder.length;j++){
 const base=spatialOrder[i],target=spatialOrder[j],vertical=verticalOrder.indexOf(target)>verticalOrder.indexOf(base)?"below":"above";
 spatialPairs.push({id:base+"-"+target,base,target,allowed:["right",vertical],basis:"authored",...pairOverrides[base+":"+target]});
}
function placement(base,target){
 if(base===target)return {base,target,allowed:["left","right","above","below"],text:"Повторы размещаются раздельно",basis:"authored"};
 const rule=spatialPairs.find(r=>r.base===base&&r.target===target||r.base===target&&r.target===base);
 if(!rule)throw new Error("Нет правила размещения для пары "+base+" / "+target);
 const reverse=rule.base!==base,allowed=reverse?rule.allowed.map(d=>opposite[d]):rule.allowed;
 return {...rule,base,target,allowed,grounded:rule.grounded&&!reverse,text:allowed.map(d=>directionNames[d]).join(" или "),on:supports.some(r=>r.back===base&&r.front===target)};
}
function decision(back,front){
 const rule=supports.find(r=>r.back===back&&r.front===front);
 return rule?{status:rule.reviewed?"supported":"proposal",rule}: {status:"separate",reason:back===front?"Для повторов этого предмета наложение не настроено":"Проверенная опорная поверхность для этой пары не задана"};
}
const matrix=subjects.flatMap(back=>subjects.map(front=>({back,front,...decision(back,front)})));
return {version:3,subjects,supports,protectedRegions,matrix,decision,objectRules,spatialOrder,spatialPairs,placement,physicalGroups,physicalClass};
});
