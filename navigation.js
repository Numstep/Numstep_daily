(() => {
 const button=document.getElementById("moreButton"), menu=document.getElementById("moreMenu");
 if(!button||!menu)return;
 button.addEventListener("click",()=>{const open=button.getAttribute("aria-expanded")==="true";button.setAttribute("aria-expanded",String(!open));menu.hidden=open;});
 document.addEventListener("click",e=>{if(!menu.hidden&&!menu.contains(e.target)&&!button.contains(e.target)){menu.hidden=true;button.setAttribute("aria-expanded","false");}});
 const page=location.pathname.split("/").pop()||"index.html";
 menu.querySelectorAll("a").forEach(a=>{if(a.getAttribute("href")===page){a.classList.add("active");a.setAttribute("aria-current","page");}});
})();