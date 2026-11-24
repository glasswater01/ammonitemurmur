{
const W=960,H=600,N=W*H;
const cv=document.getElementById('cv'),ctx=cv.getContext('2d');
const fx=document.getElementById('fx'),fctx=fx.getContext('2d');
const slab=document.getElementById('slab');
const img=ctx.createImageData(W,H),px=img.data;
let h=new Float32Array(N);
const dome=new Float32Array(N),inside=new Float32Array(N),shadow=new Float32Array(N);
const ar=new Float32Array(N),ag=new Float32Array(N),ab=new Float32Array(N);
let undoStack=[];

const STONES=[
 {id:'granito',name:'Granito',note:'Grano moteado',cut:[205,200,195],dust:'#cfc9c2'},
 {id:'marmol',name:'Mármol',note:'Blanco veteado',cut:[236,232,226],dust:'#f2efe9'},
 {id:'pizarra',name:'Pizarra',note:'Oscura, en capas',cut:[150,158,165],dust:'#a7aeb4'},
 {id:'arenisca',name:'Arenisca',note:'Cálida, granulosa',cut:[226,190,140],dust:'#e2c08f'}
];
const TOOLS=[
 {id:'puntero',name:'Puntero',note:'Surco fino en V',size:5},
 {id:'cincel',name:'Cincel plano',note:'Corte ancho',size:12},
 {id:'bujarda',name:'Bujarda',note:'Picado de textura',size:18},
 {id:'pulidor',name:'Pulidor',note:'Suaviza bordes',size:16}
];
let stone=STONES[0],tool=TOOLS[0],placeText=false;

/* ---- ruido ---- */
let seed=1;
const rnd=()=>{seed=(seed*16807)%2147483647;return (seed-1)/2147483646};
let perm=new Uint8Array(512);
function reseed(){const p=[...Array(256).keys()];for(let i=255;i>0;i--){const j=Math.floor(rnd()*(i+1));[p[i],p[j]]=[p[j],p[i]]}for(let i=0;i<512;i++)perm[i]=p[i&255]}
const hash=(x,y)=>perm[(perm[x&255]+y)&255]/255;
function vnoise(x,y){const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi;const u=xf*xf*(3-2*xf),v=yf*yf*(3-2*yf);
 const a=hash(xi,yi),b=hash(xi+1,yi),c=hash(xi,yi+1),d=hash(xi+1,yi+1);return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v}
function fbm(x,y,o){let s=0,a=.5,f=1;for(let i=0;i<o;i++){s+=a*vnoise(x*f,y*f);f*=2;a*=.5}return s}

function makeStone(){
 seed=Math.floor(Math.random()*1e6)+1;reseed();
 /* forma de canto rodado irregular */
 const ph=[...Array(5)].map(()=>rnd()*6.283),am=[.07,.05,.035,.02,.012].map(a=>a*(.6+rnd()*.8));
 const rx=W*(.33+rnd()*.08),ry=H*(.33+rnd()*.06),rot=(rnd()-.5)*.5,cx0=W/2,cy0=H/2-8;
 const cs=Math.cos(rot),sn=Math.sin(rot);
 const ef=(x,y)=>{const X=(x-cx0)*cs+(y-cy0)*sn,Y=-(x-cx0)*sn+(y-cy0)*cs;const t=Math.atan2(Y/ry,X/rx);
  let r=1;for(let k=0;k<5;k++)r+=am[k]*Math.sin((k+2)*t+ph[k]);r+=.025*(vnoise(Math.cos(t)*3+9,Math.sin(t)*3+9)-.5);
  return Math.hypot(X/rx,Y/ry)/r};
 const ss=(a,b,v)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t)};
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=y*W+x,e=ef(x,y);
  inside[i]=1-ss(1-1.6/rx,1,e);
  dome[i]=e<1?70*Math.pow(1-e*e,.55):0;
  shadow[i]=.32*(1-ss(.8,1.12,ef(x-16,y-26)))}
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  const i=y*W+x;let r,g,b,rel;
  const n=fbm(x/90,y/90,4),fine=hash(x*7+y,y*13+x);
  if(stone.id==='granito'){
   const base=118+n*50;r=base+6;g=base;b=base-2;
   const s=fine;
   if(s<.16){r=g=b=38+s*80}else if(s>.93){r=225;g=220;b=214}else if(s>.86){r=172;g=128;b=122}
   rel=n*.9+fine*.25;
  }else if(stone.id==='marmol'){
   const t=fbm(x/160,y/160,5);
   const vein=Math.abs(Math.sin((x*.006+y*.004)+t*9));
   const v2=Math.abs(Math.sin((x*.002-y*.009)+t*6));
   let k=Math.min(Math.pow(vein,.25),Math.pow(v2,.15)*1.05);
   const base=226+n*20;r=base*k+120*(1-k);g=base*k+122*(1-k);b=base*k+128*(1-k)+4;
   rel=n*.3;
  }else if(stone.id==='pizarra'){
   const band=fbm(x/400,y/18,4);
   const base=58+band*34+n*10;r=base-4;g=base+2;b=base+10;
   rel=band*1.4+fine*.1;
  }else{
   const band=fbm(x/500+n*.6,y/40,3);
   const base=175+band*50+n*20-fine*28;r=base+18;g=base-14;b=base-58;
   rel=n*.7+fine*.45;
  }
  ar[i]=r;ag[i]=g;ab[i]=b;h[i]=rel;
 }
 undoStack=[];render(0,0,W,H);
}

