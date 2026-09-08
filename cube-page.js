let selectedDate=new Date();
function formatDate(d){return d.toISOString().slice(0,10);}
function displayDate(d){return d.toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short",year:"numeric"});}
function updateDate(){document.getElementById("currentDate").textContent=displayDate(selectedDate);document.getElementById("pdfLink").href=`cube-pdfs/${formatDate(selectedDate)}.pdf`;document.getElementById("nextDay").disabled=selectedDate>=new Date(new Date().setHours(0,0,0,0));}
document.getElementById("prevDay").onclick=()=>{selectedDate.setDate(selectedDate.getDate()-1);updateDate();};
document.getElementById("nextDay").onclick=()=>{selectedDate.setDate(selectedDate.getDate()+1);updateDate();};
document.getElementById("resetCube").onclick=()=>renderNumstepCube();
renderNumstepCube();updateDate();