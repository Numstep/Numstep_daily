"use strict";
let selectedDate=new Date(),puzzle=null,chains=new Map(),activeChain=null,attempts=0,startedAt=null,timerHandle=null,solved=false;
const grid=document.getElementById("boxGrid"),msg=document.getElementById("message"),progress=document.getElementById("boxProgress"),attemptsEl=document.getElementById("attempts"),timer=document.getElementById("timer");
const FACES=["TOP","BOTTOM","LEFT","FRONT","RIGHT","BACK"];
const PALETTE=["#4E79A7","#59A14F","#F28E2B","#E15759","#B07AA1","#76B7B2","#EDC948","#9C755F"];
const NET={LEFT:[1,2],FRONT:[2,2],RIGHT:[3,2],BACK:[4,2],TOP:[2,1],BOTTOM:[2,3]};

// Physical Box cells are numbered 1-54 in face order, row-major within each
// 3x3 face: TOP 1-9, BOTTOM 10-18, LEFT 19-27, FRONT 28-36,
// RIGHT 37-45, BACK 46-54. Each entry lists the four cells sharing an edge
// with it on the folded cube surface. Keeping this explicit makes the topology
// easy to inspect and removes ambiguity from face-edge coordinate transforms.
const CELL_ADJACENCY=Object.freeze({
  1:[2,4,21,28],2:[1,3,5,29],3:[2,6,30,37],4:[1,5,7,20],5:[2,4,6,8],6:[3,5,9,38],7:[4,8,19,48],8:[5,7,9,47],9:[6,8,39,46],
  10:[11,13,25,54],11:[10,12,14,53],12:[11,15,45,52],13:[10,14,16,26],14:[11,13,15,17],15:[12,14,18,44],16:[13,17,27,34],17:[14,16,18,35],18:[15,17,36,43],
  19:[7,20,22,48],20:[4,19,21,23],21:[1,20,24,28],22:[19,23,25,51],23:[20,22,24,26],24:[21,23,27,31],25:[10,22,26,54],26:[13,23,25,27],27:[16,24,26,34],
  28:[1,21,29,31],29:[2,28,30,32],30:[3,29,33,37],31:[24,28,32,34],32:[29,31,33,35],33:[30,32,36,40],34:[16,27,31,35],35:[17,32,34,36],36:[18,33,35,43],
  37:[3,30,38,40],38:[6,37,39,41],39:[9,38,42,46],40:[33,37,41,43],41:[38,40,42,44],42:[39,41,45,49],43:[18,36,40,44],44:[15,41,43,45],45:[12,42,44,52],
  46:[9,39,47,49],47:[8,46,48,50],48:[7,19,47,51],49:[42,46,50,52],50:[47,49,51,53],51:[22,48,50,54],52:[12,45,49,53],53:[11,50,52,54],54:[10,25,51,53]
});
const CELL_FACE_OFFSETS={TOP:0,BOTTOM:9,LEFT:18,FRONT:27,RIGHT:36,BACK:45};
function cellId(p){return CELL_FACE_OFFSETS[puzzle.faces[p[0]]]+p[1]*3+p[2]+1}
function cellsAdjacent(a,b){const idA=cellId(a),idB=cellId(b);return CELL_ADJACENCY[idA]?.includes(idB)===true}
function fd(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`}
function dd(d){return d.toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short",year:"numeric"})}
function clue(v){return v>0&&(v===1||v%10===0)}
function key(p){return p.join(",")}
function same(a,b){return a[0]===b[0]&&a[1]===b[1]&&a[2]===b[2]}
function value(p){return puzzle.solution[puzzle.faces[p[0]]][p[1]][p[2]]}
function allValues(){return puzzle.faces.flatMap(face=>puzzle.solution[face].flat())}
function positions(){const m=new Map();for(let f=0;f<puzzle.faces.length;f++)for(let r=0;r<puzzle.size;r++)for(let c=0;c<puzzle.size;c++){const v=value([f,r,c]);if(clue(v))m.set(v,[f,r,c])}return m}
function initialise(){chains=new Map();const cp=positions(),vals=allValues().filter(v=>v>0),max=Math.max(...vals),cs=[...cp.keys()].sort((a,b)=>a-b);cs.forEach((v,i)=>{const next=cs[i+1];if(v===max&&!next)return;chains.set(v,{clue:v,end:next?next-1:max,path:[cp.get(v)],complete:false})})}
function colour(v){const k=[...chains.keys()].sort((a,b)=>a-b),i=k.indexOf(v);return PALETTE[(i<0?0:i)%PALETTE.length]}
function resetTimer(){if(timerHandle)clearInterval(timerHandle);timerHandle=null;startedAt=null;timer.textContent="00:00"}
function startTimer(){if(startedAt!==null)return;startedAt=Date.now();timerHandle=setInterval(()=>{const s=Math.floor((Date.now()-startedAt)/1000);timer.textContent=`${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`},1000)}

// Match Classic's user-facing pointer behaviour while keeping the gesture
// inside the Box game. Box replaces the entire net after every accepted move,
// so the gesture cannot use pointer capture on a cell that is about to be
// removed. Instead, keep the active pointer on the document and resolve the
// live cell from its screen position.
let activePointerId=null,lastPointerPosition=null;
function setupDragControls(){
 document.addEventListener("pointerdown",event=>{const cell=event.target.closest?.("#boxGrid .boxCell:not(.black):not(:disabled)");if(!cell||event.button>0||solved)return;activePointerId=event.pointerId;lastPointerPosition=null;event.preventDefault();selectCell(cell)},true);
 document.addEventListener("pointermove",event=>{if(event.pointerId!==activePointerId||solved)return;event.preventDefault();const element=document.elementFromPoint(event.clientX,event.clientY);const cell=element?.closest?.("#boxGrid .boxCell:not(.black):not(:disabled)");if(!cell)return;selectCell(cell)},true);
 document.addEventListener("pointerup",endPointer,true);document.addEventListener("pointercancel",endPointer,true);window.addEventListener("blur",cancelDragging);
}
function selectCell(cell){const positionKey=cell?.dataset.position;if(!positionKey||positionKey===lastPointerPosition)return;const parts=positionKey.split(",").map(Number);if(parts.length!==3||!parts.every(Number.isInteger))return;lastPointerPosition=positionKey;select(parts)}
function endPointer(event){if(event.pointerId===activePointerId)cancelDragging()}
function cancelDragging(){activePointerId=null;lastPointerPosition=null}

function render(){const fragment=document.createDocumentFragment(),rendered=new Map();for(const ch of chains.values())ch.path.forEach((p,i)=>rendered.set(key(p),{v:value(p),clue:ch.clue,step:ch.clue+i}));for(let f=0;f<puzzle.faces.length;f++){const face=puzzle.faces[f],sec=document.createElement("section"),pos=NET[face];sec.className="boxFace";sec.style.gridColumn=String(pos[0]);sec.style.gridRow=String(pos[1]);const fg=document.createElement("div");fg.className="boxFaceGrid";for(let r=0;r<puzzle.size;r++)for(let c=0;c<puzzle.size;c++){const p=[f,r,c],v=value(p),b=document.createElement("button");b.type="button";b.className="boxCell";b.dataset.position=key(p);b.setAttribute("aria-label",`${face}, row ${r+1}, column ${c+1}`);if(v===0){b.classList.add("black");b.disabled=true}else{const st=rendered.get(key(p));if(clue(v))b.classList.add("clue");if(st){b.classList.add("chainCell");b.textContent=String(st.step);b.dataset.numstepColour=colour(st.clue);b.style.setProperty("background-color",colour(st.clue),"important");b.style.setProperty("color","#fff","important")}else if(clue(v)){b.textContent=String(v);b.dataset.numstepColour=colour(v);b.style.setProperty("background-color",colour(v),"important");b.style.setProperty("color","#fff","important")}}if(activeChain&&activeChain.path.length&&same(activeChain.path[activeChain.path.length-1],p))b.classList.add("current");fg.appendChild(b)}sec.appendChild(fg);fragment.appendChild(sec)}grid.replaceChildren(fragment);const done=[...chains.values()].reduce((n,c)=>n+c.path.length,0);progress.textContent=`${done} / ${puzzle.steps}`}
function fail(text){attempts++;attemptsEl.textContent=`Attempts: ${attempts}`;const ch=chains.get(activeChain);if(ch)ch.path=[ch.path[0]];activeChain=null;cancelDragging();render();msg.textContent=text}
function select(p){if(solved)return;if(activeChain===null){if(!clue(value(p))){msg.textContent="Start from a coloured clue.";return}const ch=chains.get(value(p));if(!ch){msg.textContent="That is the final marker.";return}activeChain=value(p);startTimer();render();msg.textContent=`Chain ${value(p)}–${ch.end} started. Select ${value(p)+1} next.`;return}const ch=chains.get(activeChain),last=ch.path[ch.path.length-1],expected=value(last)+1;if(!cellsAdjacent(last,p)){fail("The next step must share an edge on the box surface.");return}if(ch.path.some(x=>same(x,p))){fail("You cannot revisit a box square.");return}if(value(p)!==expected||value(p)>ch.end){fail(`Wrong next step. You need ${expected}. The current chain is broken.`);return}ch.path.push(p);render();if(value(p)===ch.end){ch.complete=true;activeChain=null;if([...chains.values()].every(x=>x.complete)){solved=true;cancelDragging();if(timerHandle)clearInterval(timerHandle);msg.textContent="Solved! Every chain is complete.";shareResult()}else msg.textContent=`Chain ${ch.clue}–${ch.end} complete. Start another coloured clue.`}}
async function shareResult(){if(typeof showShareModal!=="function")return;showShareModal({size:puzzle.size,date:fd(selectedDate),elapsed:startedAt?Date.now()-startedAt:0,attempts,url:window.location.href,badgeImageUrl:""})}
function resetGame(){solved=false;attempts=0;attemptsEl.textContent="Attempts: 0";activeChain=null;cancelDragging();resetTimer();initialise();msg.textContent="Choose any coloured clue to start.";render()}
async function loadPuzzleForDate(ds){try{const r=await fetch(`data/${ds}.json`,{cache:"no-store"});if(!r.ok)throw Error();puzzle=await r.json();resetGame()}catch(e){console.error("Failed to load Box puzzle",e);puzzle=null;grid.replaceChildren();progress.textContent="0 / 0";msg.textContent=`No Box puzzle is available for ${dd(selectedDate)}.`}}
function nav(){const ds=fd(selectedDate);document.getElementById("currentDate").textContent=dd(selectedDate);document.getElementById("pdfLink").href=`printables/${ds}.pdf`;document.getElementById("nextDay").disabled=ds===fd(new Date());loadPuzzleForDate(ds)}
document.getElementById("prevDay").onclick=()=>{selectedDate.setDate(selectedDate.getDate()-1);nav()};document.getElementById("nextDay").onclick=()=>{const n=new Date(selectedDate);n.setDate(n.getDate()+1);if(n<=new Date()){selectedDate=n;nav()}};document.getElementById("resetButton")?.addEventListener("click",()=>puzzle&&resetGame());
const moreButton=document.getElementById("moreButton"),moreMenu=document.getElementById("moreMenu");moreButton.onclick=()=>{const open=moreButton.getAttribute("aria-expanded")==="true";moreButton.setAttribute("aria-expanded",String(!open));moreMenu.hidden=open};document.addEventListener("click",e=>{if(!moreMenu.hidden&&!moreMenu.contains(e.target)&&!moreButton.contains(e.target)){moreMenu.hidden=true;moreButton.setAttribute("aria-expanded","false")}});
setupDragControls();
nav();