/* ---- render con luz rasante ---- */
function render(x0,y0,x1,y1){
 x0=Math.max(1,x0|0);y0=Math.max(1,y0|0);x1=Math.min(W-1,Math.ceil(x1));y1=Math.min(H-1,Math.ceil(y1));
 const [cr,cg,cb]=stone.cut;
 for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
  const i=y*W+x;
  const j=i*4,a=inside[i];
  if(a<=0){px[j]=px[j+1]=px[j+2]=0;px[j+3]=shadow[i]*255;continue}
  const dx=h[i+1]+dome[i+1]-h[i-1]-dome[i-1],dy=h[i+W]+dome[i+W]-h[i-W]-dome[i-W];
  let L=.86+(dx+dy)*.11;
  const d=Math.max(0,-h[i]+ (stone.id==='pizarra'?0:0));
  const depth=Math.max(0,.4-h[i]);  // 0 en superficie
  let m=Math.min(1,Math.max(0,-h[i])*.22);
  const ao=1-Math.min(.35,Math.max(0,-h[i])*.025);
  L=Math.max(.25,Math.min(1.6,L))*ao;
  px[j]=(ar[i]*(1-m)+cr*m)*L;px[j+1]=(ag[i]*(1-m)+cg*m)*L;px[j+2]=(ab[i]*(1-m)+cb*m)*L;px[j+3]=255*Math.max(a,shadow[i]);
 }
 ctx.putImageData(img,0,0,x0,y0,x1-x0,y1-y0);
}

/* ---- herramientas ---- */
const size=()=>+document.getElementById('sz').value,force=()=>+document.getElementById('fr').value;
const MAXD=14;
function stamp(cx,cy){
 const r=size(),f=force();
 const x0=Math.max(1,cx-r-2|0),x1=Math.min(W-1,cx+r+2|0),y0=Math.max(1,cy-r-2|0),y1=Math.min(H-1,cy+r+2|0);
 if(tool.id==='pulidor'){
  for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){const dd=Math.hypot(x-cx,y-cy)/r;if(dd>1)continue;const i=y*W+x;
   const avg=(h[i-1]+h[i+1]+h[i-W]+h[i+W]+h[i])/5;h[i]+= (avg-h[i])*.5*(1-dd)*f/10*inside[i]}
 }else if(tool.id==='bujarda'){
  const n=Math.ceil(r*r*.02*f);
  for(let k=0;k<n;k++){const a=Math.random()*6.283,rr=Math.sqrt(Math.random())*r;const px_=cx+Math.cos(a)*rr,py=cy+Math.sin(a)*rr;const pr=1+Math.random()*2.2;
   for(let y=Math.max(1,py-pr|0);y<=Math.min(H-2,py+pr);y++)for(let x=Math.max(1,px_-pr|0);x<=Math.min(W-2,px_+pr);x++){const dd=Math.hypot(x-px_,y-py)/pr;if(dd>1)continue;const i=y*W+x;if(inside[i]>.5)h[i]=Math.max(-MAXD,h[i]-(1-dd)*f*.12)}}
 }else{
  const flat=tool.id==='cincel';
  for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){const dd=Math.hypot(x-cx,y-cy)/r;if(dd>1)continue;const i=y*W+x;
   const prof=flat?Math.min(1,(1-dd)*3):(1-dd);
   const amt=prof*f*.035*(.8+Math.random()*.4)*inside[i];if(!amt)continue;
   h[i]=Math.max(-MAXD*prof-.2,h[i]-amt)}
 }
 return [x0,y0,x1,y1];
}

