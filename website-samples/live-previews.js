/* Load previews only when close to viewport to limit memory/network pressure. */
(()=>{'use strict';const frames=[...document.querySelectorAll('.neo-live-preview[data-src]')];
 const activate=f=>{if(!f.src&&f.dataset.src){f.src=f.dataset.src;delete f.dataset.src}};
 if(!('IntersectionObserver' in window)){frames.slice(0,5).forEach(activate);return}
 const obs=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){activate(e.target);obs.unobserve(e.target)}}),{rootMargin:'330px 0px'});
 frames.forEach(f=>obs.observe(f));
})();
