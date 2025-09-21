export function qs(sel, root=document){ return root.querySelector(sel); }
export function qsa(sel, root=document){ return Array.from(root.querySelectorAll(sel)); }
export function el(tag, opts={}){ const e=document.createElement(tag); if(opts.className) e.className=opts.className; if(opts.text) e.textContent=opts.text; return e; }
export function clear(node){ if(node) node.innerHTML=''; }
export function show(node){ node.style.display=''; }
export function hide(node){ node.style.display='none'; }
