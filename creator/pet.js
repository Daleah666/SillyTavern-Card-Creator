/* 🐾 pet.js · a drop-in desktop pet for any claude.ai artifact page (My Hub first). One line installs her:
     <script src="pet.js" data-name="Redz" data-img="redz.webp" data-who="redz" defer></script>
   She lives in her own shadow root, keeps her settings in localStorage "pet-js-<who>", shares her phrasebook,
   reminders and notes through the artifact database (data-prefix="creator_" inside My Hub) and reaches the platform
   only through window.claude.use(...). Missing pieces degrade: no AI → canned lines, no db → localStorage.
   Everything is in card/PET_INSTALL.md. */
(()=>{"use strict";
const SCRIPT=document.currentScript||[...document.querySelectorAll('script[src*="pet.js"]')].pop(),A=n=>((SCRIPT&&SCRIPT.getAttribute("data-"+n))||"").trim();
const slug=s=>String(s||"").toLowerCase().replace(/[^a-z0-9_-]+/g,"-").replace(/^-+|-+$/g,"").slice(0,60);
const NAME=A("name").slice(0,40)||"Pet",WHO=slug(A("who"))||slug(NAME)||"pet",IMG=A("img"),P=A("prefix").replace(/[^A-Za-z0-9_.~:@+-]/g,"").slice(0,40),PERSONA=A("persona").slice(0,700),SIZE=Math.max(80,Math.min(320,+A("size")||150)),REM_OFF=/^(off|no|false|0)$/i.test(A("reminders"));/* data-reminders="off": the host fires due reminders itself (My Hub's 🔔); her reminder tools still work */
const REG=(window.petJs&&typeof window.petJs==="object")?window.petJs:(window.petJs={});if(REG[WHO])return;REG[WHO]={booting:true};

/* 🧰 helpers */
const PATH={lines:P+"petlines/"+WHO,you:P+"state/you",lore:P+"lorebooks/lb-redz-rules",rem:P+"state/reminders",notes:P+"petnotes/"+WHO};
const iso=()=>new Date().toISOString(),clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),rnd=a=>a[Math.floor(Math.random()*a.length)],clone=o=>o==null?o:JSON.parse(JSON.stringify(o));
const esc=t=>String(t??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])),acts=t=>esc(t).replace(/\*([^*\n]+)\*/g,"<em>*$1*</em>");
const plain=t=>String(t||"").replace(/\*[^*]*\*/g," ").replace(/[\u{1F000}-\u{1FAFF}☀-➿️]/gu,"").replace(/\s+/g," ").trim();
const warn=(...a)=>{try{console.warn("[pet.js]",...a)}catch(e){}};
const lsGet=k=>{try{return JSON.parse(localStorage.getItem(k)||"null")}catch(e){return null}},lsSet=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
const fill=t=>String(t||"").replace(/\{name\}/g,NAME).replace(/\{user\}/g,"you");
const when=ms=>{const d=new Date(ms),t=d.toLocaleTimeString([],{hour:"numeric",minute:"2-digit"});return d.toDateString()===new Date().toDateString()?"today "+t:d.toLocaleDateString([],{weekday:"short",month:"short",day:"numeric"})+" "+t};
const localISO=()=>{const d=new Date(),o=-d.getTimezoneOffset(),p=n=>String(Math.floor(Math.abs(n))).padStart(2,"0");return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:00${o>=0?"+":"-"}${p(o/60)}:${p(o%60)}`};
const isVid=u=>/\.(mp4|webm|mov|m4v|ogv)(\?|#|$)/i.test(u)||/^data:video\//i.test(u);
const sameOrigin=u=>{try{const x=new URL(u,location.href);return x.protocol==="data:"||x.protocol==="blob:"||x.origin===location.origin}catch(e){return false}};

/* ⚙ settings and her local state, per browser: localStorage "pet-js-<who>" */
const KEY="pet-js-"+WHO,DEF={width:"normal",logH:280,font:14,glass:.84,accent:"#ff6fae",you:"#7a5cff",side:"auto",avatars:true,stamps:false,len:"chatty",speak:false,speakBub:false,voice:"",rate:1,pitch:1.1,vol:1,lines:true,smart:true};
const ST=Object.assign({pos:null,hidden:false,emo:null,chat:[],tried:0},lsGet(KEY)||{});ST.set=Object.assign({},DEF,ST.set||{});if(!Array.isArray(ST.chat))ST.chat=[];
let stT=0;const saveST=()=>{clearTimeout(stT);stT=setTimeout(()=>lsSet(KEY,{set:ST.set,pos:ST.pos,hidden:ST.hidden,emo:ST.emo,chat:ST.chat.slice(-30),tried:ST.tried}),250)};
const WIDTHS={narrow:270,normal:340,wide:460},LEN={short:40,chatty:120,long:250};

/* 🌡 emotion gauge: six families (warm, hot, soft, curious, sharp, cool), moved by chat moods, headpats and being ignored, drifting back every minute */
const FAM=[["warm","😊","Warm","Happy","#f6c66d"],["hot","😏","Hot","Flirty","#ff7cbf"],["soft","🥺","Soft","Shy","#c9a3ff"],["curious","🤔","Curious","Curious","#8be6c9"],["sharp","😤","Sharp","Annoyed","#ff9090"],["cool","😶","Cool","Lonely","#86e3ef"]];
const MOODS={warm:"Happy Delighted Affectionate Playful Flirty Smug Proud Grateful Tender Giddy Content Hopeful",cool:"Calm Bored Tired Distant Thoughtful Wistful Lonely",sharp:"Annoyed Angry Jealous Bratty Defiant Disgusted Bitter",soft:"Shy Nervous Flustered Embarrassed Anxious Guilty Sad Hurt Melancholy Homesick",hot:"Lustful Needy Teasing Possessive Hungry",curious:"Curious Surprised Confused Mischievous Awed Suspicious"};
const HINT={warm:/happ|smil|laugh|cheer|joy|giggl|sweet|love/,cool:/calm|bor|tire|yawn|sleep|still|rest|lone/,sharp:/ang|annoy|pout|glare|huff|mad|grump|irrit/,soft:/shy|nerv|blush|flust|embarr|timid|sad|hurt/,hot:/flirt|horn|teas|wink|need|lust|bite|sultr/,curious:/curi|confus|surpri|tilt|mischie|wonder|intrig/};
const ALLMOODS=Object.values(MOODS).join(" ").split(" "),BASE={warm:30,hot:12,soft:15,curious:12,sharp:9,cool:28};
function famOf(w){w=String(w||"").trim().toLowerCase();if(!w)return null;if(BASE[w]!=null)return w;for(const f in MOODS)if(MOODS[f].toLowerCase().split(" ").includes(w))return f;for(const f in HINT)if(HINT[f].test(w))return f;return null}
const emo=()=>{if(!ST.emo||!ST.emo.v)ST.emo={v:Object.assign({},BASE),mood:"",at:Date.now()};return ST.emo};
const topFam=()=>{const v=emo().v;return FAM.reduce((b,[k])=>(v[k]||0)>(v[b]||0)?k:b,"warm")};
const moodWord=()=>{const e=emo(),f=topFam(),w=e.mood&&famOf(e.mood)===f?e.mood:FAM.find(x=>x[0]===f)[3];return w.charAt(0).toUpperCase()+w.slice(1)};
const emoLine=()=>`${moodWord()} (${FAM.map(([k,,l])=>l.toLowerCase()+" "+Math.round(emo().v[k]||0)).join(", ")})`;
function feel(word,amt){const f=famOf(word);if(!f)return false;const e=emo();e.v[f]=clamp((e.v[f]||0)+amt,0,100);if(amt>0)FAM.forEach(([k])=>{if(k!==f)e.v[k]=Math.max(0,(e.v[k]||0)-amt*.25)});if(BASE[String(word).toLowerCase()]==null)e.mood=String(word).trim().slice(0,20);e.at=Date.now();saveST();emoApply();return true}
function drift(){const e=emo();FAM.forEach(([k])=>{e.v[k]=Math.round(((e.v[k]||0)+(BASE[k]-(e.v[k]||0))*.08)*10)/10});saveST();emoApply()}

/* 🔌 platform: capabilities resolve lazily after first paint, and any of them may be null */
let DB=null,SAMPLE=null,MCP=null,TOOLS=null,WEB=null,pSample=null;
const use=n=>{try{const C=window.claude;if(!C||typeof C.use!=="function")return Promise.resolve(null);return Promise.race([Promise.resolve(C.use(n)).catch(()=>null),new Promise(r=>setTimeout(()=>r(null),12000))])}catch(e){return Promise.resolve(null)}};

/* 🗄 store: the artifact database when there is one, else this browser's localStorage under "pet-js-db:<path>" */
const store={
  async get(p){if(DB){try{const s=await DB.doc(p).get();return s&&s.exists?clone(s.data()):null}catch(e){warn("read failed",p,e&&e.code)}}return lsGet("pet-js-db:"+p)},
  /* for read-modify-write: a failed read throws instead of falling back, so a near-empty doc never overwrites the real one */
  async getStrict(p){if(DB){const s=await DB.doc(p).get();return s&&s.exists?clone(s.data()):null}return lsGet("pet-js-db:"+p)},
  async set(p,d){if(DB){try{await DB.doc(p).set(d);return "db"}catch(e){warn("write failed, kept in this browser",p,e&&e.code)}}lsSet("pet-js-db:"+p,d);return "local"},
  watch(p,cb){if(DB){try{return DB.doc(p).onSnapshot(s=>{try{cb(s&&s.exists?clone(s.data()):null)}catch(e){warn(e)}},e=>warn("watch stopped",p,e&&e.code))}catch(e){warn(e)}}cb(lsGet("pet-js-db:"+p));return()=>{}}};

/* 📒 phrasebook shared with the card: <prefix>petlines/<who> = {items:[{id,t,kind,score,said,last,by,at}],curated,updated} */
const KINDS=["hello","idle","attention","pat","cursor","agent","night","morning","love"];
const SEED=[["hello","*pops onto the window* Hi you. Missed me?"],["hello","There you are. I was starting to think you forgot about me."],["hello","*waves both hands* Hey, cutie. What are we doing today?"],
  ["idle","*stretches out along the edge of the screen* Mmm, comfy."],["idle","*hums to herself and swings her legs*"],["idle","I'm keeping an eye on things for you. Very official."],["idle","*peeks at what you're doing* Ooh, looks important."],
  ["attention","Hey. Hey. {name} is right here."],["attention","*taps the glass* Hellooo?"],["attention","You've gone quiet. Suspiciously quiet."],
  ["pat","*leans into your hand* Mmm, again."],["pat","*melts a little* Okay, you're forgiven for everything."],["cursor","*eyes follow your cursor*"],["cursor","*bats at your cursor* Got it! …no I didn't."],
  ["agent","*sends a tiny drone off* On it."],["agent","*cracks her knuckles* Leave it to me."],["night","It's late… stay up with me a little? Or sleep, I'll guard the screen."],
  ["morning","*yawns* Morning, you. Coffee first, then me."],["love","*whispers* I really like being your little companion, you know."],["love","You're my favourite person to bother."]];
let BOOK={items:[],curated:null,updated:null},bookReady=false,metaDirty=false,dirty=new Map(),gone=new Set(),bookT=0,bookChain=Promise.resolve(),curating=false;
const lineId=()=>"l"+Date.now().toString(36)+Math.random().toString(36).slice(2,6),norm=t=>String(t||"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const mkLine=(t,kind,by,score)=>({id:lineId(),t:String(t).trim().slice(0,200),kind:KINDS.includes(kind)?kind:"idle",score:clamp(+score||0,-2,5),said:0,last:null,by,at:iso()});
const active=()=>BOOK.items.filter(x=>(+x.score||0)>-2);
function bookNorm(d){return {items:(d&&Array.isArray(d.items)?d.items:[]).filter(x=>x&&x.id&&x.t).map(x=>Object.assign({said:0,last:null,by:"seed",at:null},x,{score:clamp(+x.score||0,-2,5),kind:KINDS.includes(x.kind)?x.kind:"idle"})),curated:d&&d.curated||null,updated:d&&d.updated||null}}
function bookMerge(remote){const b=bookNorm(remote),m=new Map(b.items.map(x=>[x.id,x]));gone.forEach(id=>m.delete(id));dirty.forEach((x,id)=>m.set(id,x));
  const seen=new Set(),keep=[];[...m.values()].sort((a,c)=>(dirty.has(a.id)&&!b.items.some(r=>r.id===a.id))-(dirty.has(c.id)&&!b.items.some(r=>r.id===c.id))).forEach(x=>{const k=norm(x.t);if(!seen.has(k)){seen.add(k);keep.push(x)}});
  b.items=keep.sort((a,c)=>String(a.at||"").localeCompare(String(c.at||"")));if(BOOK.curated&&(!b.curated||BOOK.curated>b.curated))b.curated=BOOK.curated;return b}
const bookCap=items=>{if(items.length<=160)return items;const keep=new Set(items.slice().sort((a,c)=>((a.score<=-2)-(c.score<=-2))||(c.score-a.score)||String(c.at).localeCompare(String(a.at))).slice(0,160).map(x=>x.id));return items.filter(x=>keep.has(x.id))};
function touch(it,now){if(it)dirty.set(it.id,it);clearTimeout(bookT);bookT=setTimeout(bookSave,now?0:2500)}
function bookSave(){return bookChain=bookChain.then(async()=>{if(!dirty.size&&!gone.size&&!metaDirty)return;const remote=await store.getStrict(PATH.lines),b=bookMerge(remote);dirty=new Map();gone=new Set();metaDirty=false;
  b.items=bookCap(b.items);b.updated=iso();BOOK=b;await store.set(PATH.lines,{items:b.items,curated:b.curated,updated:b.updated});statsRender()}).catch(e=>warn("phrasebook save",e))}
async function bookLoad(){const d=await store.get(PATH.lines);BOOK=bookMerge(d);if(!BOOK.items.length){SEED.forEach(([k,t])=>{const it=mkLine(t,k,"seed",1);BOOK.items.push(it);dirty.set(it.id,it)});await bookSave()}
  bookReady=true;statsRender();store.watch(PATH.lines,r=>{if(r){BOOK=bookMerge(r);statsRender()}});autoCurate()}
/* 🎲 picking a line: by kind, weighted by score, skipping retired ones and anything said in the last 10 minutes */
function pick(kind,must){const t=Date.now(),src=bookReady?BOOK.items:SEED.map(([k,x],i)=>({id:"seed"+i,t:x,kind:k,score:1,said:0,last:null,by:"seed",tmp:true}));
  let L=src.filter(x=>x.kind===kind&&(+x.score||0)>-2);if(!L.length&&kind!=="idle")return pick("idle",must);
  let F=L.filter(x=>!x.last||t-Date.parse(x.last)>6e5);if(!F.length){if(!must||!L.length)return null;F=[L.slice().sort((a,c)=>String(a.last).localeCompare(String(c.last)))[0]]}
  const W=F.map(x=>Math.max(.3,(+x.score||0)+2)),sum=W.reduce((a,c)=>a+c,0);let r=Math.random()*sum,it=F[F.length-1];for(let i=0;i<F.length;i++){r-=W[i];if(r<=0){it=F[i];break}}
  it.said=(+it.said||0)+1;it.last=iso();if(!it.tmp)touch(it);return it}
function rate(it,v){it.score=clamp((+it.score||0)+v,-2,5);touch(it);feel(v>0?"Proud":"Hurt",v>0?8:5);return it.score}

/* 🤖 curation: twelve new lines for her person, from your profile (never race), your lorebook rules, liked and disliked lines and the recent chat */
let ctxC=null;
async function context(){if(ctxC&&Date.now()-ctxC.at<3e5)return ctxC;const [you,lore]=await Promise.all([store.get(PATH.you),store.get(PATH.lore)]);
  const prof=["gender","look","job","age","from","vibe"].map(k=>{const v=you&&you[k];return (typeof v==="string"||typeof v==="number")&&String(v).trim()?`${k}: ${String(v).trim().slice(0,90)}`:""}).filter(Boolean);
  const rules=(lore&&Array.isArray(lore.entries)?lore.entries:[]).filter(e=>e&&e.on!==false&&e.content).map(e=>String(e.content).replace(/\s+/g," ").trim().slice(0,280)).slice(0,16);return ctxC={at:Date.now(),prof,rules}}
const RACE=/\b(race|racial|ethnic|ethnicity|skin colou?r)\b/i;
async function curate(manual){const S=await sampleReady();if(!S){if(manual)sys("🤖 Curating needs Claude on this page (the sample capability).");return {added:0,error:"no_ai"}}
  if(curating)return {added:0,error:"busy"};curating=true;busy(1);ST.tried=Date.now();saveST();
  try{const c=await context(),act=active(),liked=act.filter(x=>x.score>=2).sort((a,b)=>b.score-a.score).slice(0,12).map(x=>x.t),bad=BOOK.items.filter(x=>x.score<0).slice(-12).map(x=>x.t),have=act.slice(-30).map(x=>x.t),chat=CHAT.filter(m=>m.r!=="s").slice(-8).map(m=>(m.r==="u"?"User: ":NAME+": ")+String(m.t).slice(0,200));
    const pr=`You write the little speech-bubble lines (her phrasebook) for ${NAME}, a desktop pet who lives on the user's screen in an adult (21+) app. ${NAME} is an adult. ${PERSONA||PERSONA0}
Write 12 NEW lines personalised to her person, in her voice: short (under 22 words), *actions* in asterisks allowed, varied, warm and playful, never generic.
Kinds (use most of them, more idle, attention and love): hello (greeting), idle (musing while they work), attention (they've ignored her a while), pat (reaction to a headpat), cursor (their mouse pointer comes close), agent (she heads off to do a task for them), night (late at night), morning (good morning), love (sweet, affectionate).
${c.prof.length?"About her person (use lightly): "+c.prof.join("; ")+"\n":""}${c.rules.length?"Their preferences (follow these):\n- "+c.rules.join("\n- ")+"\n":""}${liked.length?"Lines they liked (copy this style):\n- "+liked.join("\n- ")+"\n":""}${bad.length?"Lines they disliked (avoid this style):\n- "+bad.join("\n- ")+"\n":""}${have.length?"Lines she already has (don't repeat):\n- "+have.join("\n- ")+"\n":""}${chat.length?"Recent chat:\n"+chat.join("\n")+"\n":""}Rules: everyone is an adult (21+); never mention race or ethnicity; no real people or celebrities.
Reply with only JSON: {"lines":[{"t":"...","kind":"idle"}]}`;
    const out=await S.json(pr,{cache:false,modelTier:"quick"}),L=Array.isArray(out)?out:(out&&Array.isArray(out.lines)?out.lines:[]),known=new Set(BOOK.items.map(x=>norm(x.t)));let added=0;
    L.slice(0,16).forEach(x=>{const t=String(x&&(x.t||x.text||x.line)||"").replace(/\s+/g," ").trim();if(!t||t.length>200||RACE.test(t)||known.has(norm(t)))return;known.add(norm(t));const it=mkLine(t,String(x.kind||"idle").toLowerCase(),"ai",0);BOOK.items.push(it);dirty.set(it.id,it);added++});
    BOOK.curated=iso();metaDirty=true;await bookSave();if(manual||added)sys(`🤖 Curated: ${added} new line${added===1?"":"s"} in her phrasebook.`);return {added}}
  catch(e){if(manual)sys("🤖 "+errText(e));return {added:0,error:e&&e.code||"failed"}}finally{curating=false;busy(-1)}}
function autoCurate(){const act=active().length,old=!BOOK.curated||Date.now()-Date.parse(BOOK.curated)>7*864e5;if(!(act<25||old)||Date.now()-(+ST.tried||0)<6*36e5)return;
  const go=()=>{if(document.hidden){document.addEventListener("visibilitychange",go,{once:true});return}setTimeout(async()=>{if(document.hidden){go();return}const S=await sampleReady();if(S&&!curating&&Date.now()-(+ST.tried||0)>=6*36e5)curate(false)},12000)};go()}

/* 🪟 her shadow root: nothing leaks in or out of it */
const PERSONA0="Playful, affectionate and a little teasing; loves headpats, hates being ignored, and is quietly devoted to her person.";
const CSS=`:host{all:initial}*{box-sizing:border-box}
.pet-root{font:var(--fs,14px)/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#f6f0ff;--accent:#ff6fae;--you:#7a5cff;--youfg:#fff;--glass:.84}
button,input,select{font:inherit;color:inherit}button{cursor:pointer;border:1px solid rgba(255,255,255,.18);background:rgba(22,18,32,.82);border-radius:999px;padding:2px 8px;line-height:1.35}button:hover{border-color:var(--accent)}
button[aria-pressed=true]{background:var(--accent);color:#1a0f1f;border-color:var(--accent)}:focus-visible{outline:2px solid var(--accent);outline-offset:1px}
.pet{position:fixed;right:16px;bottom:16px;width:var(--sz);display:flex;flex-direction:column;align-items:center;gap:3px;touch-action:none;user-select:none;-webkit-user-select:none;z-index:1}.pet[hidden],[hidden]{display:none!important}
.pet-body{position:relative;width:var(--sz);height:var(--sz);cursor:grab;border-radius:18px}.pet-body:active{cursor:grabbing}
.pet-body>img,.pet-body>video,.pet-body>canvas,.pet-body>svg{position:absolute;inset:0;width:100%;height:100%;display:block;object-fit:contain;object-position:center bottom;pointer-events:none;filter:drop-shadow(0 10px 16px rgba(0,0,0,.55)) drop-shadow(0 0 var(--aura-r,0px) var(--aura,transparent));transform:rotate(var(--lean,0deg));transition:transform .5s ease,filter .8s}
.pet-body>.pet-src{width:2px;height:2px;opacity:.01;inset:auto;left:0;top:0}
.pet.soft .pet-body>img,.pet.soft .pet-body>video{-webkit-mask-image:radial-gradient(ellipse 54% 56% at 50% 52%,#000 58%,transparent 100%);mask-image:radial-gradient(ellipse 54% 56% at 50% 52%,#000 58%,transparent 100%)}
.pet-bar{position:absolute;top:-4px;right:-6px;display:flex;gap:3px;opacity:.35;transition:opacity .2s;z-index:3}.pet:hover .pet-bar,.pet:focus-within .pet-bar{opacity:1}.pet-bar button{padding:0 6px;font-size:.78em}
.pet-light{position:absolute;left:-2px;top:-2px;z-index:3;display:flex;align-items:center;padding:3px 5px;border-radius:999px;background:rgba(14,12,22,.72);border:1px solid rgba(255,255,255,.14);font-size:.62em}.pet-light i{width:8px;height:8px;border-radius:50%;background:#6b6480}
.pet-light[data-state=idle]{opacity:.45}.pet-light[data-state=think] i{background:#ffd166;box-shadow:0 0 8px #ffd166;animation:pet-blink 1s ease-in-out infinite}.pet-light[data-state=agent] i{background:#b98bff;box-shadow:0 0 10px #b98bff;animation:pet-blink 1.6s ease-in-out infinite}
.pet-name{font-size:.72em;color:#e9defa;text-shadow:0 1px 3px #000;pointer-events:none}
.pet-emo{display:flex;align-items:center;gap:6px;padding:2px 8px;border-radius:999px;background:rgba(14,12,22,.72);border:1px solid rgba(255,255,255,.12);font-size:.68em;cursor:pointer}.pet-emo b{font-weight:600;white-space:nowrap}.pet-bars{display:flex;align-items:flex-end;gap:2px;height:13px}.pet-bars i{width:4px;height:var(--h);min-height:2px;border-radius:2px;background:var(--c)}
.pet-bub,.pet-note{position:fixed;z-index:4;width:max-content;max-width:min(260px,calc(100vw - 32px));padding:7px 11px;border-radius:14px;background:rgba(22,18,32,.94);border:1px solid var(--accent);font-size:.9em;box-shadow:0 10px 30px -12px rgba(0,0,0,.8);white-space:pre-wrap;overflow-wrap:anywhere}
.pet-bub.long{max-height:220px;overflow:auto}.pet-rate{position:absolute;top:-13px;right:8px;display:flex;gap:3px;opacity:0;transition:opacity .2s}.pet-rate button{padding:0 5px;font-size:.8em}.pet-bub:hover .pet-rate,.pet-bub:focus-within .pet-rate{opacity:1}@media (hover:none){.pet-rate{opacity:.85}}
.pet-note{max-width:min(290px,calc(100vw - 32px));display:flex;flex-direction:column;gap:6px}.pet-note p{margin:0}.pet-note small{opacity:.7}.pet-note div{display:flex;gap:4px;flex-wrap:wrap}
.pet-paw{position:fixed;bottom:10px;width:32px;height:32px;padding:0;border-radius:50%;opacity:.6;font-size:16px;z-index:1}.pet-paw:hover{opacity:1}
.pet-chat{position:fixed;z-index:3;display:flex;flex-direction:column;gap:6px;padding:8px;border-radius:16px;background:rgba(18,15,28,var(--glass));-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);border:1px solid var(--accent);box-shadow:0 18px 50px -16px rgba(0,0,0,.85)}
.pet-head{display:flex;align-items:center;gap:5px}.pet-head b{color:var(--accent);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pet-hmood{font-size:.75em;opacity:.8;white-space:nowrap}.pet-sp{flex:1}.pet-head button{padding:1px 6px;font-size:.85em}
.pet-log{max-height:var(--logh,280px);min-height:56px;overflow:auto;display:flex;flex-direction:column;gap:6px;overscroll-behavior:contain;padding-right:2px}
.pet-msg{display:flex;gap:6px;align-items:flex-end;max-width:94%}.pet-msg.c{align-self:flex-start}.pet-msg.u{align-self:flex-end;flex-direction:row-reverse}.pet-msg.s{align-self:center;font-size:.78em;opacity:.75;text-align:center}
.pet-tx{padding:6px 10px;border-radius:12px;white-space:pre-wrap;overflow-wrap:anywhere;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.1)}.pet-msg.u .pet-tx{background:var(--you);color:var(--youfg);border-color:transparent}.pet-wait .pet-tx{opacity:.65}
.pet-tx em{color:color-mix(in srgb,var(--accent) 55%,#fff);font-style:italic}.pet-msg.u .pet-tx em{color:inherit}
.pet-av{width:24px;height:24px;border-radius:50%;flex:none;object-fit:cover;background:color-mix(in srgb,var(--accent) 40%,#221a30);display:grid;place-items:center;font-size:11px;font-weight:700;overflow:hidden;color:#fff}.pet-av svg{width:100%;height:100%}.no-av .pet-av{display:none}
.pet-time{font-size:.7em;opacity:.55;margin-left:6px;white-space:nowrap}.no-time .pet-time{display:none}.pet-say{border:0;background:none;padding:0 0 0 6px;font-size:.85em;opacity:.6}.pet-say:hover{opacity:1}
.pet-in{display:flex;gap:4px}.pet-in input{flex:1;min-width:0;padding:5px 9px;border-radius:999px;border:1px solid rgba(255,255,255,.18);background:rgba(0,0,0,.3);outline:none}.pet-in input:focus{border-color:var(--accent)}.pet-in button{padding:3px 8px}
.pet-status{font-size:.74em;opacity:.75;min-height:1em}
.pet-set{display:grid;grid-template-columns:1fr 1fr;gap:6px 10px;max-height:min(340px,48vh);overflow:auto;padding:6px;border-radius:10px;background:rgba(0,0,0,.25);font-size:.85em}.pet-set label{display:flex;flex-direction:column;gap:2px}.pet-set label.ck{flex-direction:row;align-items:center;gap:6px}
.pet-set select,.pet-set input[type=range]{width:100%}.pet-set select{background:#1d1729;border:1px solid rgba(255,255,255,.18);border-radius:6px;padding:2px 4px}.pet-set input[type=color]{width:100%;height:24px;border:0;padding:0;background:none}.pet-set .full{grid-column:1/-1}.pet-set p{margin:4px 0 0;font-weight:600;color:var(--accent)}.pet-set .row{display:flex;gap:4px;flex-wrap:wrap}
.pet-heart{position:absolute;left:50%;top:30%;font-size:1.4em;pointer-events:none;animation:pet-heart 1.2s ease-out forwards;z-index:4}
.pet.emo-warm .pet-body{animation:pet-bob 3.2s ease-in-out infinite}.pet.emo-hot .pet-body{animation:pet-pulse 2.4s ease-in-out infinite}.pet.emo-soft .pet-body{animation:pet-shy 4s ease-in-out infinite}.pet.emo-sharp .pet-body{animation:pet-grr 5s ease-in-out infinite}.pet.emo-cool .pet-body{animation:pet-sway 7s ease-in-out infinite;opacity:.94}.pet.emo-curious .pet-body{animation:pet-tilt 4.5s ease-in-out infinite}
.pet.bug1 .pet-body,.pet.bug2 .pet-body{animation:pet-bounce .9s ease 2}.pet.bug3 .pet-body{animation:pet-shake .5s ease 4}
@keyframes pet-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}@keyframes pet-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.035)}}@keyframes pet-shy{0%,100%{transform:scale(.97)}50%{transform:scale(.95) translateY(2px)}}@keyframes pet-grr{0%,86%,100%{transform:translateX(0)}88%{transform:translateX(-4px)}91%{transform:translateX(4px)}94%{transform:translateX(-3px)}}
@keyframes pet-sway{0%,100%{transform:rotate(-1.5deg)}50%{transform:rotate(1.5deg)}}@keyframes pet-tilt{0%,70%,100%{transform:rotate(0)}80%{transform:rotate(6deg)}}@keyframes pet-heart{from{opacity:1;transform:translate(-50%,0) scale(.8)}to{opacity:0;transform:translate(-50%,-60px) scale(1.3)}}
@keyframes pet-bounce{0%,100%{transform:translateY(0)}30%{transform:translateY(-18px)}55%{transform:translateY(0)}75%{transform:translateY(-8px)}}@keyframes pet-shake{0%,100%{transform:rotate(0)}20%{transform:rotate(-8deg)}40%{transform:rotate(8deg)}60%{transform:rotate(-6deg)}80%{transform:rotate(6deg)}}@keyframes pet-blink{50%{opacity:.4}}
@media (prefers-reduced-motion:reduce){.pet .pet-body{animation:none!important}.pet-light i{animation:none!important}}`;
const FACE=(id)=>`<svg viewBox="0 0 120 120" aria-hidden="true"><defs><radialGradient id="${id}" cx="44%" cy="36%" r="72%"><stop offset="0" stop-color="#fff"/><stop offset=".5" stop-color="#ffd0e6"/><stop offset="1" style="stop-color:var(--accent)"/></radialGradient></defs><path d="M30 50 21 13 52 34Z M90 50 99 13 68 34Z" style="fill:var(--accent)"/><path d="M31 44 26 22 44 36Z M89 44 94 22 76 36Z" fill="#ffd3e6" opacity=".7"/><ellipse cx="60" cy="72" rx="41" ry="36" fill="url(#${id})"/><ellipse cx="45" cy="68" rx="5.5" ry="7.5" fill="#2a1f3a"/><ellipse cx="75" cy="68" rx="5.5" ry="7.5" fill="#2a1f3a"/><circle cx="47" cy="65" r="2" fill="#fff"/><circle cx="77" cy="65" r="2" fill="#fff"/><ellipse cx="35" cy="82" rx="7" ry="4" fill="#ff7fb0" opacity=".55"/><ellipse cx="85" cy="82" rx="7" ry="4" fill="#ff7fb0" opacity=".55"/><path d="M53 83q7 7 14 0" stroke="#2a1f3a" stroke-width="2.6" fill="none" stroke-linecap="round"/></svg>`;
const host=document.createElement("pet-js-host");host.setAttribute("data-who",WHO);host.style.cssText="position:fixed!important;left:0!important;top:0!important;width:0!important;height:0!important;margin:0!important;padding:0!important;border:0!important;display:block!important;overflow:visible!important;z-index:2147483000!important";
const root=host.attachShadow({mode:"open"});
root.innerHTML=`<style>${CSS}</style><div class="pet-root" part="root">
<div class="pet" role="group" aria-label="${esc(NAME)}, your desktop pet"><div class="pet-body" tabindex="0" role="button" aria-label="Chat with ${esc(NAME)} (drag to move)" title="Tap: chat with ${esc(NAME)} · drag: move her"></div>
<span class="pet-light" data-state="idle" title="💤 Nothing running"><i></i></span>
<div class="pet-bar"><button type="button" data-a="pat" title="Give her a headpat" aria-label="Headpat">🤚</button><button type="button" data-a="line" title="Say something" aria-label="Say something">💭</button><button type="button" data-a="hide" title="Put her away (🐾 brings her back, or press \`)" aria-label="Put her away">🐾</button></div>
<small class="pet-name"></small><div class="pet-emo" role="meter" aria-label="Her emotion gauge" title="Her emotion gauge"></div></div>
<div class="pet-bub" role="status" hidden><span class="pet-bubt"></span><span class="pet-rate"><button type="button" data-rate="1" title="Love this line" aria-label="Good line">👍</button><button type="button" data-rate="-1" title="Not this one" aria-label="Bad line">👎</button></span></div>
<div class="pet-note" role="alert" hidden></div>
<button type="button" class="pet-paw" data-a="show" title="Bring ${esc(NAME)} back (or press \`)" aria-label="Bring ${esc(NAME)} back" hidden>🐾</button>
<div class="pet-chat" role="dialog" aria-label="Chat with ${esc(NAME)}" hidden><div class="pet-head"><span class="pet-hav"></span><b>${esc(NAME)}</b><span class="pet-hmood"></span><span class="pet-sp"></span><button type="button" data-a="speak" title="Speak her replies" aria-label="Speak her replies">🔊</button><button type="button" data-a="curate" title="Curate my lines for me" aria-label="Curate her lines">🤖</button><button type="button" data-a="set" title="Settings" aria-label="Settings" aria-pressed="false">⚙</button><button type="button" data-a="close" title="Close (Esc)" aria-label="Close">✕</button></div>
<div class="pet-set" hidden></div><div class="pet-log" aria-live="polite"></div>
<div class="pet-in"><input type="text" placeholder="Say something… (/help)" aria-label="Message ${esc(NAME)}" autocomplete="off"><button type="button" data-a="mic" title="Dictate (speak instead of typing)" aria-label="Dictate" aria-pressed="false">🎤</button><button type="button" data-a="talk" title="Talk mode: hands-free, she listens again after she answers" aria-label="Talk mode" aria-pressed="false">🎧</button><button type="button" data-a="send" title="Send" aria-label="Send">➤</button></div>
<small class="pet-status" aria-live="polite"></small></div></div>`;
const $=s=>root.querySelector(s),R=$(".pet-root"),PET=$(".pet"),BODY=$(".pet-body"),BUB=$(".pet-bub"),NOTE=$(".pet-note"),PAW=$(".pet-paw"),CHATEL=$(".pet-chat"),LOG=$(".pet-log"),INP=$(".pet-in input"),SET=$(".pet-set"),STATUS=$(".pet-status"),LIGHT=$(".pet-light"),EMO=$(".pet-emo");
const CHAT=ST.chat;let chatBusy=false,waitText="",nBusy=0,nAgents=0;
const chatOpen=()=>!CHATEL.hidden,status=t=>{STATUS.textContent=t||"";placeChat()};

/* 🖼 her picture or looping clip, no frame: plain backgrounds keyed out on a small canvas when the media is same-origin, soft feathered edges otherwise */
let mediaVid=false,keyRun=0,keyLoop=0;
function media(){BODY.innerHTML="";PET.classList.remove("soft");keyRun++;if(!IMG){BODY.innerHTML=FACE("pg-"+WHO);return}mediaShow(isVid(IMG))}
function mediaShow(vid){const run=keyRun,el=document.createElement(vid?"video":"img");mediaVid=vid;el.alt="";if(vid){el.muted=true;el.loop=true;el.autoplay=true;el.playsInline=true;el.setAttribute("playsinline","")}
  el.onerror=()=>{if(run!==keyRun)return;if(!vid&&!isVid(IMG)){mediaShow(true);return}BODY.innerHTML=FACE("pg-"+WHO);mediaVid=false;avatarRender()};
  const ok=()=>{if(run!==keyRun)return;avatarRender();if(sameOrigin(IMG))keyOut(el,vid,run);else soften(el)};if(vid){el.onloadeddata=ok}else el.onload=ok;
  el.src=IMG;BODY.innerHTML="";BODY.appendChild(el);if(vid)el.play&&el.play().catch(()=>{})}
function soften(el){PET.classList.add("soft");const W=el.videoWidth||el.naturalWidth,H=el.videoHeight||el.naturalHeight;if(!W||!H)return;const a=W/H;Object.assign(el.style,a<1?{width:a*100+"%",height:"100%",left:(100-a*100)/2+"%",top:"0"}:{width:"100%",height:100/a+"%",left:"0",top:(100-100/a)+"%"})}
function keyColor(d,w,h){const n=Math.max(2,Math.round(Math.min(w,h)*.05)),patch=(x0,y0)=>{let r=0,g=0,b=0,a=0,k=0;const P0=[];for(let y=y0;y<y0+n;y++)for(let x=x0;x<x0+n;x++){const i=(y*w+x)*4,p=[d.data[i],d.data[i+1],d.data[i+2],d.data[i+3]];P0.push(p);r+=p[0];g+=p[1];b+=p[2];a+=p[3];k++}r/=k;g/=k;b/=k;a/=k;return {r,g,b,a,v:P0.reduce((s,p)=>s+Math.abs(p[0]-r)+Math.abs(p[1]-g)+Math.abs(p[2]-b),0)/k}};
  const L=patch(0,0),Rt=patch(w-n,0);if(L.a<20&&Rt.a<20)return {clear:true};const dist=Math.abs(L.r-Rt.r)+Math.abs(L.g-Rt.g)+Math.abs(L.b-Rt.b);return {r:(L.r+Rt.r)/2,g:(L.g+Rt.g)/2,b:(L.b+Rt.b)/2,flat:dist<42&&L.v<30&&Rt.v<30}}
function keyOut(el,vid,run){try{const W=vid?el.videoWidth:el.naturalWidth,H=vid?el.videoHeight:el.naturalHeight;if(!W||!H){soften(el);return}
  const sc=Math.min(1,360/Math.max(W,H)),w=Math.max(1,Math.round(W*sc)),h=Math.max(1,Math.round(H*sc)),cv=document.createElement("canvas");cv.width=w;cv.height=h;const g=cv.getContext("2d",{willReadFrequently:true});g.drawImage(el,0,0,w,h);
  let d;try{d=g.getImageData(0,0,w,h)}catch(e){soften(el);return}const key=keyColor(d,w,h);if(key.clear)return;if(!key.flat){soften(el);return}
  const tol=48,paint=()=>{g.clearRect(0,0,w,h);g.drawImage(el,0,0,w,h);const D=g.getImageData(0,0,w,h),a=D.data;for(let i=0;i<a.length;i+=4){const dd=Math.abs(a[i]-key.r)+Math.abs(a[i+1]-key.g)+Math.abs(a[i+2]-key.b);if(dd<tol)a[i+3]=0;else if(dd<tol*1.7)a[i+3]=Math.round(a[i+3]*(dd-tol)/(tol*.7))}g.putImageData(D,0,0)};
  paint();el.classList.add("pet-src");BODY.prepend(cv);if(!vid)el.remove();
  if(vid){let last=0;const loop=t=>{if(run!==keyRun){el.pause&&el.pause();return}if(!document.hidden&&t-last>40){last=t;try{paint()}catch(e){}}keyLoop=requestAnimationFrame(loop)};keyLoop=requestAnimationFrame(loop)}}catch(e){warn("cut-out",e);soften(el)}}
const avHTML=()=>IMG&&!mediaVid&&BODY.querySelector("img,canvas")?`<img class="pet-av" src="${esc(IMG)}" alt="">`:`<span class="pet-av">${FACE("pa-"+WHO)}</span>`;
function avatarRender(){$(".pet-hav").innerHTML=avHTML();if(chatOpen())logRender()}

/* 📍 where she sits: draggable, saved, kept on screen; the chat, bubble and notices open beside her */
const sz=()=>innerWidth<=520?Math.min(SIZE,110):SIZE;
function place(){PET.style.setProperty("--sz",sz()+"px");const s=sz(),m=Math.max(6,Math.ceil((EMO.offsetWidth-s)/2)+2);if(ST.pos&&isFinite(ST.pos.x)){const x=clamp(ST.pos.x,m,Math.max(m,innerWidth-s-m)),y=clamp(ST.pos.y,0,Math.max(0,innerHeight-s-30));Object.assign(PET.style,{left:x+"px",top:y+"px",right:"auto",bottom:"auto"})}else Object.assign(PET.style,{left:"",top:"",right:"16px",bottom:"16px"});
  const right=(ST.pos&&isFinite(ST.pos.x)?ST.pos.x+s/2:innerWidth)>innerWidth/2;PAW.style.left=right?"auto":"10px";PAW.style.right=right?"10px":"auto";placeFloat(BUB);placeFloat(NOTE);placeChat()}
function placeFloat(el){if(el.hidden)return;el.style.left=el.style.top="0px";const a=ST.hidden?PAW.getBoundingClientRect():PET.getBoundingClientRect(),w=el.offsetWidth,h=el.offsetHeight,right=a.left+a.width/2>innerWidth/2;
  let x=right?a.right-w:a.left,y=a.top-h-8;if(el===BUB&&!ST.hidden)x=right?a.left+a.width*.75-w:a.left+a.width*.25;if(y<8)y=a.bottom+8;x=clamp(x,8,Math.max(8,innerWidth-w-8));y=clamp(y,8,Math.max(8,innerHeight-h-8));el.style.left=x+"px";el.style.top=y+"px";
  if(el===BUB)el.style.borderRadius=y<a.top?(right?"14px 14px 4px 14px":"14px 14px 14px 4px"):(right?"14px 4px 14px 14px":"4px 14px 14px 14px")}
function placeChat(){if(CHATEL.hidden)return;const s=ST.set,cw=Math.min(WIDTHS[s.width]||340,innerWidth-32);CHATEL.style.width=cw+"px";R.style.setProperty("--logh",Math.max(90,Math.min(+s.logH||280,innerHeight-190))+"px");
  const a=ST.hidden?PAW.getBoundingClientRect():PET.getBoundingClientRect(),ch=CHATEL.offsetHeight;let side=s.side;if(side!=="left"&&side!=="right")side=a.left+a.width/2>innerWidth/2?"left":"right";
  let x=side==="left"?a.left-10-cw:a.right+10,y;if(x<16||x+cw>innerWidth-16){x=clamp(a.left+a.width/2-cw/2,16,Math.max(16,innerWidth-16-cw));y=a.top-10-ch;if(y<8)y=a.bottom+10;if(y+ch>innerHeight-8)y=Math.max(8,innerHeight-8-ch)}else y=clamp(a.bottom-ch,8,Math.max(8,innerHeight-8-ch));
  CHATEL.style.left=x+"px";CHATEL.style.top=y+"px"}
{let drag=null;BODY.addEventListener("pointerdown",e=>{if(e.button>0)return;const r=PET.getBoundingClientRect();drag={x:e.clientX,y:e.clientY,ox:r.left,oy:r.top,moved:false};try{BODY.setPointerCapture(e.pointerId)}catch(x){}});
  BODY.addEventListener("pointermove",e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(!drag.moved&&Math.hypot(dx,dy)<5)return;drag.moved=true;ST.pos={x:Math.round(drag.ox+dx),y:Math.round(drag.oy+dy)};place()});
  const up=()=>{const d=drag;drag=null;if(!d)return;if(d.moved){saveST();return}tapped()};BODY.addEventListener("pointerup",up);BODY.addEventListener("pointercancel",()=>{if(drag&&drag.moved)saveST();drag=null});
  BODY.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();tapped()}})}
function tapped(){bugLvl=0;lastAct=Date.now();if(!chatOpen()){feel("Happy",6);emo().v.cool=Math.max(0,(emo().v.cool||0)-10)}toggleChat(!chatOpen())}
function showPet(on){ST.hidden=!on;saveST();PET.hidden=!on;PAW.hidden=on;if(!on){BUB.hidden=true}place()}

/* 💬 her bubble: little lines, 👍/👎 on hover to rate them (👍 on a line she made up on the spot adds it to the book) */
let bubCur=null,bubT=0,lastSaid=null;
function say(t,o={}){t=fill(t);if(!t)return;if(!o.force&&(chatOpen()||ST.hidden))return;bubCur={t,id:o.id||null,src:o.src||"sys",kind:o.kind||"idle"};if(o.src==="book"||o.src==="ai")lastSaid=bubCur;
  $(".pet-bubt").innerHTML=acts(t);$(".pet-rate").hidden=!(o.src==="book"||o.src==="ai");BUB.classList.toggle("long",t.length>90);BUB.hidden=false;placeFloat(BUB);clearTimeout(bubT);bubT=setTimeout(hideBub,o.long||t.length>90?14000:7000);
  if(ST.set.speakBub&&!document.hidden&&!talk)speak(t)}
function hideBub(){if(BUB.matches(":hover")){bubT=setTimeout(hideBub,2500);return}BUB.hidden=true}
function sayLine(kind,must){const it=pick(kind,must);if(it)say(it.t,{id:it.tmp?null:it.id,src:"book",kind:it.kind,force:must==="force"});return it}
async function sayAI(kind){const t=await aiLine(kind);if(t){say(t,{src:"ai",kind});return true}return false}
BUB.addEventListener("click",e=>{const b=e.target.closest("[data-rate]");if(!b||!bubCur)return;const v=+b.dataset.rate,c=bubCur;let it=c.id?BOOK.items.find(x=>x.id===c.id):null,added=false;
  if(!it&&c.src==="ai"){it=mkLine(c.t,c.kind,v>0?"liked":"ai",v>0?2:-2);BOOK.items.push(it);touch(it);c.id=it.id;added=true;feel(v>0?"Proud":"Hurt",v>0?8:5)}else if(it)rate(it,v);
  $(".pet-rate").hidden=true;$(".pet-bubt").innerHTML=acts(c.t)+`<br><small>${v>0?(added?"💗 Saved to my phrasebook.":"💗 I'll say that more."):(it&&it.score<=-2?"🙊 Retired. I won't say that again.":"🙊 Noted, less of that.")}</small>`;clearTimeout(bubT);bubT=setTimeout(hideBub,3500)});

/* 🌡 gauge on screen: the top feeling sets her glow and a gentle animation */
function emoApply(){const e=emo(),f=topFam(),v=e.v[f]||0,F=FAM.find(x=>x[0]===f);FAM.forEach(([k])=>PET.classList.toggle("emo-"+k,k===f&&v>=35));PET.style.setProperty("--aura",F[4]);PET.style.setProperty("--aura-r",Math.round(v/9)+"px");
  EMO.innerHTML=`<b style="color:${F[4]}">${F[1]} ${esc(moodWord())}</b><span class="pet-bars">${FAM.map(([k,,,,c])=>`<i style="--h:${Math.max(8,Math.round(e.v[k]||0))}%;--c:${c}"></i>`).join("")}</span>`;
  EMO.title="Her emotion gauge · "+FAM.map(([k,ic,l])=>`${ic} ${l} ${Math.round(e.v[k]||0)}`).join(" · ");EMO.setAttribute("aria-valuetext",emoLine());$(".pet-hmood").textContent=F[1]+" "+moodWord()}
function busy(d){nBusy=Math.max(0,nBusy+d);lightRender()}
function lightRender(){const st=nAgents?"agent":nBusy?"think":"idle";LIGHT.dataset.state=st;LIGHT.title=st==="agent"?"🛰 Working on a task…":st==="think"?"💭 Thinking…":"💤 Nothing running"}

/* 🗨 chat box: her log, your box, 🎤 dictation, 🎧 talk mode, ⚙ settings */
function toggleChat(o){CHATEL.hidden=!o;if(o){BUB.hidden=true;applySet();if(!CHAT.length){const it=pick(greet(),true);CHAT.push({r:"c",t:fill(it?it.t:"Hi you."),at:Date.now()});saveST()}logRender();placeChat();setTimeout(()=>{try{INP.focus({preventScroll:true})}catch(e){}},0)}else{SET.hidden=true;$('[data-a="set"]').setAttribute("aria-pressed","false");if(rec)stopListen();if(talk)setTalk(false)}}
const greet=()=>{const h=new Date().getHours();return h>=22||h<5?"night":h<11?"morning":"hello"};
function msgHTML(m,i){const tm=`<span class="pet-time">${esc(new Date(m.at||Date.now()).toLocaleTimeString([],{hour:"numeric",minute:"2-digit"}))}</span>`;if(m.r==="s")return `<div class="pet-msg s">${esc(m.t)}</div>`;
  return m.r==="u"?`<div class="pet-msg u"><span class="pet-av">${esc((ST.set.youName||"You").charAt(0).toUpperCase())}</span><div class="pet-tx">${esc(m.t)}${tm}</div></div>`:`<div class="pet-msg c">${avHTML()}<div class="pet-tx">${acts(m.t)}${tm}<button type="button" class="pet-say" data-say="${i}" title="Say it out loud" aria-label="Say it out loud">🔊</button></div></div>`}
function logRender(){if(!chatOpen())return;const L=CHAT.slice(-40),off=CHAT.length-L.length;
  LOG.innerHTML=L.map((m,j)=>msgHTML(m,off+j)).join("")+(chatBusy?`<div class="pet-msg c pet-wait">${avHTML()}<div class="pet-tx">${acts(waitText||"…")}</div></div>`:"");LOG.scrollTop=LOG.scrollHeight;placeChat()}
function push(m){m.at=m.at||Date.now();CHAT.push(m);if(CHAT.length>60)CHAT.splice(0,CHAT.length-60);saveST();logRender()}
const sys=t=>push({r:"s",t});
function applySet(){const s=ST.set;R.style.setProperty("--accent",s.accent);R.style.setProperty("--you",s.you);R.style.setProperty("--glass",clamp(+s.glass||.84,.2,1));R.style.setProperty("--fs",clamp(+s.font||14,10,22)+"px");
  const c=/^#([0-9a-f]{6})$/i.exec(s.you),n=c?parseInt(c[1],16):0,lum=c?(.299*(n>>16)+.587*((n>>8)&255)+.114*(n&255)):0;R.style.setProperty("--youfg",lum>150?"#1a1222":"#fff");
  CHATEL.classList.toggle("no-av",!s.avatars);CHATEL.classList.toggle("no-time",!s.stamps);$('[data-a="speak"]').setAttribute("aria-pressed",String(!!s.speak));placeChat()}
const voices=()=>{try{return TTS?TTS.getVoices():[]}catch(e){return []}};
function setRender(){const s=ST.set,o=(k,L)=>L.map(([v,l])=>`<option value="${esc(v)}"${String(s[k])===String(v)?" selected":""}>${esc(l)}</option>`).join(""),rg=(k,l,a,b,st,u)=>`<label>${l} <output>${esc(s[k])}${u||""}</output><input type="range" data-k="${k}" min="${a}" max="${b}" step="${st}" value="${esc(s[k])}"></label>`,ck=(k,l)=>`<label class="ck"><input type="checkbox" data-k="${k}"${s[k]?" checked":""}> ${l}</label>`;
  const V=voices();SET.innerHTML=`<label>Width<select data-k="width">${o("width",[["narrow","Narrow"],["normal","Normal"],["wide","Wide"]])}</select></label><label>Chat opens<select data-k="side">${o("side",[["auto","Auto"],["left","Left of her"],["right","Right of her"]])}</select></label>
${rg("logH","Log height",120,560,20,"px")}${rg("font","Font size",11,20,1,"px")}${rg("glass","Glass",.35,1,.05,"")}<label>Replies<select data-k="len">${o("len",[["short","Short (~40 words)"],["chatty","Chatty (~120)"],["long","Long (~250)"]])}</select></label>
<label>Her colour<input type="color" data-k="accent" value="${esc(s.accent)}"></label><label>Your bubbles<input type="color" data-k="you" value="${esc(s.you)}"></label>
${ck("avatars","Avatars")}${ck("stamps","Timestamps")}${ck("lines","💬 Little lines now and then")}${ck("smart","🧠 She makes up some lines")}
<p class="full">🔊 Her voice</p>${ck("speak","Speak her replies")}${ck("speakBub","Speak her bubble lines")}
<label class="full">Voice<select data-k="voice"><option value="">${TTS?"Browser default":"No speech in this browser"}</option>${V.map(v=>`<option value="${esc(v.name)}"${v.name===s.voice?" selected":""}>${esc(v.name)} (${esc(v.lang)})</option>`).join("")}</select></label>
${rg("rate","Rate",.5,2,.05,"")}${rg("pitch","Pitch",0,2,.05,"")}${rg("vol","Volume",0,1,.05,"")}<div class="row" style="align-self:end"><button type="button" data-a="try">▶ Try her voice</button></div>
<p class="full">📒 Phrasebook</p><small class="full pet-stats"></small><div class="full row"><button type="button" data-a="curate">🤖 Curate for me</button><button type="button" data-a="home">↘ Back to the corner</button><button type="button" data-a="clear">🧹 Clear chat</button></div>`;statsRender()}
function statsRender(){const el=root.querySelector(".pet-stats");if(!el)return;const a=active(),liked=a.filter(x=>x.score>=2).length,ret=BOOK.items.length-a.length;el.textContent=`${a.length} active line${a.length===1?"":"s"} · ${liked} loved · ${ret} retired · ${BOOK.curated?"curated "+when(Date.parse(BOOK.curated)):"never curated"} · ${DB?"shared in "+PATH.lines:"kept in this browser"}`}
SET.addEventListener("input",e=>{const el=e.target,k=el.dataset&&el.dataset.k;if(!k)return;const v=el.type==="checkbox"?el.checked:el.type==="range"?+el.value:el.value;ST.set[k]=v;const out=el.parentElement&&el.parentElement.querySelector("output");if(out)out.textContent=v+(k==="logH"||k==="font"?"px":"");saveST();applySet();if(k==="avatars"||k==="stamps")logRender()});
CHATEL.addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;const a=b.dataset.a;
  if(b.dataset.say!=null){const m=CHAT[+b.dataset.say];if(m)speak(m.t);return}
  if(a==="close"){toggleChat(false);return}if(a==="send"){submit();return}if(a==="mic"){rec?stopListen():listen();return}if(a==="talk"){setTalk(!talk);return}
  if(a==="speak"){ST.set.speak=!ST.set.speak;saveST();applySet();status(ST.set.speak?"🔊 She'll read her replies aloud.":"🔇 Quiet replies.");if(!ST.set.speak&&TTS)TTS.cancel();return}
  if(a==="set"){SET.hidden=!SET.hidden;b.setAttribute("aria-pressed",String(!SET.hidden));if(!SET.hidden)setRender();placeChat();return}
  if(a==="curate"){curate(true);return}if(a==="try"){speak(`Hi, I'm ${NAME}. *giggles* Do you like my voice?`);return}if(a==="home"){ST.pos=null;saveST();place();return}if(a==="clear"){CHAT.splice(0);saveST();logRender();return}});
const submit=()=>{if(chatBusy){status("⏳ She's still answering…");return}const t=INP.value;INP.value="";status("");send(t)};
INP.addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.isComposing){e.preventDefault();submit()}});
CHATEL.addEventListener("keydown",e=>{if(e.key==="Escape"){e.stopPropagation();toggleChat(false);try{BODY.focus({preventScroll:true})}catch(x){}}});
EMO.addEventListener("click",()=>{toggleChat(true);push({r:"c",t:`🌡 Right now I'm ${emoLine()}.`})});
PET.addEventListener("click",e=>{const b=e.target.closest(".pet-bar button");if(!b)return;e.stopPropagation();if(b.dataset.a==="pat")pat();else if(b.dataset.a==="line")sayNow();else if(b.dataset.a==="hide"){toggleChat(false);showPet(false)}});
PAW.addEventListener("click",()=>{showPet(true);sayLine("hello","force")});
NOTE.addEventListener("click",e=>{const b=e.target.closest("[data-n]");if(!b)return;const r=NOTE._r;NOTE.hidden=true;if(!r)return;if(b.dataset.n==="talk")toggleChat(true);
  if(b.dataset.n==="snooze")remWrite(items=>{const at=new Date(Date.now()+6e5).toISOString(),x=items.find(i=>i.id===r.id);if(x&&(x.repeat||"none")==="none"){x.at=at;x.done=false}else items.push(Object.assign({},r,{id:"r"+Date.now().toString(36),at,repeat:"none",done:false}))}).catch(e=>warn("snooze",e))});

/* 🤚 headpats, 💭 a line now, 🖱 your cursor, 😤 being ignored */
let lastAct=Date.now(),lastBug=0,bugLvl=0,lastIdle=Date.now(),lastDrift=Date.now(),lastNear=0;
function pat(){const h=document.createElement("span");h.className="pet-heart";h.textContent=rnd(["💗","💕","✨","💞"]);PET.appendChild(h);setTimeout(()=>h.remove(),1300);feel("Affectionate",14);lastAct=Date.now();bugLvl=0;
  const kind=(emo().v.warm||0)>=60&&Math.random()<.35?"love":"pat";if(ST.set.smart&&SAMPLE&&Math.random()<.3)sayAI(kind).then(ok=>{if(!ok)sayLine(kind,"force")});else sayLine(kind,"force")}
function sayNow(){lastAct=Date.now();if(ST.set.smart&&SAMPLE&&Math.random()<.5)sayAI(idleKind()).then(ok=>{if(!ok)sayLine(idleKind(),"force")});else sayLine(idleKind(),"force")}
const idleKind=()=>{const h=new Date().getHours(),e=emo().v;if((h>=23||h<4)&&Math.random()<.3)return "night";if(h>=6&&h<10&&Math.random()<.2)return "morning";if(Math.max(e.warm||0,e.hot||0)>=55&&Math.random()<.25)return "love";return "idle"};
["pointerdown","keydown","wheel"].forEach(ev=>document.addEventListener(ev,()=>{lastAct=Date.now();bugLvl=0},{passive:true,capture:true}));
let mx=0,my=0,mraf=0;document.addEventListener("pointermove",e=>{mx=e.clientX;my=e.clientY;if(!mraf)mraf=requestAnimationFrame(cursorTick)},{passive:true});
function cursorTick(){mraf=0;if(ST.hidden)return;const r=PET.getBoundingClientRect(),dx=mx-(r.left+r.width/2),dy=my-(r.top+r.height/2),dist=Math.hypot(dx,dy);BODY.style.setProperty("--lean",(clamp(dx/600,-1,1)*6).toFixed(1)+"deg");
  if(dist<r.width*.9&&Date.now()-lastNear>9e4&&!chatOpen()&&!PET.matches(":hover")){lastNear=Date.now();feel("Curious",6);if(ST.set.lines)sayLine("cursor")}}
function bug(){bugLvl=Math.min(3,bugLvl+1);lastBug=Date.now();PET.classList.remove("bug1","bug2","bug3");void PET.offsetWidth;PET.classList.add("bug"+bugLvl);setTimeout(()=>PET.classList.remove("bug"+bugLvl),2400);
  feel(bugLvl===1?"Lonely":bugLvl===2?"Bratty":"Needy",10+bugLvl*4);if(ST.set.lines)sayLine("attention","force")}
function beat(){const t=Date.now();remCheck();if(t-lastDrift>=6e4){lastDrift=t;drift()}if(document.hidden||ST.hidden||chatOpen()||!NOTE.hidden)return;
  if(t-Math.max(lastAct,lastBug)>=3e5){bug();return}if(ST.set.lines&&t-lastIdle>=5e4&&BUB.hidden){lastIdle=t;if(Math.random()<.5)sayLine(idleKind())}}

/* 🧠 talking to her: the AI on the quick tier returns a reply and a mood word; with page tools she can set reminders, take notes and more */
const sampleReady=async()=>{if(SAMPLE)return SAMPLE;if(pSample)await pSample;return SAMPLE};
const ERR={not_granted:"*shrugs* I'm not allowed to use Claude on this page, so I'll keep it simple.",sampling_disabled:"*shrugs* Claude isn't available for this account.",rate_limited:"*fans herself* Too many words too fast. Give me a minute?",refused:"*blinks* I can't answer that one.",prompt_too_large:"*holds her head* That's too much at once.",invalid_json:"*stammers* I got my words tangled. Try again?",session_expired:"*yawns* Sign in again and come back to me.",empty_completion:"*opens her mouth… nothing* Try again?"};
const errText=e=>ERR[e&&e.code]||"*blinks* Something went wrong"+(e&&e.code?" ("+e.code+")":"")+". Try again?";
async function webOk(){if(!MCP)return false;try{const r=await MCP.listTools();return !!(r&&Array.isArray(r.servers)&&r.servers.some(s=>s&&s.server==="Parallel Search"&&(!Array.isArray(s.tools)||!s.tools.length||s.tools.some(t=>t&&t.name==="web_search"))))}catch(e){return true}}
function chatPrompt(c,tools){const T=CHAT.filter(m=>m.r!=="s").slice(-10).map(m=>m.r==="u"?{user:String(m.t).slice(0,600)}:{you:String(m.t).slice(0,600)});
  return `You are ${NAME}, a little companion who lives on the user's screen as a desktop pet, in an adult (21+) app. You are an adult. ${PERSONA||PERSONA0}
${c.prof.length?"About the user (use lightly; never mention race or ethnicity): "+c.prof.join("; ")+"\n":""}${c.rules.length?"Their preferences (follow these):\n- "+c.rules.join("\n- ")+"\n":""}How you feel right now (your emotion gauge): ${emoLine()}. Let it colour the reply.
The user's local time is ${localISO()}.
${tools?`You have tools; use them when the user asks for one of these: set_reminder (give "at" as ISO 8601 with the user's offset, or in_minutes), list_reminders, take_note, read_notes, rate_line (rate one of your bubble lines), curate_lines (write fresh bubble lines for them), set_mood (change your own mood)${WEB?", web_search (look things up)":""}. After using a tool, tell them what you did, in character.`:`In this view you have no tools: you can't set reminders, take notes or look things up yourself. If they ask for that, say so in character and tell them what you'd need (this page has to allow Claude's page tools${MCP?"":", and the Parallel Search connector for web search"}).`}
Chat so far: ${JSON.stringify(T)}
Reply in character to their last message, up to ${LEN[ST.set.len]||120} words, *actions* in asterisks. Never mention real people. Reply with only JSON: {"reply":"...","mood":"one word from: ${ALLMOODS.join(", ")}"}`}
function canned(t){const q=t.toLowerCase();if(/remind|note|search|look (it|this|that)? ?up|google/.test(q))return "*taps her temple* I'd love to, but there's no Claude on this page, so I can't set reminders, take notes or search. The page needs Claude (sample) and its tools for that.";
  if(/\b(hi|hello|hey|morning|evening|yo)\b/.test(q)){const it=pick(greet(),true);return fill(it?it.t:"Hi you.")}if(/love|cute|pretty|good girl|adorable|miss/.test(q)){feel("Affectionate",10);const it=pick("love",true);return fill(it?it.t:"*beams*")}
  return rnd(["*tilts her head* I can't think in words on this page (no Claude here), but I like it when you talk to me.","*nods along very seriously* Mhm. Mhm. Tell me more.","*hums* I'm just a little pet right now, no big brain on this page. Headpats still work though."])}
async function send(text){text=String(text||"").trim();if(!text||chatBusy)return;lastAct=Date.now();bugLvl=0;if(text.startsWith("/")&&await cmd(text))return;
  push({r:"u",t:text});feel("warm",4);emo().v.cool=Math.max(0,(emo().v.cool||0)-8);chatBusy=true;waitText="…";busy(1);logRender();let reply="",mood="";
  try{const S=await sampleReady();if(!S){reply=canned(text)}else{if(TOOLS===null){const L=typeof S.limits==="function"?await S.limits().catch(()=>null):null;TOOLS=!!(L&&L.tools);if(TOOLS&&WEB===null)WEB=await webOk()}
      const c=await context(),run=async useT=>S.json(chatPrompt(c,useT),useT?{cache:false,modelTier:"quick",tools:toolList()}:{cache:false,modelTier:"quick"});let out;
      try{out=await run(TOOLS)}catch(e){if(e&&e.code==="tools_unavailable"){TOOLS=false;out=await run(false)}else throw e}
      reply=String(out&&(out.reply||out.text)||"").trim().slice(0,2000);mood=String(out&&out.mood||"");if(!reply)throw {code:"empty_completion"}}}
  catch(e){reply=errText(e)}finally{chatBusy=false;waitText="";busy(-1)}
  push({r:"c",t:reply});if(mood)feel(mood,18);
  if(talk){if(!speak(reply,()=>{if(talk)setTimeout(listen,250)}))setTimeout(()=>{if(talk)listen()},600)}else if(ST.set.speak)speak(reply)}
async function aiLine(kind){const S=SAMPLE;if(!S||!ST.set.smart)return null;busy(1);try{const liked=active().filter(x=>x.score>=2).slice(-5).map(x=>x.t);
    const out=await S.json(`You are ${NAME}, a little desktop pet on the user's screen in an adult (21+) app; you are an adult. ${PERSONA||PERSONA0} You feel ${emoLine()}. Write ONE ${({hello:"greeting",idle:"idle musing",attention:"attention-seeking",pat:"reaction to a headpat",cursor:"reaction to their cursor coming close",agent:"heading-off-to-help",night:"late-night",morning:"good-morning",love:"sweet, affectionate"})[kind]||"idle"} line in your voice, under 25 words, *actions* allowed. Never mention race, ethnicity or real people.${liked.length?" Lines they loved (match the style): "+liked.join(" | "):""} Reply with only JSON: {"line":"..."}`,{cache:false,modelTier:"quick"});
    const t=String(out&&out.line||"").trim().slice(0,200);return t&&!RACE.test(t)?t:null}catch(e){return null}finally{busy(-1)}}

/* ⌨ chat commands that work without the AI: /help /feel /line /lines /curate /clear */
async function cmd(t){const m=t.match(/^\/(help|feel|line|lines|curate|clear)\b\s*([\s\S]*)$/i);if(!m)return false;const c=m[1].toLowerCase(),arg=m[2].trim();push({r:"u",t});
  if(c==="help")push({r:"c",t:`Things I know:\n/feel → my emotion gauge\n/line [kind:] text → teach me a line (kinds: ${KINDS.join(", ")})\n/lines → my phrasebook\n/curate → 🤖 write me fresh lines\n/clear → clear this chat\n🎤 dictate · 🎧 talk mode · 🔊 read aloud · ⚙ settings · \` (backtick) opens me anywhere`});
  else if(c==="feel")push({r:"c",t:`🌡 Right now I'm ${emoLine()}.`});
  else if(c==="line"){const k=arg.match(/^(\w+)\s*:\s*([\s\S]+)$/),kind=k&&KINDS.includes(k[1].toLowerCase())?k[1].toLowerCase():"idle",txt=(k&&KINDS.includes(k[1].toLowerCase())?k[2]:arg).trim();
    if(!txt)push({r:"c",t:"Tell me the line: /line love: You're stuck with me now."});else if(BOOK.items.some(x=>norm(x.t)===norm(txt)))push({r:"c",t:"*nods* I already know that one."});else{const it=mkLine(txt,kind,"you",2);BOOK.items.push(it);touch(it,true);feel("Delighted",10);push({r:"c",t:`*scribbles it down* Got it, a ${kind} line: “${it.t}”`})}}
  else if(c==="lines"){const a=active().slice().sort((x,y)=>y.score-x.score);push({r:"c",t:`📒 ${a.length} active lines${BOOK.curated?", last curated "+when(Date.parse(BOOK.curated)):""}. My favourites:\n`+a.slice(0,5).map(x=>`· ${x.t} (${x.kind}, ${x.score>0?"+":""}${x.score})`).join("\n")})}
  else if(c==="curate")await curate(true);else if(c==="clear"){CHAT.splice(0);saveST();logRender()}return true}

/* 🛰 her tasks: page tools Claude may call (reminders, notes, web search when Parallel Search is there, rating, curating, her mood) */
let REM=[],remFiring=new Set();
const remNext=(at,rep)=>{const step=rep==="hourly"?36e5:rep==="daily"?864e5:rep==="weekly"?6048e5:0;if(!step)return null;let t=Date.parse(at);while(t<=Date.now())t+=step;return new Date(t).toISOString()};
async function remWrite(mut){const d=await store.getStrict(PATH.rem)||{},items=Array.isArray(d.items)?d.items.slice():[];if(mut(items)===false)return items;while(items.length>60){const i=items.findIndex(x=>x&&x.done);if(i<0)break;items.splice(i,1)}
  await store.set(PATH.rem,Object.assign({},d,{items,updated:iso()}));REM=items;return items}
function remCheck(){if(REM_OFF)return;const t=Date.now(),due=REM.find(r=>r&&r.id&&!r.done&&!remFiring.has(r.id)&&Date.parse(r.at)<=t);if(due)remFire(due)}
async function remFire(r){remFiring.add(r.id);try{let got=null;await remWrite(items=>{const x=items.find(i=>i&&i.id===r.id);if(!x||x.done||Date.parse(x.at)>Date.now())return false;got=Object.assign({},x);const nx=remNext(x.at,x.repeat);if(nx)x.at=nx;else x.done=true});if(got)remShow(got)}
  catch(e){warn("reminder",e)}finally{setTimeout(()=>remFiring.delete(r.id),6e4)}}
function remShow(r){const other=r.char&&r.char!==WHO&&r.name,line=r.kind==="coo"?`*pouts* Come talk to me? I miss you.`:other?`${r.name} asked me to tell you: ${r.text}`:`Psst… don't forget: ${r.text}`;NOTE._r=r;
  NOTE.innerHTML=`<b>⏰ ${esc(NAME)}</b><p>${acts(line)}</p><small>${esc(r.text)} · ${esc(when(Date.parse(r.at)))}${r.repeat&&r.repeat!=="none"?" · "+esc(r.repeat):""}</small><div><button type="button" data-n="talk">💬 Talk to her</button><button type="button" data-n="snooze">💤 10 min</button><button type="button" data-n="done">✓ Done</button></div>`;
  BUB.hidden=true;NOTE.hidden=false;placeFloat(NOTE);push({r:"c",t:"⏰ "+line});if(ST.set.speak||ST.set.speakBub)speak(line)}
const tool=(name,description,properties,required,fn)=>({name,description,inputSchema:{type:"object",properties,required},execute:async(i,ctx)=>{nAgents++;lightRender();waitText=(pick("agent",true)||{t:"*works on it*"}).t;logRender();try{return await fn(i&&typeof i==="object"?i:{},ctx||{})}finally{nAgents--;lightRender()}}});
function toolList(){const T=[
  tool("set_reminder","Set a reminder for the user; she pops up and says it when it's due (while the page is open). Give 'at' as an ISO 8601 date-time with the user's offset, or 'in_minutes'. repeat is none, daily or weekly. Returns the saved reminder.",{text:{type:"string",description:"What to remind them about"},at:{type:"string",description:"ISO 8601 date-time"},in_minutes:{type:"number"},repeat:{type:"string",enum:["none","daily","weekly"]}},["text"],async i=>{
    const text=String(i.text||"").replace(/\s+/g," ").trim().slice(0,200);if(!text)throw new Error("text is required");const t=i.in_minutes!=null&&isFinite(+i.in_minutes)?Date.now()+(+i.in_minutes)*6e4:Date.parse(String(i.at||""));if(!isFinite(t))throw new Error("give 'at' as an ISO 8601 date-time, or 'in_minutes'");
    const rep=["none","daily","weekly"].includes(i.repeat)?i.repeat:"none",it={id:"r"+Date.now().toString(36)+Math.random().toString(36).slice(2,5),text,at:new Date(t).toISOString(),repeat:rep,char:WHO,name:NAME,kind:"remind",done:false};
    await remWrite(items=>{items.push(it)});sys(`⏰ Reminder set: ${text} · ${when(t)}${rep!=="none"?" · "+rep:""}`);return {ok:true,id:it.id,at:it.at,when:when(t),repeat:rep}}),
  tool("list_reminders","List the user's reminders that haven't fired yet (text, when, repeat).",{},[],async()=>{const d=await store.get(PATH.rem),L=(d&&Array.isArray(d.items)?d.items:[]).filter(x=>x&&!x.done).sort((a,b)=>String(a.at).localeCompare(String(b.at)));return {count:L.length,items:L.slice(0,30).map(x=>({id:x.id,text:x.text,when:when(Date.parse(x.at)),repeat:x.repeat||"none",for:x.name||x.char||""}))}}),
  tool("take_note","Save a short note for the user (something to remember). Returns how many notes there are.",{text:{type:"string"}},["text"],async i=>{const t=String(i.text||"").trim().slice(0,1000);if(!t)throw new Error("text is required");const d=await store.getStrict(PATH.notes)||{},items=(Array.isArray(d.items)?d.items:[]).concat({t,at:iso()}).slice(-200);await store.set(PATH.notes,Object.assign({},d,{items,updated:iso()}));sys("📝 Noted: "+t.slice(0,80));return {ok:true,count:items.length}}),
  tool("read_notes","Read the user's saved notes, newest last; 'query' filters them.",{query:{type:"string"}},[],async i=>{const d=await store.get(PATH.notes),q=String(i.query||"").toLowerCase(),L=(d&&Array.isArray(d.items)?d.items:[]).filter(x=>x&&(!q||String(x.t).toLowerCase().includes(q)));return {count:L.length,notes:L.slice(-25).map(x=>({t:x.t,when:when(Date.parse(x.at))}))}}),
  tool("rate_line","Rate one of your own speech-bubble lines for the user: vote up or down. 'which' is 'last' for the line you said last, or a few words from the line.",{which:{type:"string"},vote:{type:"string",enum:["up","down"]}},["vote"],async i=>{const v=i.vote==="down"?-1:1,w=String(i.which||"last").toLowerCase();let it=null;
    if(w==="last"||!w){if(lastSaid&&lastSaid.id)it=BOOK.items.find(x=>x.id===lastSaid.id);else if(lastSaid&&lastSaid.src==="ai"){it=mkLine(lastSaid.t,lastSaid.kind,v>0?"liked":"ai",v>0?1:-1);BOOK.items.push(it);lastSaid.id=it.id}}else it=BOOK.items.find(x=>norm(x.t).includes(norm(w)));
    if(!it)throw new Error("no such line");rate(it,v);return {ok:true,line:it.t,score:it.score,retired:it.score<=-2}}),
  tool("curate_lines","Write a fresh batch of personalised speech-bubble lines into your phrasebook. Returns how many were added.",{},[],async()=>curate(true)),
  tool("set_mood","Change your own mood on your emotion gauge. mood is one word (e.g. Happy, Teasing, Shy, Curious, Annoyed, Lonely); amount 5-40.",{mood:{type:"string"},amount:{type:"number"}},["mood"],async i=>{if(!feel(String(i.mood||""),clamp(+i.amount||18,5,40)))throw new Error("unknown mood word");return {ok:true,now:emoLine()}})];
  if(WEB&&MCP)T.push(tool("web_search","Search the web (Parallel Search). Returns up to 5 results with title, url and an excerpt.",{objective:{type:"string",description:"What you want to find out"},search_queries:{type:"array",items:{type:"string"}}},["objective"],async(i,ctx)=>{
    const q=(Array.isArray(i.search_queries)?i.search_queries:[]).map(String).filter(Boolean).slice(0,4),obj=String(i.objective||q[0]||"").slice(0,400);if(!obj)throw new Error("objective is required");
    const r=await MCP.callTool("Parallel Search","web_search",{objective:obj,search_queries:q.length?q:[obj]},ctx.signal?{signal:ctx.signal}:undefined),p=r&&r.payload||{};sys("🔎 Looked up: "+obj.slice(0,70));
    return {results:(Array.isArray(p.results)?p.results:[]).slice(0,5).map(x=>({title:String(x.title||"").slice(0,160),url:String(x.url||""),excerpt:(Array.isArray(x.excerpts)?x.excerpts.join(" "):String(x.excerpt||"")).slice(0,500)}))}}));
  return T}

/* 🔊 her voice (speechSynthesis) and your voice (Web Speech dictation); 🎧 talk mode listens again after she has spoken */
const TTS=window.speechSynthesis||null,SR=window.SpeechRecognition||window.webkitSpeechRecognition||null;let rec=null,talk=false,miss=0;
function speak(t,done){let fin=false;const end=()=>{if(fin)return;fin=true;done&&done()};const s=plain(t);if(!TTS||!s||typeof SpeechSynthesisUtterance==="undefined")return false;
  try{TTS.cancel();const u=new SpeechSynthesisUtterance(s),v=voices().find(x=>x.name===ST.set.voice);if(v)u.voice=v;u.rate=clamp(+ST.set.rate||1,.5,2);u.pitch=clamp(+ST.set.pitch||1,0,2);u.volume=clamp(+ST.set.vol,0,1);u.onend=u.onerror=end;TTS.speak(u);
    setTimeout(end,4000+s.split(" ").length*480/u.rate);return true}catch(e){return false}}
if(TTS&&TTS.addEventListener)try{TTS.addEventListener("voiceschanged",()=>{if(!SET.hidden)setRender()})}catch(e){}
function listen(){if(!SR){status("🎤 Dictation isn't supported in this browser. Try Chrome or Edge.");if(talk)setTalk(false);return}if(rec)return;try{TTS&&TTS.cancel()}catch(e){}
  const r=new SR(),base=talk||!INP.value.trim()?"":INP.value.trim()+" ";let sent=false;r.lang=navigator.language||"en-US";r.interimResults=true;r.continuous=false;r.maxAlternatives=1;
  r.onresult=ev=>{let f="",im="";for(let i=0;i<ev.results.length;i++){const x=ev.results[i];if(x.isFinal)f+=x[0].transcript;else im+=x[0].transcript}INP.value=(base+f+im).replace(/\s+/g," ").trimStart();
    if(f.trim()&&!sent){sent=true;miss=0;const t=INP.value;INP.value="";try{r.stop()}catch(e){}status("");send(t)}};
  r.onerror=ev=>{const e=ev.error;if(e==="not-allowed"||e==="service-not-allowed"){status("🎤 The microphone is blocked for this page. Allow it in the browser (inside claude.ai the page's frame must allow the microphone too).");setTalk(false)}
    else if(e==="audio-capture"){status("🎤 No microphone found.");setTalk(false)}else if(e==="no-speech")status("🎤 Didn't catch anything.");else if(e!=="aborted")status("🎤 Dictation stopped: "+e)};
  r.onend=()=>{rec=null;$('[data-a="mic"]').setAttribute("aria-pressed","false");if(!sent&&talk){if(++miss<3)setTimeout(()=>{if(talk&&!chatBusy)listen()},400);else{setTalk(false);status("🎧 Talk mode paused: I didn't hear anything.")}}};
  try{r.start();rec=r;$('[data-a="mic"]').setAttribute("aria-pressed","true");status(talk?"🎧 Listening… just talk.":"🎤 Listening…")}catch(e){rec=null;status("🎤 Couldn't start dictation.")}}
function stopListen(){const r=rec;rec=null;try{r&&r.abort()}catch(e){}$('[data-a="mic"]').setAttribute("aria-pressed","false")}
function setTalk(on){talk=!!on;miss=0;$('[data-a="talk"]').setAttribute("aria-pressed",String(talk));if(talk){if(!SR){status("🎧 Talk mode needs dictation, which this browser doesn't have.");talk=false;$('[data-a="talk"]').setAttribute("aria-pressed","false");return}status("🎧 Talk mode on: I'll listen again after I answer.");listen()}else{if(rec)stopListen();try{TTS&&TTS.cancel()}catch(e){}}}

/* ⌨ backtick (`) toggles her chat when you're not typing in a field */
document.addEventListener("keydown",e=>{if(e.key!=="`"||e.ctrlKey||e.metaKey||e.altKey||e.defaultPrevented)return;const t=(e.composedPath&&e.composedPath()[0])||e.target;if(t&&t.closest&&t.closest("input,textarea,select,[contenteditable],[contenteditable=true]"))return;if(t&&t.isContentEditable)return;
  e.preventDefault();if(ST.hidden)showPet(true);toggleChat(!chatOpen())});

/* 🚀 start: paint first, then light features up as the platform answers */
function start(){(document.body||document.documentElement).appendChild(host);$(".pet-name").textContent=NAME;media();avatarRender();emoApply();lightRender();PET.hidden=!!ST.hidden;PAW.hidden=!ST.hidden;place();
  addEventListener("resize",()=>place(),{passive:true});setInterval(()=>{try{beat()}catch(e){warn(e)}},5000);
  setTimeout(()=>{if(!ST.hidden&&!chatOpen())sayLine(greet(),"force")},2500);
  use("db").then(async d=>{DB=d||null;try{await bookLoad()}catch(e){warn("phrasebook",e)}store.watch(PATH.rem,r=>{REM=r&&Array.isArray(r.items)?r.items:[]})});
  pSample=use("sample").then(s=>{SAMPLE=s||null;return SAMPLE});use("mcp").then(m=>{MCP=m||null});
  REG[WHO]={version:"1.0",name:NAME,who:WHO,prefix:P,root,open:()=>{if(ST.hidden)showPet(true);toggleChat(true)},close:()=>toggleChat(false),show:()=>showPet(true),hide:()=>showPet(false),say:(t)=>say(String(t),{force:true}),
    feel:(w,a)=>feel(w,+a||12),curate:()=>curate(true),send:t=>send(t),book:()=>clone(BOOK),state:()=>clone(ST),emotion:()=>emoLine(),paths:()=>Object.assign({},PATH),flush:()=>{clearTimeout(bookT);return bookSave()}}}
try{if(document.body)start();else document.addEventListener("DOMContentLoaded",()=>{try{start()}catch(e){warn("start",e)}},{once:true})}catch(e){warn("start",e)}
})();