/* ---- polvo y sonido ---- */
let parts=[],raf=0,cursor=null;
function spawn(x,y){const n=tool.id==='pulidor'?1:2+Math.random()*force()/2;
 for(let k=0;k<n;k++)parts.push({x,y,vx:(Math.random()-.5)*3,vy:-Math.random()*2.5-.5,l:1,s:1+Math.random()*2.5})}
function tick(){
 fctx.clearRect(0,0,W,H);
 fctx.fillStyle=stone.dust;
 parts=parts.filter(p=>(p.l-=.025)>0);
 for(const p of parts){p.vy+=.15;p.x+=p.vx;p.y+=p.vy;fctx.globalAlpha=p.l;fctx.fillRect(p.x,p.y,p.s,p.s)}
 fctx.globalAlpha=1;
 if(cursor){fctx.strokeStyle='rgba(255,255,255,.85)';fctx.lineWidth=1.5;fctx.beginPath();
  if(placeText){fctx.setLineDash([5,4]);fctx.strokeRect(cursor.x-120,cursor.y-28,240,56);fctx.setLineDash([])}
  else fctx.arc(cursor.x,cursor.y,Math.max(3,size()),0,6.283);
  fctx.stroke();fctx.strokeStyle='rgba(0,0,0,.5)';fctx.beginPath();fctx.arc(cursor.x,cursor.y,1.5,0,6.283);fctx.stroke()}
 raf=requestAnimationFrame(tick);
}
let actx=null;
function knock(){
 if(!document.getElementById('snd').checked)return;
 try{
  actx=actx||new (window.AudioContext||window.webkitAudioContext)();
  const len=.06,buf=actx.createBuffer(1,actx.sampleRate*len,actx.sampleRate),d=buf.getChannelData(0);
  for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,4);
  const src=actx.createBufferSource();src.buffer=buf;
  const bp=actx.createBiquadFilter();bp.type='bandpass';
  bp.frequency.value=tool.id==='pulidor'?900:(stone.id==='marmol'?3200:stone.id==='pizarra'?2200:2700)+Math.random()*600;bp.Q.value=tool.id==='pulidor'?.6:4;
  const g=actx.createGain();g.gain.value=tool.id==='pulidor'?.15:.35+force()*.03;
  src.connect(bp).connect(g).connect(actx.destination);src.start();
 }catch(e){}
}

/* ---- texto ---- */
function carveText(cx,cy){
 const t=document.getElementById('tx').value.trim();if(!t)return;
 const oc=document.createElement('canvas');oc.width=W;oc.height=H;const o=oc.getContext('2d');
 let fs=Math.max(40,size()*9);
 const fam=document.getElementById('fo').value;
 o.font=fam.replace('VAR',fs+'px');
 const mw=o.measureText(t).width;if(mw>W*.6){fs*=W*.6/mw;o.font=fam.replace('VAR',fs+'px')}
 o.textAlign='center';o.textBaseline='middle';o.fillStyle='#fff';o.fillText(t,cx,cy);
 let a=new Float32Array(N);const id=o.getImageData(0,0,W,H).data;for(let i=0;i<N;i++)a[i]=id[i*4+3]/255;
 const rad=Math.max(1,Math.round(fs/22));
 for(let pass=0;pass<2;pass++){const b=new Float32Array(N);
  for(let y=0;y<H;y++){let s=0;for(let x=-rad;x<=rad;x++)s+=a[y*W+Math.max(0,Math.min(W-1,x))];
   for(let x=0;x<W;x++){b[y*W+x]=s/(2*rad+1);s+=a[y*W+Math.min(W-1,x+rad+1)]-a[y*W+Math.max(0,x-rad)]}}
  for(let x=0;x<W;x++){let s=0;for(let y=-rad;y<=rad;y++)s+=b[Math.max(0,Math.min(H-1,y))*W+x];
   for(let y=0;y<H;y++){a[y*W+x]=Math.min(a[y*W+x]*.0+s/(2*rad+1),1);s+=b[Math.min(H-1,y+rad+1)*W+x]-b[Math.max(0,y-rad)*W+x]}}}
 const depth=3+force()*1.1;
 for(let i=0;i<N;i++)if(a[i]>0.001)h[i]=Math.min(h[i],h[i]-a[i]*inside[i]*depth*(.9+Math.random()*.2));
 render(0,0,W,H);
 for(let k=0;k<30;k++)spawn(cx+(Math.random()-.5)*mw*.8,cy);
 for(let k=0;k<4;k++)setTimeout(knock,k*90);
}

