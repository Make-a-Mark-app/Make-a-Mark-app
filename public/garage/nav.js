(()=>{
 const drawer=document.getElementById('navigation'),toggle=document.getElementById('menu-toggle');
 const motion=matchMedia('(prefers-reduced-motion: reduce)');
 let closing=false,closeTimer;
 function openNavigation(){if(drawer.open)return;clearTimeout(closeTimer);closing=false;clearSelection();stopPulses();drawer.classList.remove('is-closing');toggle.setAttribute('aria-expanded','true');drawer.showModal();requestAnimationFrame(()=>requestAnimationFrame(()=>{if(drawer.open&&!closing)drawer.classList.add('is-visible')}))}
 function closeNavigation(destination){if(!drawer.open||closing)return;closing=true;drawer.classList.add('is-closing');drawer.classList.remove('is-visible');toggle.setAttribute('aria-expanded','false');const finish=()=>{drawer.close();drawer.classList.remove('is-closing');closing=false;if(destination)openPanel(destination);else toggle.focus();startPulses()};if(motion.matches)finish();else closeTimer=setTimeout(finish,520)}
 toggle.addEventListener('click',openNavigation);
 document.getElementById('menu-close').addEventListener('click',()=>closeNavigation());
 document.getElementById('menu-return').addEventListener('click',()=>closeNavigation());
 drawer.addEventListener('cancel',event=>{event.preventDefault();closeNavigation()});
 drawer.addEventListener('click',event=>{if(event.target!==drawer)return;const bounds=drawer.getBoundingClientRect();if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom)closeNavigation()});
 drawer.querySelectorAll('[data-destination]').forEach(button=>button.addEventListener('click',()=>closeNavigation(button.dataset.destination)));
})();
