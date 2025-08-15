const NODE_SIZE=108, LINK_COLOR='rgba(220,220,230,0.6)', LINK_WIDTH=1.2;
const REST_GAP=260, SPRING_STRENGTH=.003, DAMPING=.985, MAX_SPEED=1.2, HIT_RADIUS=NODE_SIZE/2;

// Aura config
const AURA_RADIUS = 24;   // bigger aura
const AURA_SPEED  = 1.0;
const AURA_GLOW   = 56;

function img(src){ return new Promise((res,rej)=>{ const im=new Image(); im.onload=()=>res(im); im.onerror=()=>rej(new Error(src)); im.src=src; }); }
function pick(nodes,x,y){ for(let i=nodes.length-1;i>=0;i--){ const n=nodes[i]; if(Math.hypot(x-n.x,y-n.y)<=HIT_RADIUS) return n; } return null; }

// Modal
const modal = document.getElementById('auraModal');
const closeBtn = modal.querySelector('.modal__close');
function openModal(){ modal.classList.add('open'); modal.setAttribute('aria-hidden','false'); }
function closeModal(){ modal.classList.remove('open'); modal.setAttribute('aria-hidden','true'); }
closeBtn.addEventListener('click', closeModal);
modal.addEventListener('click', e=>{ if(e.target === modal) closeModal(); });
document.addEventListener('keydown', e=>{ if(e.key==='Escape') closeModal(); });

fetch('data.json').then(r=>r.json()).then(async data=>{
  const images = await Promise.all(data.participants.map(p=>img(p.symbol).catch(()=>null)));

  const canvas = document.getElementById('canvas'); const ctx = canvas.getContext('2d');
  function resize(){ const dpr=Math.min(2,devicePixelRatio||1), w=innerWidth, h=innerHeight;
    canvas.width=Math.floor(w*dpr); canvas.height=Math.floor(h*dpr);
    canvas.style.width=w+'px'; canvas.style.height=h+'px'; ctx.setTransform(dpr,0,0,dpr,0,0); }
  resize(); addEventListener('resize', resize);

  // Keep symbols away from ticker: reserve topSafe px
  const topSafe = 120;
  const radius = Math.min(innerWidth, innerHeight - topSafe) / 3;
  const cx = innerWidth/2;
  const cy = topSafe + radius + 40; // push down a bit more

  const nodes = data.participants.map((p,i)=>{
    const angle = (i / data.participants.length) * Math.PI*2;
    return {i,p, x: cx + radius*Math.cos(angle), y: cy + radius*Math.sin(angle),
      vx:(Math.random()*2-1)*.5, vy:(Math.random()*2-1)*.5, img: images[i], angleOffset: Math.random()*Math.PI*2};
  });

  // Aura particle, starts near center
  const aura = {
    x: cx + (Math.random()*2-1)*radius*0.2,
    y: cy + (Math.random()*2-1)*radius*0.2,
    vx: (Math.random()*2-1)*AURA_SPEED,
    vy: (Math.random()*2-1)*AURA_SPEED,
    r: AURA_RADIUS
  };

  let drag=null, ox=0, oy=0;
  canvas.addEventListener('mousedown', e=>{
    const x=e.clientX,y=e.clientY;
    if(Math.hypot(x-aura.x,y-aura.y) <= aura.r+8){ openModal(); return; }
    const n=pick(nodes,x,y); if(n){drag=n; ox=x-n.x; oy=y-n.y;}
  });
  addEventListener('mousemove', e=>{ if(!drag) return; drag.x=e.clientX-ox; drag.y=e.clientY-oy; drag.vx=0; drag.vy=0; });
  addEventListener('mouseup', ()=> drag=null);
  canvas.addEventListener('click', e=>{
    const x=e.clientX,y=e.clientY;
    if(Math.hypot(x-aura.x,y-aura.y) <= aura.r+8){ openModal(); return; }
    const n=pick(nodes,x,y); if(n) location.href=`participants/p${n.i+1}.html`;
  });

  function step(){
    // Springs around circle
    for(let i=0;i<nodes.length;i++){
      const a=nodes[i], b=nodes[(i+1)%nodes.length];
      const dx=b.x-a.x, dy=b.y-a.y, d=Math.hypot(dx,dy)||.0001;
      const f=SPRING_STRENGTH*(d-REST_GAP), fx=(dx/d)*f, fy=(dy/d)*f;
      a.vx+=fx; a.vy+=fy; b.vx-=fx; b.vy-=fy;
    }
    const t = performance.now()/1000;
    for(const n of nodes){
      n.vx*=DAMPING; n.vy*=DAMPING;
      const s=Math.hypot(n.vx,n.vy); if(s>MAX_SPEED){ n.vx=n.vx/s*MAX_SPEED; n.vy=n.vy/s*MAX_SPEED; }
      n.x+=n.vx + Math.sin(t*0.7 + n.angleOffset)*0.8;
      n.y+=n.vy + Math.cos(t*0.9 + n.angleOffset*1.5)*0.8;
      // bounds so symbols don't touch edges
      const m=NODE_SIZE*.6;
      if(n.x<m){ n.x=m; n.vx=Math.abs(n.vx);} if(n.x>innerWidth-m){ n.x=innerWidth-m; n.vx=-Math.abs(n.vx); }
      if(n.y<m+topSafe){ n.y=m+topSafe; n.vy=Math.abs(n.vy);} if(n.y>innerHeight-m){ n.y=innerHeight-m; n.vy=-Math.abs(n.vy); }
    }

    // Aura movement with slight wobble
    aura.x += aura.vx + Math.sin(t*0.6)*0.4;
    aura.y += aura.vy + Math.cos(t*0.8)*0.4;

    // Constrain aura within circle interior
    const dx = aura.x - cx;
    const dy = aura.y - cy;
    const dist = Math.hypot(dx,dy) || 0.0001;
    const inner = radius - NODE_SIZE*0.6; // keep inside where links/nodes are
    if(dist > inner){
      // project back inside and reflect velocity a bit
      const nx = dx / dist, ny = dy / dist;
      aura.x = cx + nx * inner;
      aura.y = cy + ny * inner;
      // reflect
      const dot = aura.vx*nx + aura.vy*ny;
      aura.vx -= 1.8*dot*nx;
      aura.vy -= 1.8*dot*ny;
    }
  }

  function draw(){
    ctx.clearRect(0,0,innerWidth,innerHeight);

    // Links
    ctx.lineWidth=LINK_WIDTH; ctx.strokeStyle=LINK_COLOR; ctx.beginPath();
    for(let i=0;i<nodes.length;i++){ const n=nodes[i]; if(i===0) ctx.moveTo(n.x,n.y); else ctx.lineTo(n.x,n.y); }
    ctx.closePath(); ctx.stroke();

    // Nodes
    for(const n of nodes){
      if(n.img){ const s=NODE_SIZE; ctx.drawImage(n.img, n.x-s/2, n.y-s/2, s, s); }
      else { ctx.beginPath(); ctx.arc(n.x,n.y,NODE_SIZE*.42,0,Math.PI*2); ctx.fillStyle='rgba(255,255,255,.85)'; ctx.fill(); }
    }

    // Aura glow
    const grd = ctx.createRadialGradient(aura.x, aura.y, 0, aura.x, aura.y, aura.r*2.6);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.save();
    ctx.globalAlpha = 0.98;
    ctx.shadowBlur = AURA_GLOW;
    ctx.shadowColor = 'rgba(255,255,255,0.95)';
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(aura.x, aura.y, aura.r, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
  }

  (function loop(){ step(); draw(); requestAnimationFrame(loop); })();
});