/* ---- interacción ---- */
function pos(e){const r=cv.getBoundingClientRect();return{x:(e.clientX-r.left)*W/r.width,y:(e.clientY-r.top)*H/r.height}}
let down=false,last=null,dist=0;
function pushUndo(){undoStack.push(h.slice());if(undoStack.length>20)undoStack.shift()}
slab.addEventListener('pointerdown',e=>{
 e.preventDefault();slab.setPointerCapture(e.pointerId);const p=pos(e);cursor=p;
 if(placeText){pushUndo();carveText(p.x,p.y);setTextMode(false);return}
 pushUndo();down=true;last=p;dist=0;const b=stamp(p.x,p.y);render(...b);spawn(p.x,p.y);knock();
});
slab.addEventListener('pointermove',e=>{
 const p=pos(e);cursor=p;if(!down)return;
 const dx=p.x-last.x,dy=p.y-last.y,L=Math.hypot(dx,dy),step=Math.max(1,size()*.35),n=Math.ceil(L/step);
 let bx0=W,by0=H,bx1=0,by1=0;
 for(let k=1;k<=n;k++){const b=stamp(last.x+dx*k/n,last.y+dy*k/n);bx0=Math.min(bx0,b[0]);by0=Math.min(by0,b[1]);bx1=Math.max(bx1,b[2]);by1=Math.max(by1,b[3])}
 if(n)render(bx0,by0,bx1,by1);
 dist+=L;if(dist>18){dist=0;knock();spawn(p.x,p.y)}
 last=p;
});
const end=()=>{down=false};
slab.addEventListener('pointerup',end);slab.addEventListener('pointercancel',end);
slab.addEventListener('pointerleave',()=>{cursor=null;end()});

/* ---- controles ---- */
const btn=(it,on)=>`<button data-id="${it.id}" aria-pressed="${on}">${it.name}<small>${it.note}</small></button>`;
const stonesEl=document.getElementById('stones'),toolsEl=document.getElementById('tools');
function drawBtns(){
 stonesEl.innerHTML=STONES.map(s=>btn(s,s===stone)).join('');
 toolsEl.innerHTML=TOOLS.map(t=>btn(t,t===tool&&!placeText)).join('');
}
const hints={puntero:'Arrastra para trazar un surco fino; repásalo para ahondarlo.',cincel:'Corte ancho de fondo plano, para letras grandes o rebajar superficies.',bujarda:'Golpea o arrastra para picar la superficie y darle textura rugosa.',pulidor:'Pasa por encima para suavizar aristas y matizar el relieve.'};
const hintEl=document.getElementById('hint');
function setHint(){hintEl.textContent=placeText?'Haz clic o toca la piedra donde quieras grabar el texto.':`Herramienta: ${tool.name.toLowerCase()}. ${hints[tool.id]}`}
function setTextMode(on){placeText=on;document.getElementById('txB').setAttribute('aria-pressed',on);drawBtns();setHint()}
stonesEl.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;stone=STONES.find(s=>s.id===b.dataset.id);drawBtns();makeStone()});
toolsEl.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;tool=TOOLS.find(t=>t.id===b.dataset.id);
 document.getElementById('sz').value=tool.size;upd();setTextMode(false)});
document.getElementById('txB').addEventListener('click',()=>setTextMode(!placeText));
const upd=()=>{document.getElementById('szO').textContent=size();document.getElementById('frO').textContent=force()};
document.getElementById('sz').addEventListener('input',upd);document.getElementById('fr').addEventListener('input',upd);
document.getElementById('undo').addEventListener('click',()=>{if(!undoStack.length)return;h=undoStack.pop();render(0,0,W,H)});
document.getElementById('reset').addEventListener('click',makeStone);
const modal=document.getElementById('modal');
document.getElementById('save').addEventListener('click',()=>{const u=cv.toDataURL('image/png');document.getElementById('out').src=u;document.getElementById('dl').href=u;modal.classList.add('on');document.getElementById('close').focus()});
document.getElementById('close').addEventListener('click',()=>modal.classList.remove('on'));
modal.addEventListener('click',e=>{if(e.target===modal)modal.classList.remove('on')});
document.addEventListener('keydown',e=>{if(e.key==='Escape')modal.classList.remove('on');if((e.ctrlKey||e.metaKey)&&e.key==='z'){e.preventDefault();document.getElementById('undo').click()}});

drawBtns();upd();setHint();makeStone();
/* inscripción de muestra al abrir */
const first=()=>{carveText(W/2,H/2);undoStack=[]};
(document.fonts&&document.fonts.ready?document.fonts.ready.then(first):first());
tick();
}
