// Copies Del's creator from the Project store into ./creator and patches the copy so it
// runs inside SillyTavern. The source files are never modified.
//   node build.mjs [sourceDir]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_SRC = 'C:\\Users\\Dastardly\\AppData\\Local\\Cursor\\AgentStores\\cursor_agent_stores\\bc-e5571c28-4223-412e-beae-7e7799322c5e\\files\\inbox\\claude-characters';
const src = process.argv[2] || DEFAULT_SRC;
const out = path.join(here, 'creator');
const COPY = ['slavemaker.js', 'pet.js', 'passives.json', 'card.json', 'redz.webp'];

fs.mkdirSync(out, { recursive: true });
for (const f of COPY) {
    const from = path.join(src, f);
    if (fs.existsSync(from)) fs.copyFileSync(from, path.join(out, f));
    else console.warn(`missing (skipped): ${f}`);
}

let html = fs.readFileSync(path.join(src, 'index.html'), 'utf8');

function patch(find, replace, label) {
    const i = html.indexOf(find);
    if (i < 0) throw new Error(`patch "${label}" failed: anchor not found`);
    if (html.indexOf(find, i + find.length) >= 0) throw new Error(`patch "${label}" failed: anchor not unique`);
    html = html.slice(0, i) + replace + html.slice(i + find.length);
}

// The shim must run before any of the creator's scripts.
patch('<meta charset=utf8>', '<meta charset=utf8><script src="../shim.js"></script>', 'shim');

// Hand the host the few closure-scoped functions it needs (export + open a card).
// Arrow wrappers so a renamed function only fails when used, never at boot.
patch(
    'window.__cardHost={',
    'try{window.__stcc&&window.__stcc.hook({' +
        'exportJson:()=>exportJson(),' +
        'activeId:()=>activeId,' +
        'cardName:()=>(card&&card.data&&card.data.name)||"",' +
        'portrait:()=>{try{return cs().portrait||""}catch(e){return ""}},' +
        'listChars:()=>{const out=[];const seen=new Set();' +
            'const add=(id,name,portrait,stAvatar,cardJson)=>{if(!id||seen.has(id))return;seen.add(id);out.push({id,name:name||"",portrait:portrait||"",stAvatar:stAvatar||"",cardJson:cardJson||""})};' +
            'Object.entries(CHARS||{}).forEach(([id,x])=>{let stA="",raw=x&&x.card||"";' +
                'try{stA=((JSON.parse(raw).data.extensions||{}).companion_stage||{}).stAvatar||""}catch(e){}' +
                'add(id,x&&x.name,x&&x.portrait,stA,raw)});' +
            'if(card){let stA="";try{stA=(cs().stAvatar)||""}catch(e){}' +
                'add(activeId,card.data&&card.data.name,cs().portrait||"",stA,JSON.stringify(card))}' +
            'return out},' +
        'peekCardJson:(id)=>{id=String(id||"");' +
            'if(id&&id===activeId&&card)return JSON.stringify(card);' +
            'try{return(CHARS[id]&&CHARS[id].card)||""}catch(e){return""}},' +
        'stampStAvatar:(avatar)=>{try{if(!card)return false;cs().stAvatar=String(avatar||"");CHARS[activeId]=charDoc();try{renderCharMenu()}catch(e){}return true}catch(e){return false}},' +
        'forgetChar:(id)=>{id=String(id||"");if(!id||id==="redz"||id===activeId)return false;delete CHARS[id];try{localStorage.removeItem(draftKey(id))}catch(e){}try{if(tagDb)tagDb.doc("cards/"+id).delete()}catch(e){}try{renderCharMenu()}catch(e){}return true},' +
        'loadCard:(id,c)=>{try{stashDraft()}catch(e){}putOnCard(id,c);try{applyKindScopes()}catch(e){}saved="";CHARS[id]=charDoc();try{renderCharMenu()}catch(e){}try{syncViews()}catch(e){}return saveChar()},' +
        'elfheimGet:()=>{try{if(!card)return null;const st=cs();return {id:activeId,name:(card.data&&card.data.name)||"",portrait:st.portrait||"",stAvatar:st.stAvatar||"",profile:Object.assign({},st.profile||{}),elfheim:st.elfheim?JSON.parse(JSON.stringify(st.elfheim)):null}}catch(e){return null}},' +
        'elfheimApply:(patch)=>{try{if(!card||!patch)return false;checkpoint();const st=cs();const p=st.profile=st.profile||{};const keys=["rpg_mode","dnd_race","dnd_class","dnd_sub","dnd_level","dnd_bg","dnd_align","dnd_str","dnd_dex","dnd_con","dnd_int","dnd_wis","dnd_cha","dnd_hp","dnd_ac","dnd_speed","dnd_skills","dnd_feats","dnd_spells","dnd_gear"];if(patch.profile&&typeof patch.profile==="object")keys.forEach(k=>{if(patch.profile[k]!==undefined)p[k]=patch.profile[k]});if(patch.rpg_mode)p.rpg_mode=patch.rpg_mode;if(patch.elfheim&&typeof patch.elfheim==="object")st.elfheim=JSON.parse(JSON.stringify(patch.elfheim));if(patch.name)card.data.name=String(patch.name).slice(0,80);if(patch.portrait)st.portrait=String(patch.portrait);if(patch.addRpg){st.kinds=Array.isArray(st.kinds)&&st.kinds.length?st.kinds:["companion"];if(!st.kinds.includes("rpg"))st.kinds.push("rpg")}try{stashDraft()}catch(e){}try{saveChar()}catch(e){}try{render()}catch(e){}return true}catch(e){return false}}}' +
    ')}catch(e){console.warn("[card creator] host hook failed",e)}' +
    'window.__cardHost={',
    'hook',
);

fs.writeFileSync(path.join(out, 'index.html'), html, 'utf8');
console.log(`built ${path.join(out, 'index.html')} (${html.length} chars)`);
