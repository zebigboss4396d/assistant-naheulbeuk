import {ORDER,origins,beasts,jobs,isEligible,compatible} from './data.js';
import {SENSES,WARRIOR_TECHNIQUES,isWarrior,isEngineer,isMerchant,isRanger,needsMagic,needsDeity,adjustedValues,perception} from './creation-rules.js';
import {ORIGIN_DETAILS,BEAST_DETAILS,JOB_DETAILS} from './creation-details.js';
import {MAGIC_DISCIPLINES,PRIEST_DEITIES,PALADIN_DEITIES,DIVINE_DETAILS} from './affiliations.js';

const $=s=>document.querySelector(s);
const skillData=await fetch('./skills.json').then(r=>r.json());
const hints=await fetch('./skill-hints.json').then(r=>r.json());
const generic=await fetch('./generic-skills.json').then(r=>r.json());
const labels=['Derniers ajustements','Compétences de niveau 1','Spécialité ou divinité','Fortune et destin','Identité et pré-fiche'];
const stored=JSON.parse(sessionStorage.getItem('naheul-selection')||'null');
const expanded=origins.flatMap(o=>o.beast?beasts.map((b,i)=>({...o,name:`Homme-bête · ${b.name}`,ev:b.ev,beastDelta:b.delta,beastIndex:i+1})):o);
const origin=expanded.find(o=>o.name===stored?.origin);
const job=jobs.find(j=>j.name===stored?.job)||null;
const validStats=stored?.stats&&ORDER.every(k=>Number.isInteger(stored.stats[k]));
if(!origin||!validStats||stored.job&&!job){
 $('.wizard-layout').innerHTML='<section class="wizard-card"><h2>Aucun archétype sélectionné</h2><p>Commencez par choisir une origine et un métier parmi vos tirages.</p><a class="primary continue-link" href="index.html">Revenir aux tirages</a></section>';
 $('.wizard-nav').hidden=true;
}else{
 const base={...stored.stats};
 if(origin.beastDelta)for(const [key,delta] of Object.entries(origin.beastDelta))base[key]+=delta;
 const previous=JSON.parse(sessionStorage.getItem('naheul-draft')||'null');
 const signature=JSON.stringify(stored);
 const draft=previous?.signature===signature?previous:{signature,step:0,choices:{},skills:[],gold:'',destiny:'',deity:'',magic:'',name:'',sex:''};
 let step=Math.min(4,Math.max(0,Number(draft.step)||0));
 const clean=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const key=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]/g,'').toLowerCase();
 const unique=names=>[...new Map(names.map(s=>[key(s),s])).values()];
 const statsHtml=s=>ORDER.map(k=>`<span>${k} <strong>${s[k]}</strong></span>`).join('');
 const val=()=>adjustedValues(base,origin,job,draft.choices,draft.magic);
 const save=()=>{draft.step=step;sessionStorage.setItem('naheul-draft',JSON.stringify(draft));};
 const select=(id,label,options,value,placeholder='Choisissez…')=>`<label class="wizard-field">${clean(label)}<select id="${id}"><option value="">${clean(placeholder)}</option>${options.map(([v,t])=>`<option value="${clean(v)}" ${value===v?'selected':''}>${clean(t)}</option>`).join('')}</select></label>`;
 const choices=(arr)=>arr.map(n=>[n,n]);
 const numeric=(v)=>v===''?'À tirer':v;
 function sourceSkills(){
  const o=skillData[origin.beastDelta?'Homme-bête':origin.name]||{born:[],choices:[]};
  const j=job?skillData[job.name]||{born:[],choices:[]}:{born:[],choices:[]};
  const born=unique([...o.born,...(BEAST_DETAILS[origin.name]?.born||[]),...j.born]);
  const skip=new Set(born.map(key));
  const exclude=list=>unique(list).filter(s=>!skip.has(key(s))&&key(s)!=='appeldusauvage'&&(!(job?.magic)||key(s)!=='tetevide'));
  const all=exclude(generic);
  if(origin.name==='Humain')return {born,groups:job?[{label:'Deux compétences du métier',quota:2,skills:exclude(job.name==='Sbire'?all:j.choices)},{label:'Une compétence générique',quota:1,skills:all}]:[{label:'Trois compétences génériques',quota:3,skills:all}]};
  if(origin.bundle)return {born,groups:[{label:'Compétences du profil',quota:2,skills:exclude(o.choices)}]};
  if(job?.name==='Sbire')return {born,groups:[{label:'Deux compétences au choix',quota:2,skills:exclude([...o.choices,...generic].filter(s=>!['chefdegroupe','chercherdesnoises'].includes(key(s))))}]};
  return {born,groups:[{label:'Deux compétences parmi l’origine et le métier',quota:2,skills:exclude([...o.choices,...j.choices])}]};
 }
 function selectedNames(){
  const groups=sourceSkills().groups;
  return draft.skills.map(token=>{const [group,id]=token.split(':');return groups[Number(group)]?.skills.find(s=>key(s)===id);}).filter(Boolean);
 }
 function fieldChoices(){
  const v=val(),out=[];
  if(isWarrior(job)){
   out.push(select('warriorBonus','Guerrier : attribuer le point gagné',choices(['AT','PRD']),draft.choices.warriorBonus));
   out.push(select('warriorTrade','Guerrier : échanger un point entre AT et PRD',[['aucun','Aucun échange'],['AT vers PRD','−1 AT / +1 PRD'],['PRD vers AT','−1 PRD / +1 AT']],draft.choices.warriorTrade,'Choisissez…'));
   out.push(select('warriorTechnique','Coup spécial hérité',choices(WARRIOR_TECHNIQUES),draft.choices.warriorTechnique));
  }
  if(isEngineer(job)||isMerchant(job)){
   out.push(`<div class="wizard-note">${isEngineer(job)?'Ingénieur':'Marchand'} : retirez 1 point d’AT ou de PRD pour augmenter une caractéristique de 1.</div>`);
   out.push(select('tradeFrom','Retirer 1 point de',choices(['AT','PRD']),draft.choices.tradeFrom));
   out.push(select('tradeTo','Ajouter 1 point à',choices(isEngineer(job)?['INT','AD']:['INT','CHA']),draft.choices.tradeTo));
  }
  if(isRanger(job)){
   out.push(select('rangerFrom','Ranger : retirer 1 point à une caractéristique',[['aucun','Aucun transfert'],...choices(ORDER)],draft.choices.rangerFrom,'Choisissez…'));
   if(draft.choices.rangerFrom&&draft.choices.rangerFrom!=='aucun')out.push(select('rangerTo','Ajouter ce point à une autre caractéristique',choices(ORDER.filter(k=>k!==draft.choices.rangerFrom)),draft.choices.rangerTo));
  }
  if(origin.name==='Ogre'){
   out.push('<p class="wizard-note">Ogre : convertissez au plus 3 points au total, pris en AT et/ou en PRD, en autant de dégâts de contact.</p>');
   out.push(select('ogreAt','Points retirés à l’AT',choices(['0','1','2','3']),String(draft.choices.ogreAt??'')));
   out.push(select('ogrePrd','Points retirés à la PRD',choices(['0','1','2','3']),String(draft.choices.ogrePrd??'')));
  }
  if(v.stats.AD>=13&&!job?.adIncluded)out.push(select('address','AD ≥ 13 : appliquer le bonus de +1 à',choices(['AT','PRD']),draft.choices.address));
  if(v.stats.AD<=8)out.push(select('address','AD ≤ 8 : appliquer le malus de −1 à',choices(['AT','PRD']),draft.choices.address));
  if(!out.length)out.push('<p class="wizard-note">Ce profil ne comporte aucun ajustement à choisir à la création.</p>');
  return out.join('');
 }
 function skillsQuestion(){
  const {born,groups}=sourceSkills();
  const duplicates=selectedNames();
  return `<p class="wizard-question-intro">Choisissez exactement ${groups.reduce((n,g)=>n+g.quota,0)} compétences supplémentaires. Les compétences de naissance sont déjà acquises.</p><p><strong>Acquises :</strong> ${born.map(clean).join(' · ')||'Aucune'}</p>${groups.map((g,i)=>`<h3>${clean(g.label)} <small>(${draft.skills.filter(token=>token.startsWith(i+':')).length}/${g.quota})</small></h3><div class="wizard-checks">${g.skills.map(n=>{const id=i+':'+key(n),isChecked=draft.skills.includes(id),hint=hints[n]||hints[n.toUpperCase()]||'';return `<label class="wizard-check ${isChecked?'chosen':''}"><input type="checkbox" data-skill="${clean(id)}" ${isChecked?'checked':''}><span><strong>${clean(n)}</strong>${hint?`<span class="skill-with-tip"><button type="button" class="skill-name skill-help" aria-label="${clean(n)} : ${clean(hint)}">ⓘ</button><span class="skill-tip" role="tooltip">${clean(hint)}</span></span>`:''}</span></label>`}).join('')}</div>`).join('')}${new Set(duplicates.map(key)).size!==duplicates.length?'<p class="wizard-note">Une compétence ne peut être choisie qu’une fois.</p>':''}`;
 }
 function affiliationQuestion(){
  if(!needsMagic(job)&&!needsDeity(job))return '<p class="wizard-note">Aucune spécialité magique ni divinité supplémentaire à choisir pour ce profil.</p>';
  const magic=needsMagic(job);
  const catalog=magic?MAGIC_DISCIPLINES:job.name==='Prêtre'?PRIEST_DEITIES:PALADIN_DEITIES;
  const current=magic?draft.magic:draft.deity;
  return `<p class="wizard-question-intro">${magic?'Choisissez une discipline de magie pour commencer votre carrière. Les sorts généralistes sont généralement accessibles en plus, sauf règles particulières.':'Choisissez une seule divinité. Les pouvoirs et obligations dépendent de son manuel.'}</p>${select('affiliation',magic?'Spécialité magique':'Divinité servie',catalog.map(x=>[x.name,x.name]),current)}${current?`<p class="wizard-note">${clean(catalog.find(x=>x.name===current)?.description||'')}</p>`:''}`;
 }
 function fortuneQuestion(){return `<p class="wizard-question-intro">Fortune : 2D6 × 10 PO. Destin : 1D4 − 1 PD. Vous pouvez saisir vos propres résultats ou lancer les dés ici.</p>${job?.name==='Bourgeois / Noble'?'<p class="wizard-note">Bourgeois / Noble : un second tirage de fortune s’ajoute au premier.</p>':''}${origin.name==='Semi-homme de la Loi'?'<p class="wizard-note">Votre fiche de supplément indique 300 PO de départ : ce montant est prérempli et reste modifiable si votre MJ applique une autre règle.</p>':''}<div class="wizard-field-row"><label class="wizard-field">Pièces d’or (PO)<input id="gold" type="number" min="0" step="1" inputmode="numeric" value="${clean(draft.gold)}"><small>La page 3 accorde un budget d’équipement égal à trois fois ce montant ; ces PO restent ensuite au personnage.</small></label><label class="wizard-field">Points de Destin (PD)<input id="destiny" type="number" min="0" max="3" step="1" inputmode="numeric" value="${clean(draft.destiny)}"><small>Résultat compris entre 0 et 3.</small></label></div><div class="roll-actions"><button type="button" data-roll="gold">Lancer les dés pour les PO</button><button type="button" data-roll="destiny">Lancer le D4 pour les PD</button></div>`}
 function senseTable(v){
  const p=perception(v.stats,origin);
  const status=x=>x===2?'Excellent':x===1?'Bon':x===-1?'Mauvais':'Normal';
  return `<h3>Perception et nyctalopie</h3><p>PERCEPTION de base : <strong>${p.base}</strong> (INT). Modificateurs des sens indiqués par l’origine :</p><table class="sensory-table"><thead><tr><th>Sens</th><th>Qualité</th><th>Épreuve</th></tr></thead><tbody>${[['Vue','vue',p.vue],['Odorat','odorat',p.odorat],['Ouïe','ouie',p.ouie]].map(([t,k,n])=>`<tr><td>${t}</td><td>${status(p.sense[k])}</td><td>${n}</td></tr>`).join('')}</tbody></table><p><strong>Très basse lumière :</strong> ${p.sense.nuit==='moyenne'?'nyctalopie « moyenne » citée dans la fiche d’origine ; correspondance à préciser avec le MJ (le tableau ne prévoit que partielle ou totale).':`${p.sense.nuit==='totale'?'Nyctalopie totale':p.sense.nuit==='partielle'?'Nyctalopie partielle':'Aucune nyctalopie'} : ${p.lowlight} pour une épreuve basée sur INT, avant le modificateur du sens concerné.`}</p><details><summary>Règles des deux tableaux de perception</summary><p>Sens mauvais : INT −1 ; normal : INT ; bon : INT +1 ; excellent : INT +2. Très basse lumière : aucune nyctalopie : INT / 2, arrondie au supérieur ; partielle : INT −4 ; totale : aucun malus. Un modificateur lié à un sens peut se cumuler avec la nyctalopie si le contexte le permet.</p></details>`;
 }
 function sheet(full=false){
  const v=val(),{born}=sourceSkills(),skills=selectedNames();
  const identity=full?`<p><strong>${clean(draft.name||'Nom à renseigner')}</strong> · ${clean(draft.sex||'Sexe non précisé')}</p>`:'';
  const stats=`<div class="stat-strip">${statsHtml(v.stats)}</div><div class="value-grid"><span><small>AT</small><strong>${v.at}</strong></span><span><small>PRD</small><strong>${v.prd}</strong></span><span><small>EV</small><strong>${v.ev??'—'}</strong></span><span><small>EA</small><strong>${v.ea??'—'}</strong></span><span><small>PO</small><strong>${numeric(draft.gold)}</strong></span><span><small>PD</small><strong>${numeric(draft.destiny)}</strong></span></div><div class="derived-grid"><span>MAGPHYS <strong>${v.magphys}</strong></span><span>MAGPSY <strong>${v.magpsy}</strong></span><span>RESMAG <strong>${v.resmag}</strong></span></div><p><strong>ESQUIVE :</strong> ${v.esquive} (AD avant équipement) · <strong>INGE :</strong> ${v.inge} · <strong>PRES :</strong> ${v.pres} · <strong>PERC :</strong> ${v.perc}.</p><p><strong>Impact :</strong> ${v.impact>=0?'+':''}${v.impact} ${v.impactExtra?'(dont +'+v.impactExtra+' converti par l’Ogre)':''} · <strong>Bonus de dégâts des sorts :</strong> +${v.spell} si applicable.</p>`;
  if(!full)return `<p class="eyebrow">APERÇU EN DIRECT</p><h2>${clean(origin.name)}</h2><p>${clean(job?.name|| (origin.bundle?'Profil complet':'Sans métier'))} · ${clean(stored.label)}</p>${stats}<p><strong>Compétences supplémentaires :</strong> ${skills.map(clean).join(' · ')||'à choisir'}</p>`;
  const options=[...Object.entries(draft.choices).filter(([k,v])=>v!==''&&v!=='aucun'&&v!=='0'&&v!=null).map(([k,v])=>`${({warriorBonus:'Bonus guerrier',warriorTrade:'Transfert guerrier',warriorTechnique:'Coup spécial',tradeFrom:'Point retiré à',tradeTo:'Point ajouté à',rangerFrom:'Ranger : retrait à',rangerTo:'Ranger : ajout à',ogreAt:'Ogre : points retirés à l’AT',ogrePrd:'Ogre : points retirés à la PRD',address:'Bonus/malus d’Adresse sur'})[k]||k} : ${v}`)];
  const notes=[origin.note,job?.note,...(ORIGIN_DETAILS[origin.beastDelta?'Homme-bête':origin.name]||[]),...(BEAST_DETAILS[origin.name]?.notes||[]),...(JOB_DETAILS[job?.name]||[])].filter(Boolean);
  const affiliation=needsMagic(job)?draft.magic:needsDeity(job)?draft.deity:'';
  const divine=needsDeity(job)?DIVINE_DETAILS[`${job.name}:${draft.deity}`]||[]:[];
  const magicNote=needsMagic(job)?MAGIC_DISCIPLINES.find(x=>x.name===draft.magic)?.description:null;
  return `<article class="final-sheet"><h3>Personnage de niveau 1</h3>${identity}<p><strong>Origine :</strong> ${clean(origin.name)}<br><strong>Métier :</strong> ${clean(job?.name|| (origin.bundle?'Inclus dans le profil':'Sans métier'))}<br><strong>Répartition :</strong> ${clean(stored.label)}</p>${stats}<h3>Ajustements retenus</h3>${options.length?`<ul>${options.map(n=>`<li>${clean(n)}</li>`).join('')}</ul>`:'<p>Aucun ajustement facultatif appliqué.</p>'}<h3>Compétences acquises</h3><p>${born.map(clean).join(' · ')||'Aucune compétence de naissance'}</p><h3>Compétences choisies</h3><p>${skills.map(clean).join(' · ')||'À choisir'}</p>${affiliation?`<p><strong>${needsMagic(job)?'Spécialité magique':'Divinité'} :</strong> ${clean(affiliation)}.</p>`:''}<h3>Avantages et restrictions</h3><ul>${[...notes,...divine,...(magicNote?[magicNote]:[])].map(n=>`<li>${clean(n)}</li>`).join('')||'<li>Voir la fiche de profil.</li>'}</ul>${senseTable(v)}</article>`;
 }
 function question(){
  const content=[fieldChoices,skillsQuestion,affiliationQuestion,fortuneQuestion,()=>`<p class="wizard-question-intro">Indiquez le nom et le sexe du personnage, puis vérifiez sa pré-fiche avant de poursuivre.</p><div class="wizard-field-row"><label class="wizard-field">Nom du personnage<input id="character-name" type="text" maxlength="90" autocomplete="off" value="${clean(draft.name)}" placeholder="Nom du personnage"></label>${select('character-sex','Sexe',[['Féminin','Féminin'],['Masculin','Masculin'],['Autre','Autre'],['Non précisé','Non précisé']],draft.sex)}</div>${sheet(true)}`][step]();
  return `<p class="eyebrow">QUESTION ${step+1} SUR ${labels.length}</p><h2>${labels[step]}</h2>${content}<div class="wizard-actions"><button type="button" class="back" id="wizard-back">${step?'← Question précédente':'← Changer d’archétype'}</button><button type="button" class="next" id="wizard-next">${step===labels.length-1?'Valider et passer à l’équipement →':'Continuer →'}</button></div>`;
 }
 function render(){save();$('#wizard-question').innerHTML=question();$('#wizard-preview').innerHTML=sheet();$('#wizard-progress').textContent=`${step+1} / ${labels.length} · ${labels[step]}`;$('#wizard-error').hidden=true;}
 function error(message){$('#wizard-error').textContent=message;$('#wizard-error').hidden=false;$('#wizard-error').scrollIntoView({behavior:'smooth',block:'center'});}
 function check(){
  if(step===0){
   if(isWarrior(job)&&(!draft.choices.warriorBonus||!draft.choices.warriorTrade||!draft.choices.warriorTechnique))return 'Terminez les trois choix du guerrier.';
   if((isEngineer(job)||isMerchant(job))&&(!draft.choices.tradeFrom||!draft.choices.tradeTo))return 'Choisissez les deux parties du transfert de point.';
   if(isRanger(job)&&!draft.choices.rangerFrom)return 'Indiquez si le Ranger transfère un point.';
   if(isRanger(job)&&draft.choices.rangerFrom!=='aucun'&&!draft.choices.rangerTo)return 'Choisissez la caractéristique qui reçoit le point du Ranger.';
   if(origin.name==='Ogre'&&(draft.choices.ogreAt==null||draft.choices.ogreAt===''||draft.choices.ogrePrd==null||draft.choices.ogrePrd===''))return 'Indiquez les points retirés à l’AT et à la PRD de l’Ogre.';
   if(origin.name==='Ogre'&&Number(draft.choices.ogreAt)+Number(draft.choices.ogrePrd)>3)return 'L’Ogre ne peut convertir que 3 points au total.';
   const v=val();if(((v.stats.AD>=13&&!job?.adIncluded)||v.stats.AD<=8)&&!draft.choices.address)return 'Choisissez où appliquer le bonus ou le malus d’Adresse.';
  }
  if(step===1){
   const groups=sourceSkills().groups,seen=new Set();
   for(const [index,g] of groups.entries()){const ids=draft.skills.filter(token=>token.startsWith(index+':')&&g.skills.some(s=>key(s)===token.split(':')[1]));if(ids.length!==g.quota)return `Choisissez ${g.quota} compétence${g.quota>1?'s':''} dans « ${g.label} ». `;for(const token of ids){const id=token.split(':')[1];if(seen.has(id))return 'Une compétence ne peut pas être choisie deux fois.';seen.add(id);}}
   if(seen.size!==draft.skills.length)return 'Supprimez les choix qui ne figurent plus dans la liste.';
  }
  if(step===2){
   if(needsMagic(job)&&!MAGIC_DISCIPLINES.some(x=>x.name===draft.magic))return 'Choisissez une spécialité magique dans la liste.';
   if(needsDeity(job)&&!(job.name==='Prêtre'?PRIEST_DEITIES:PALADIN_DEITIES).some(x=>x.name===draft.deity))return 'Choisissez une divinité dans la liste.';
  }
  if(step===3){if(draft.gold===''||!Number.isInteger(Number(draft.gold))||Number(draft.gold)<0)return 'Indiquez un montant de pièces d’or entier et positif.';if(draft.destiny===''||!Number.isInteger(Number(draft.destiny))||Number(draft.destiny)<0||Number(draft.destiny)>3)return 'Indiquez un nombre de Points de Destin de 0 à 3.';}
  if(step===4&&!draft.name.trim())return 'Indiquez le nom du personnage.';
  if(step===4&&!draft.sex)return 'Indiquez le sexe du personnage ou choisissez « Non précisé ».';
  return '';
 }
 const die=n=>{if(!globalThis.crypto?.getRandomValues)return Math.floor(Math.random()*n)+1;const a=new Uint8Array(1),limit=Math.floor(256/n)*n;do{crypto.getRandomValues(a);}while(a[0]>=limit);return a[0]%n+1;};
 if(origin.name==='Semi-homme de la Loi'&&draft.gold==='')draft.gold='300';
 $('#wizard-question').addEventListener('change',event=>{
  const {id}=event.target;
  if(event.target.dataset.skill){const k=event.target.dataset.skill;draft.skills=event.target.checked?unique([...draft.skills,k]):draft.skills.filter(s=>s!==k);render();return;}
  if(['gold','destiny','character-name','character-sex','affiliation'].includes(id)){
   if(id==='affiliation'){if(needsMagic(job))draft.magic=event.target.value;else draft.deity=event.target.value;render();}
   if(id==='character-sex'){draft.sex=event.target.value;save();$('#wizard-preview').innerHTML=sheet();$('#wizard-question .final-sheet').outerHTML=sheet(true);}
   return;
  }
  draft.choices[id]=event.target.value;
  if(id==='rangerFrom')draft.choices.rangerTo='';
  render();
 });
 $('#wizard-question').addEventListener('input',event=>{
  const map={gold:'gold',destiny:'destiny','character-name':'name','character-sex':'sex',affiliation:needsMagic(job)?'magic':'deity'};
  if(map[event.target.id]){draft[map[event.target.id]]=event.target.value;save();$('#wizard-preview').innerHTML=sheet();if(step===4&&$('#wizard-question .final-sheet'))$('#wizard-question .final-sheet').outerHTML=sheet(true);}
 });
 $('#wizard-question').addEventListener('click',event=>{
  const roll=event.target.closest('[data-roll]');if(roll){if(roll.dataset.roll==='gold')draft.gold=String((die(6)+die(6)+(job?.name==='Bourgeois / Noble'?die(6)+die(6):0))*10);else draft.destiny=String(die(4)-1);render();return;}
  if(event.target.closest('#wizard-back')){if(step)step--;else{location.href='index.html';return;}render();return;}
  if(event.target.closest('#wizard-next')){const problem=check();if(problem){error(problem);return;}if(step<labels.length-1){step++;render();window.scrollTo({top:0,behavior:'smooth'});return;}
   const v=val();sessionStorage.setItem('naheul-character',JSON.stringify({name:draft.name.trim(),sex:draft.sex,origin:origin.name,job:job?.name||null,stats:v.stats,at:v.at,prd:v.prd,ev:v.ev,ea:v.ea,gold:Number(draft.gold),destiny:Number(draft.destiny),skills:selectedNames(),affiliation:needsMagic(job)?draft.magic:needsDeity(job)?draft.deity:'',affiliationNote:needsMagic(job)?MAGIC_DISCIPLINES.find(x=>x.name===draft.magic)?.description||'':needsDeity(job)?(DIVINE_DETAILS[`${job.name}:${draft.deity}`]||[]).join(' · '):'',creationNotes:[origin.note,job?.note].filter(Boolean),allocation:stored.label||'',choices:draft.choices}));location.href='equipement.html';
  }
 });
 $('#preview-toggle').addEventListener('click',()=>{const open=$('.wizard-layout').classList.toggle('preview-open');$('#preview-toggle').setAttribute('aria-expanded',String(open));$('#preview-toggle').textContent=open?'Masquer la pré-fiche ↑':'Afficher la pré-fiche du personnage ↓';if(open)$('#wizard-preview').scrollIntoView({behavior:'smooth',block:'start'});});
 render();
}
