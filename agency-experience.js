"use strict";
(()=> {
  const menuButton=document.querySelector('.agency-menu-toggle');
  const nav=document.querySelector('#agencyNav');
  const closeMenu=()=>{
    if(!menuButton||!nav)return;
    nav.classList.remove('is-open');
    menuButton.setAttribute('aria-expanded','false');
    menuButton.setAttribute('aria-label','메뉴 열기');
  };
  if(menuButton&&nav){
    menuButton.addEventListener('click',()=>{
      const open=menuButton.getAttribute('aria-expanded')==='true';
      menuButton.setAttribute('aria-expanded',String(!open));
      menuButton.setAttribute('aria-label',open?'메뉴 열기':'메뉴 닫기');
      nav.classList.toggle('is-open',!open);
    });
    nav.querySelectorAll('a').forEach(link=>link.addEventListener('click',closeMenu));
    window.addEventListener('keydown',ev=>{if(ev.key==='Escape')closeMenu()});
    document.addEventListener('click',ev=>{
      if(!nav.contains(ev.target)&&!menuButton.contains(ev.target))closeMenu();
    });
    window.addEventListener('resize',()=>{if(innerWidth>950)closeMenu()});
  }

  // Motion is decorative; the page remains completely usable without JS.
  const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const items=[...document.querySelectorAll('[data-reveal]')];
  if(!reduced&&'IntersectionObserver' in window&&items.length){
    const observer=new IntersectionObserver(entries=>{
      for(const entry of entries){
        if(entry.isIntersecting){
          entry.target.classList.add('is-revealed');
          observer.unobserve(entry.target);
        }
      }
    },{rootMargin:'0px 0px -20px 0px',threshold:.06});
    items.forEach(el=>observer.observe(el));
    document.documentElement.classList.add('has-motion');
  }

  // Cross-page deep links select the relevant inquiry product on the homepage.
  const productField=document.getElementById('requestedProduct');
  const requested=new URLSearchParams(location.search).get('service');
  if(productField&&requested){
    const valid=[...productField.options].find(x=>x.value===requested);
    if(valid)productField.value=requested;
  }
})();
