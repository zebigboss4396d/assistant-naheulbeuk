// Les chiffres portant un astérisque ou une condition appartiennent à un jet/situation.
// Ils figurent dans la colonne de l'objet, mais ne changent pas les valeurs permanentes.
export const EFFECT_KEYS=['COU','INT','CHA','AD','FOR','AT','PRD'];
const EMPTY=()=>Object.fromEntries(EFFECT_KEYS.map(k=>[k,0]));
const keyOf={FO:'FOR',FOR:'FOR',COU:'COU',INT:'INT',CHA:'CHA',AD:'AD',AT:'AT',PRD:'PRD'};
export function parseEquipmentEffect(item){
 const notes=String(item.notes||'');const mods=EMPTY(),terms=[];
 const expression=/\b(AT\s*\/\s*PRD|COU|INT|CHA|AD|FOR|FO|AT|PRD)\s*([+−-])\s*(\d+)(\*)?/g;
 for(const match of notes.matchAll(expression)){
  const context=notes.slice(Math.max(0,match.index-17),match.index);
  const tail=notes.slice(match.index+match[0].length);
  const dwarf=/\bNain\s*:\s*$/i.test(context),exceptDwarf=/\(sauf Nain\)/i.test(tail.slice(0,20));
  const situational=Boolean(match[4]||/^\s*\((?!sauf Nain\))/.test(tail)||/\b(contre|porteur|sort|combat)\s*$/i.test(context));
  const value=Number(match[3])*(match[2]==='+'?1:-1);
  const keys=match[1].replace(/\s/g,'')==='AT/PRD'?['AT','PRD']:[keyOf[match[1]]];
  const permanent=!situational&&(!dwarf||item.dwarf===true)&&(!exceptDwarf||item.dwarf!==true);
  for(const key of keys)if(permanent)mods[key]+=value;
  terms.push({label:match[0],keys,value,permanent,situational,dwarf,exceptDwarf});
 }
 const rupture=notes.match(/\b(\d+)\s*à\s*(\d+)\s*$/);
 const first=notes.split(' · ')[0];const damage=/^\s*(?:\d+D(?:\s*[+−-]\s*\d+)?(?:\s*\/\s*\d+D(?:\s*[+−-]\s*\d+)?)?|\d+\s*\+\s*poison)\b/i.exec(first);
 return {mods,terms,summary:terms.map(t=>t.label).join(' · '),rupture:rupture?`${rupture[1]} à ${rupture[2]}`:'',damage:damage?.[0]?.trim()||''};
}
export function armorLocations(item){
 const label=String(item.name||'').toLocaleLowerCase('fr');
 if(/bouclier/.test(label))return ['bouclier'];
 if(/set d.armure|set armure|armure complète|toutes local/.test(label))return ['tête','torse','bras','mains','jambes','pieds'];
 if(/casque|heaume|chapeau|calotte|couronne|toque|coiffe|capuche|tête/.test(label))return ['tête'];
 if(/botte|chauss|chausson|pieds/.test(label))return ['pieds'];
 if(/gant|gantelet|mains/.test(label))return ['mains'];
 if(/jambe|jambi|pantalon/.test(label))return ['jambes'];
 if(/bras|brassière/.test(label))return ['bras'];
 if(/avec manches|cotte de maille.*manches|robe|tunique/.test(label))return ['torse','bras'];
 return ['torse'];
}
export function defaultArmorIndices(armor){
 const occupied=new Set(),chosen=[];
 armor.forEach((item,index)=>{const loc=armorLocations(item);if(loc.every(k=>!occupied.has(k))){chosen.push(index);loc.forEach(k=>occupied.add(k));}});
 return chosen;
}
export function computeEquipmentEffects(data,selectedWeapon=0,worn=defaultArmorIndices(data.equipment.armor)){
 const weapons=data.equipment.weapons,armor=data.equipment.armor;
 const weapon=weapons[selectedWeapon]||null,selected=worn.map(i=>armor[i]).filter(Boolean);
 const occupied=new Map(),conflicts=[];
 for(const item of selected)for(const loc of armorLocations(item)){
  if(occupied.has(loc))conflicts.push(`${loc} : ${occupied.get(loc)} / ${item.name}`);
  else occupied.set(loc,item.name);
 }
 const dwarf=/^Nain(?: de la mafia)?$/.test(data.origin||'');const modifiers=EMPTY(),perItem=new Map();
 for(const item of [...weapons,...armor])perItem.set(item,parseEquipmentEffect({...item,dwarf}));
 for(const item of [...selected,...(weapon?[weapon]:[])])for(const key of EFFECT_KEYS)modifiers[key]+=perItem.get(item).mods[key];
 const altered=Object.fromEntries(['COU','INT','CHA','AD','FOR'].map(k=>[k,data.stats[k]+modifiers[k]]));
 const attack=Number(data.at)+modifiers.AT,parry=Number(data.prd)+modifiers.PRD;
 const basePr=selected.reduce((total,i)=>total+(Number.isInteger(Number(i.pr))?Number(i.pr):0),0);
 const unknownPr=selected.filter(i=>i.pr===undefined||i.pr===null);
 return {weapon,selected,selectedWeapon,worn,modifiers,altered,attack,parry,basePr,unknownPr,conflicts,perItem};
}
