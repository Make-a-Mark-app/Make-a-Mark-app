'use strict';
const objects=[...document.querySelectorAll('.object')];
const layers=[...document.querySelectorAll('.light-overlay')];
const garage=document.querySelector('#garage'),entrance=document.querySelector('#entrance'),world=document.querySelector('#world');
const hud=document.querySelector('#hud'),panel=document.querySelector('#panel'),fallback=document.querySelector('#scene-fallback');
const connector=document.querySelector('#hud-connector'),connectorPath=document.querySelector('#hud-connector-path');
const reduced=matchMedia('(prefers-reduced-motion: reduce)'),touch=matchMedia('(hover: none)');
const entries={
 game:{code:'01 / PLAY',title:'Game',description:'Step into the driver’s seat.'},
 video:{code:'02 / WATCH',title:'Video',description:'See the story in motion.'},
 reports:{code:'03 / DISCOVER',title:'Reports & articles',description:'Read. Explore. Look a little closer.'},
 shop:{code:'04 / GROW',title:'Pilot rewards',description:'Explore the proposed reward journey.'}
};
const destinationPaths={game:'/mission/freight',video:'/video',reports:'/library',shop:'/rewards'};
let selected=null,hideTimer=null,doorTimer=null,pulseTimer=null,restoreFocus=null,sceneFailed=false;
let pulseDelays=[],loadDeadline=null;
let hudHideTimer=null,hudBootTimer=null,cursorFrame=null;
layers.forEach(layer=>layer.addEventListener('animationend',()=>layer.classList.remove('is-pulsing')));
function clearSelection(){
 clearTimeout(hudHideTimer);clearTimeout(hudBootTimer);hud.classList.remove('is-closing','is-revealing');connector?.classList.remove('is-active','is-revealing');
 clearTimeout(hideTimer);selected=null;hud.hidden=true;
 objects.forEach(button=>{button.classList.remove('is-active');button.setAttribute?.('aria-expanded','false')});
 layers.forEach(layer=>layer.classList.remove('is-active'));
 document.querySelectorAll('[data-shortcut]').forEach(button=>button.setAttribute('aria-pressed','false'));
}
function positionHud(){
 if(hud.hidden||sceneFailed)return;
 const scene=document.querySelector('#scene'),button=objects.find(item=>item.dataset.key===selected);
 if(!button)return;
 const sceneBox=scene.getBoundingClientRect(),worldBox=world.getBoundingClientRect();
 const width=scene.clientWidth||scene.offsetWidth;
 const min=Math.max(12,worldBox.left-sceneBox.left+12);
 const max=Math.max(min,Math.min(width-hud.offsetWidth-12,worldBox.right-sceneBox.left-hud.offsetWidth-12));
 const desired=button.offsetLeft+button.offsetWidth/2-hud.offsetWidth/2;
 hud.style.left=Math.max(min,Math.min(max,desired))+'px';hud.style.right='auto';
 const minY=Math.max(12,worldBox.top-sceneBox.top+12);
 const maxY=Math.max(minY,Math.min(scene.clientHeight-hud.offsetHeight-12,worldBox.bottom-sceneBox.top-hud.offsetHeight-12));
 const marker=selected==='shop'?button.querySelector('.beacon'):null;
 const anchorTop=marker?marker.getBoundingClientRect().top+marker.offsetHeight/2-sceneBox.top:button.offsetTop;
 let top=selected==='video'?button.offsetTop+button.offsetHeight+14:anchorTop-hud.offsetHeight-14;
 if(top<minY&&!marker)top=button.offsetTop+button.offsetHeight+14;
 hud.style.top=Math.max(minY,Math.min(maxY,top))+'px';
 positionConnector();
}
function positionConnector(){
 if(!connectorPath||hud.hidden||sceneFailed)return;
 const scene=document.querySelector('#scene'),button=objects.find(item=>item.dataset.key===selected);if(!button)return;
 const beacon=button.querySelector?.('.beacon');const origin=(beacon||button).getBoundingClientRect(),sceneBox=scene.getBoundingClientRect();
 const x=origin.left+(origin.right-origin.left)/2-sceneBox.left,y=origin.top+(origin.bottom-origin.top)/2-sceneBox.top;
 const left=parseFloat(hud.style.left)||hud.offsetLeft,top=parseFloat(hud.style.top)||hud.offsetTop;
 const above=top+hud.offsetHeight/2<y,ex=left+hud.offsetWidth*.28,ey=above?top+hud.offsetHeight:top;
 connectorPath.setAttribute('d',`M ${x} ${y} L ${x} ${ey+(above?18:-18)} L ${ex} ${ey}`);
}
function revealHud(changed){
 clearTimeout(hudHideTimer);hud.classList.remove('is-closing');connector?.classList.add('is-active');
 if(!changed||reduced.matches||sceneFailed)return;
 clearTimeout(hudBootTimer);hud.classList.remove('is-revealing');connector?.classList.remove('is-revealing');void hud.offsetWidth;
 hud.style.setProperty?.('--cursor-x','50%');hud.style.setProperty?.('--cursor-y','50%');
 hud.classList.add('is-revealing');connector?.classList.add('is-revealing');
 hudBootTimer=setTimeout(()=>{hud.classList.remove('is-revealing');connector?.classList.remove('is-revealing')},1050);
}
function retractHud(){
 if(reduced.matches){clearSelection();return}
 hud.classList.remove('is-revealing');hud.classList.add('is-closing');connector?.classList.remove('is-active','is-revealing');
 clearTimeout(hudHideTimer);hudHideTimer=setTimeout(clearSelection,150);
}
function selectObject(key){
 clearTimeout(hideTimer);const entry=entries[key];if(!entry)return;
 const changed=selected!==key||hud.hidden||hud.classList.contains('is-closing');
 selected=key;hud.dataset.key=key;
 document.querySelector('#hud-code').textContent=entry.code;
 document.querySelector('#hud-title').textContent=entry.title;
 document.querySelector('#hud-description').textContent=entry.description;
 hud.hidden=sceneFailed;positionHud();
 revealHud(changed);
 objects.forEach(button=>{const active=button.dataset.key===key;button.classList.toggle('is-active',active);button.setAttribute?.('aria-expanded',String(active))});
 layers.forEach(layer=>{layer.classList.remove('is-pulsing');layer.classList.toggle('is-active',layer.dataset.light===key)});
 document.querySelectorAll('[data-shortcut]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.shortcut===key)));
 if(sceneFailed)document.querySelector('#fallback-selection').textContent=entry.title+' selected. Activate its button to open this area.';
}
function dismissSoon(){
 clearTimeout(hideTimer);hideTimer=setTimeout(()=>{
 const focused=objects.find(button=>button.dataset.key===selected);
 if(!hud.matches(':hover')&&!hud.contains(document.activeElement)&&focused!==document.activeElement&&!document.activeElement?.matches?.('[data-shortcut]'))retractHud();
 },220);
}
function openPanel(key){
 const destination=destinationPaths[key];if(!destination)return;
 if(window.parent!==window){
  window.parent.postMessage({type:'garage:navigate',destination:key},window.location.origin);
 }else{
  window.location.assign(destination);
 }
}
objects.forEach(button=>{
 const key=button.dataset.key;
 button.addEventListener('pointerenter',event=>{if(event.pointerType!=='touch')selectObject(key)});
 button.addEventListener('pointerleave',event=>{if(event.pointerType!=='touch')dismissSoon()});
 button.addEventListener('focus',()=>selectObject(key));
 button.addEventListener('blur',dismissSoon);
 button.addEventListener('click',()=>openPanel(key));
});
document.querySelectorAll('[data-shortcut]').forEach(button=>button.addEventListener('click',()=>openPanel(button.dataset.shortcut)));
hud.addEventListener('pointerenter',()=>{clearTimeout(hideTimer);clearTimeout(hudHideTimer);hud.classList.remove('is-closing');if(selected)connector?.classList.add('is-active')});
hud.addEventListener('pointerleave',dismissSoon);
hud.addEventListener('pointermove',event=>{
 if(reduced.matches||event.pointerType==='touch')return;
 const rect=hud.getBoundingClientRect(),x=Math.max(0,Math.min(1,(event.clientX-rect.left)/(rect.right-rect.left))),y=Math.max(0,Math.min(1,(event.clientY-rect.top)/(rect.bottom-rect.top)));
 cancelAnimationFrame(cursorFrame);cursorFrame=requestAnimationFrame(()=>{hud.style.setProperty('--cursor-x',`${x*100}%`);hud.style.setProperty('--cursor-y',`${y*100}%`)});
});
document.querySelector('#help').addEventListener('click',()=>{
 restoreFocus=document.querySelector('#help');clearSelection();
 document.querySelector('#panel-code').textContent='GARAGE / EXPLORER GUIDE';
 document.querySelector('#panel-title').textContent='Follow your curiosity.';
 document.querySelector('#panel-text').textContent=touch.matches?'Tap an object or shortcut to open an area. Swipe across the garage to explore.':'Hover over an object to reveal its label. Click it, use the menu, or press Tab and Enter to open an area.';
 document.querySelector('#panel-note').textContent='Game, video, reports and Pilot rewards open in this site.';
 panel.showModal();
});
document.querySelectorAll('.close,.back').forEach(button=>button.addEventListener('click',()=>panel.close()));
panel.addEventListener('click',event=>{if(event.target!==panel)return;const box=panel.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)panel.close()});
panel.addEventListener('close',()=>{restoreFocus?.focus({preventScroll:true});clearSelection()});
document.addEventListener('keydown',event=>{if(event.key==='Escape')clearSelection()});
world.addEventListener('pointerdown',event=>{if(!event.target.closest('.object,.hud'))clearSelection()});
world.addEventListener('scroll',()=>{if(selected)positionHud()},{passive:true});
function stopPulses(){
 clearInterval(pulseTimer);pulseTimer=null;pulseDelays.forEach(clearTimeout);pulseDelays=[];
 layers.forEach(layer=>layer.classList.remove('is-pulsing'));
}
function interactionBusy(){return selected||panel.open||document.hidden||document.querySelector('#navigation')?.open||sceneFailed}
function startPulses(){
 stopPulses();if(reduced.matches||document.hidden||!entrance.hidden||sceneFailed||document.querySelector('#navigation')?.open)return;
 pulseTimer=setInterval(()=>{
 if(interactionBusy())return;
 pulseDelays.forEach(clearTimeout);pulseDelays=[];
 layers.forEach((layer,index)=>{pulseDelays.push(setTimeout(()=>{if(!interactionBusy()&&!reduced.matches)layer.classList.add('is-pulsing')},index*200))});
 },6000);
}
function finishOpening(){
 clearTimeout(doorTimer);entrance.hidden=true;entrance.classList.remove('is-opening');garage.inert=false;
 startPulses();
}
function openGarage(){
 if(entrance.hidden||entrance.classList.contains('is-opening'))return;
 if(reduced.matches||sceneFailed){finishOpening();return}
 document.querySelector('#loading-message').textContent='Opening the garage';
 entrance.classList.add('is-opening');doorTimer=setTimeout(finishOpening,1150);
}
function showFallback(){
 sceneFailed=true;clearSelection();stopPulses();garage.classList.add('scene-unavailable');
 if(fallback)fallback.hidden=false;
 document.querySelector('#fallback-selection').textContent='The garage image could not load. Use a button below to open an area.';
 finishOpening();
}
function prepareEntrance(){
 const image=document.querySelector('.garage-image');let ready=false;
 const clean=()=>{clearTimeout(loadDeadline);image.removeEventListener('load',loaded);image.removeEventListener('error',failed)};
 const loaded=()=>{if(ready)return;ready=true;clean();sceneFailed=false;garage.classList.remove('scene-unavailable');if(fallback)fallback.hidden=true;document.querySelector('#loading-message').textContent='Garage ready';if(reduced.matches)finishOpening();else doorTimer=setTimeout(openGarage,250)};
 const failed=()=>{if(ready)return;ready=true;clean();showFallback()};
 loadDeadline=setTimeout(failed,5000);
 if(image.complete){if(image.naturalWidth===0)failed();else loaded()}else{image.addEventListener('load',loaded);image.addEventListener('error',failed)}
}
document.querySelector('#retry-scene')?.addEventListener('click',()=>{
 const image=document.querySelector('.garage-image');
 const mobileSource=document.querySelector('picture source');if(mobileSource)mobileSource.srcset='assets/garage-mobile.webp?retry='+Date.now();
 image.src='assets/garage.webp?retry='+Date.now();prepareEntrance();
});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopPulses();else startPulses()});
reduced.addEventListener('change',()=>{if(reduced.matches&&!entrance.hidden)finishOpening();startPulses()});
window.addEventListener('resize',()=>{if(selected)positionHud()});
prepareEntrance();
