"use strict";
let selectedDate=new Date(),puzzle=null,chains=new Map(),activeChain=null,attempts=0,startedAt=null,timerHandle=null,solved=false;
const grid=document.getElementById("boxGrid"),msg=document.getElementById("message"),progress=document.getElementById("boxProgress"),attemptsEl=document.getElementById("attempts"),timer=document.getElementById("timer");
const FACES=["TOP","BOTTOM","LEFT","FRONT","RIGHT","BACK"];
const PALETTE=["#4E79A7","#59A14F","#F28E2B","#E15759","#B07AA1","#76B7B2","#EDC948","#9C755F"];
const NET={LEFT:[1,2],FRONT:[2,2],RIGHT:[3,2],BACK:[4,2],TOP:[2,1],BOTTOM:[2,3]};
function fd(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`}
function dd(d){return d.toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short",year:"numeric"})}
function clue(v){return v>0&&(v===1||v%10===0)}
function key(p){return p.join(",")}
function same(a,b){return a[0]===b[0]&&a[1]===b[1]&&a[2]===b[2]}

// These edge pairings mirror the Box generator exactly, including reversed
// indexing where folding the flat net flips an edge. Keeping one canonical
// table prevents the playable game from disagreeing with generated puzzles.
const FACE_EDGES=[
 ["FRONT","top","TOP","bottom",false],
 ["FRONT","bottom","BOTTOM","top",false],
 ["BACK","top","TOP","top",true],
 ["BACK","bottom","BOTTOM","bottom",false],
 ["FRONT","left","LEFT","right",false],
 ["FRONT","right","RIGHT","left",false],
 ["LEFT","top","TOP","left",false],
 ["LEFT","bottom","BOTTOM","left",true],
 ["RIGHT","top","TOP","right",false],
 ["RIGHT","bottom","BOTTOM","right",false],
 ["LEFT","right","BACK","left",false],
 ["RIGHT","right","BACK","right",false]
];
function edgeCoordinate(face,edge,row,col,n){
 if(edge==="top")return row===0?col:null;
 if(edge==="bottom")return row===n-1?col:null;
 if(edge==="left")return col===0?row:null;
 if(edge==="right")return col===n-1?row:null;
 return null;
}
function surfaceAdjacent(a,b){
 if(a[0]===b[0])return Math.abs(a[1]-b[1])+Math.abs(a[2]-b[2])===1;
 const n=puzzle.size;
 for(const [fa,ea,fb,eb,reverse] of FACE_EDGES){
  let ia=null,ib=null;
  if(a[0]===fa&&b[0]===fb){
   ia=edgeCoordinate(fa,ea,a[1],a[2],n);ib=edgeCoordinate(fb,eb,b[1],b[2],n);
  }else if(a[0]===fb&&b[0]===fa){
   ia=edgeCoordinate(fa,ea,b[1],b[2],n);ib=edgeCoordinate(fb,eb,a[1],a[2],n);
  }else continue;
  if(ia!==null&&ib!==null&&ia===(reverse?n-1-ib:ib))return true;
 }
 return false;
}
function value(p){return puzzle.solution[puzzle.faces[p[0]]][p[1]][p[2]]}
function allValues(){return puzzle.faces.flatMap(face=>puzzle.solution[face].flat())}
function positions(){const m=new Map();for(let f=0;f<puzzle.faces.length;f++)for(let r=0;r<puzzle.size;r++)for(let c=0;c<puzzle.size;c++){const v=value([f,r,c]);if(clue(v))m.set(v,[f,r,c])}return m}
function initialise(){chains=new Map();const cp=positions(),vals=allValues().filter(v=>v>0),max=Math.max(...vals),cs=[...cp.keys()].sort((a,b)=>a-b);cs.forEach((v,i)=>{const next=cs[i+1];if(v===max&&!next)return;chains.set(v,{clue:v,end:next?next-1:max,path:[cp.get(v)],complete:false})})}
function colour(v){const k=[...chains.keys()].sort((a,b)=>a-b),i=k.indexOf(v);return PALETTE[(i<0?0:i)%PALETTE.length]}
function resetTimer(){if(timerHandle)clearInterval(timerHandle);timerHandle=null;startedAt=null;timer.textContent="00:00"}
function startTimer(){if(startedAt!==null)return;startedAt=Date.now();timerHandle=setInterval(()=>{const s=Math.floor((Date.now()-startedAt)/1000);timer.textContent=`${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`},1000)}
function render(){const fragment=document.createDocumentFragment(),rendered=new Map();for(const ch of chains.values())ch.path.forEach((p,i)=>rendered.set(key(p),{v:value(p),clue:ch.clue,step:ch.clue+i}));for(let f=0;f<puzzle.faces.length;f++){const face=puzzle.faces[f],sec=document.createElement("section"),pos=NET[face];sec.className="boxFace";sec.style.gridColumn=String(pos[0]);sec.style.gridRow=String(pos[1]);const fg=document.createElement("div");fg.className="boxFaceGrid";for(let r=0;r<puzzle.size;r++)for(let c=0;c<puzzle.size;c++){const p=[f,r,c],v=value(p),b=document.createElement("button");b.type="button";b.className="boxCell";b.dataset.position=key(p);b.setAttribute("aria-label",`${face}, row ${r+1}, column ${c+1}`);if(v===0){b.classList.add("black");b.disabled=true}else{const st=rendered.get(key(p));if(clue(v))b.classList.add("clue");if(st){b.classList.add("chainCell");b.textContent=String(st.step);b.dataset.numstepColour=colour(st.clue);b.style.setProperty("background-color",colour(st.clue),"important");b.style.setProperty("color","#fff","important")}else if(clue(v)){b.textContent=String(v);b.dataset.numstepColour=colour(v);b.style.setProperty("background-color",colour(v),"important");b.style.setProperty("color","#fff","important")}}if(activeChain&&activeChain.path.length&&same(activeChain.path[activeChain.path.length-1],p))b.classList.add("current");fg.appendChild(b)}sec.appendChild(fg);fragment.appendChild(sec)}grid.replaceChildren(fragment);const done=[...chains.values()].reduce((n,c)=>n+c.path.length,0);progress.textContent=`${done} / ${puzzle.steps}`}
function fail(text){attempts++;attemptsEl.textContent=`Attempts: ${attempts}`;const ch=chains.get(activeChain);if(ch)ch.path=[ch.path[0]];activeChain=null;render();msg.textContent=text}
function select(p){if(solved)return;if(activeChain===null){if(!clue(value(p))){msg.textContent="Start from a coloured clue.";return}const ch=chains.get(value(p));if(!ch){msg.textContent="That is the final marker.";return}activeChain=value(p);startTimer();render();msg.textContent=`Chain ${value(p)}–${ch.end} started. Select ${value(p)+1} next.`;return}const ch=chains.get(activeChain),last=ch.path[ch.path.length-1],expected=value(last)+1;if(!surfaceAdjacent(last,p)){fail("The next step must share an edge on the box surface.");return}if(ch.path.some(x=>same(x,p))){fail("You cannot revisit a box square.");return}if(value(p)!==expected||value(p)>ch.end){fail(`Wrong next step. You need ${expected}. The current chain is broken.`);return}ch.path.push(p);render();if(value(p)===ch.end){ch.complete=true;activeChain=null;if([...chains.values()].every(x=>x.complete)){solved=true;if(timerHandle)clearInterval(timerHandle);msg.textContent="Solved! Every chain is complete.";shareResult()}else msg.textContent=`Chain ${ch.clue}–${ch.end} complete. Start another coloured clue.`}}
async function shareResult(){if(typeof showShareModal!=="function")return;showShareModal({size:puzzle.size,date:fd(selectedDate),elapsed:startedAt?Date.now()-startedAt:0,attempts,url:window.location.href,badgeImageUrl:""})}
function resetGame(){solved=false;attempts=0;attemptsEl.textContent="Attempts: 0";activeChain=null;resetTimer();initialise();msg.textContent="Choose any coloured clue to start.";render()}
async function loadPuzzleForDate(ds){try{const r=await fetch(`data/${ds}.json`,{cache:"no-store"});if(!r.ok)throw Error();puzzle=await r.json();resetGame()}catch(e){puzzle=null;grid.replaceChildren();progress.textContent="0 / 0";msg.textContent=`No Box puzzle is available for ${dd(selectedDate)}.`}}
function nav(){const ds=fd(selectedDate);document.getElementById("currentDate").textContent=dd(selectedDate);document.getElementById("pdfLink").href=`printables/${ds}.pdf`;document.getElementById("nextDay").disabled=ds===fd(new Date());loadPuzzleForDate(ds)}
document.getElementById("prevDay").onclick=()=>{selectedDate.setDate(selectedDate.getDate()-1);nav()};document.getElementById("nextDay").onclick=()=>{const n=new Date(selectedDate);n.setDate(n.getDate()+1);if(n<=new Date()){selectedDate=n;nav()}};document.getElementById("resetButton").onclick=()=>puzzle&&resetGame();
const moreButton=document.getElementById("moreButton"),moreMenu=document.getElementById("moreMenu");moreButton.onclick=()=>{const open=moreButton.getAttribute("aria-expanded")==="true";moreButton.setAttribute("aria-expanded",String(!open));moreMenu.hidden=open};document.addEventListener("click",e=>{if(!moreMenu.hidden&&!moreMenu.contains(e.target)&&!moreButton.contains(e.target)){moreMenu.hidden=true;moreButton.setAttribute("aria-expanded","false")}});nav();
