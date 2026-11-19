const CENTER={lat:12.9716,lng:77.5946};
import {loadRoads,toGraph} from './data/osm.js?v=7';
import {createSim,spawn,refresh,tick,closeEdges,openEdge,runExperiment,busiestEdges,pointAt,spawnEmergency,emBlockEdge,nearestNode,EM_KINDS} from './engine/sim.js?v=9';
const $=id=>document.getElementById(id),f=(x,d=0)=>Number.isFinite(x)?x.toFixed(d):'-';
const col=x=>x<.5?'#34c759':x<.8?'#ffd60a':x<1.1?'#ff9f0a':'#ff3b30';
const SC=[{d:[.007,.008],n:300,rows:8,cls:null},{d:[.0135,.0145],n:500,rows:10,cls:'tertiary'},{d:[.027,.029],n:700,rows:12,cls:'secondary'},{d:[.135,.145],n:800,rows:16,cls:'primary'}];
const toast=(m,ms=9000)=>{const t=$('toast');t.textContent=m;t.style.display=m?'block':'none';if(m&&ms)setTimeout(()=>{if(t.textContent===m)t.style.display='none';},ms);};
const cv=L.canvas({padding:.5});let ek={},gk={};
let hist=[],lastH=-9,lastGl=null,pending=0;

// Log strip helper
function logEvent(text){
 const el=$('eventStripText');
 if(el){
  const now=new Date();
  const ts=now.toTimeString().split(' ')[0];
  el.textContent=`${ts} ${text}`;
 }
}

const spark=(a,c,fm)=>{
 if(a.length<2)return '<div class="small">Collecting data (press Start)...</div>';
 const W=300,H=64,mx=Math.max(...a,1e-9),mn=Math.min(...a,0),n=a.length;
 const pts=a.map((v,i)=>`${(i/(n-1)*W).toFixed(1)},${(H-8-(v-mn)/(mx-mn||1)*(H-16)).toFixed(1)}`).join(' ');
 const lastVal=a[n-1];
 const blocks=[' ','▂','▃','▄','▅','▆','▇','█'];
 const blockStr=a.slice(-10).map(v=>{
  const idx=Math.min(7,Math.max(0,Math.floor(((v-mn)/(mx-mn||1))*8)));
  return blocks[idx];
 }).join('');
 return `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}"><defs><linearGradient id="spg_${c.replace('#','')}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${c}" stop-opacity="0.3"/><stop offset="100%" stop-color="${c}" stop-opacity="0.0"/></linearGradient></defs><polygon points="0,${H} ${pts} ${W},${H}" fill="url(#spg_${c.replace('#','')})"/><polyline points="${pts}" fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg><div class="small spark-meta" style="display:flex;justify-content:space-between;margin-top:4px"><span>now <b>${fm(lastVal)}</b> | peak <b>${fm(mx)}</b></span><span style="font-family:monospace;letter-spacing:1px">${blockStr}</span></div>`;
};

let S=null,DATA=null,PRE=null,running=false,speed=1,sel=null,acc=0,last=performance.now(),lastPanel=0,lastEdge=0,demoTimer=null;
const map=L.map('map',{zoomControl:false,preferCanvas:true,fadeAnimation:false,minZoom:11,maxBounds:[[12.78,77.40],[13.2,77.85]],maxBoundsViscosity:1}).setView([CENTER.lat,CENTER.lng],15);

// Hook top-right quick stack zoom buttons
const bzi=$('btnZoomIn');if(bzi)bzi.onclick=()=>map.zoomIn();
const bzo=$('btnZoomOut');if(bzo)bzo.onclick=()=>map.zoomOut();
const blay=$('btnLayers');if(blay)blay.onclick=()=>{
 const b=document.querySelector('[data-t=map]');if(b)b.click();
 const pl=$('pl');if(pl&&pl.classList.contains('min'))$('data-min="pl"')?$('data-min="pl"').click():null;
};

// Theme toggle logic
function getStoredTheme(){return localStorage.getItem('tf_theme')||(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');}
function setTheme(t){document.documentElement.setAttribute('data-theme',t);localStorage.setItem('tf_theme',t);}
setTheme(getStoredTheme());
const tt=$('themeToggle');if(tt)tt.onclick=()=>{
 const cur=document.documentElement.getAttribute('data-theme')||'light';
 setTheme(cur==='dark'?'light':'dark');
};

const BM={osm:['https://tile.openstreetmap.org/{z}/{x}/{y}.png','&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors']};
let tiles=null,tileErr=0;
function setBase(k){const st=document.getElementById('stage');if(tiles){map.removeLayer(tiles);tiles=null;}tileErr=0;
 st.classList.toggle('heatmode',k==='heat');if(k==='heat')document.getElementById('heat').checked=true;
 if(k==='none'){st.classList.add('schematic');return;}st.classList.remove('schematic');
 tiles=L.tileLayer(BM.osm[0],{attribution:BM.osm[1],maxZoom:19,maxNativeZoom:18,keepBuffer:2,updateWhenIdle:false,updateInterval:150}).addTo(map);tiles.bringToBack();
 tiles.on('tileerror',()=>{if(++tileErr===6){st.classList.add('schematic');toast('Map tiles could not load (offline or blocked). Using the schematic background: roads, vehicles and the simulation still work.',8000);}});}
setBase('osm');
new ResizeObserver(()=>map.invalidateSize()).observe(document.getElementById('stage'));

// Canvas overlays: one <canvas> per layer instead of thousands of DOM/SVG nodes (vehicles, heatmap).
const CL=L.Layer.extend({initialize(pn,z,sc){this._pn=pn;this._z=z;this._sc=sc;},clearLayers(){},
 onAdd(m){this._m=m;const p=m.getPane(this._pn)||m.createPane(this._pn);p.style.zIndex=this._z;p.style.pointerEvents='none';this._c=L.DomUtil.create('canvas','',p);
  m.on('moveend zoomend resize',this._rs,this);m.on('zoomstart',this._hide,this);this._rs();},
 onRemove(m){m.off('moveend zoomend resize',this._rs,this);m.off('zoomstart',this._hide,this);L.DomUtil.remove(this._c);},
 _hide(){this._c.style.visibility='hidden';},
 _rs(){const m=this._m,s=m.getSize();L.DomUtil.setPosition(this._c,m.containerPointToLayerPoint([0,0]));this._c.style.visibility='visible';this._c.style.width=s.x+'px';this._c.style.height=s.y+'px';this._c.width=Math.ceil(s.x*this._sc);this._c.height=Math.ceil(s.y*this._sc);lastEdge=0;this.dirty=true;},
 pt(la,ln){const p=this._m.latLngToContainerPoint([la,ln]);return [p.x*this._sc,p.y*this._sc];},
 paintVeh(vs,sid){
  const c=this._c,x=c.getContext('2d'),w=c.width,h=c.height;
  const zoom=this._m.getZoom();
  const sz=Math.max(12,Math.min(28,(zoom-9)*2.8));
  x.clearRect(0,0,w,h);
  let S1=null;const E1=[];
  const radConst=Math.PI/180;
  const nowMs=performance.now();

  // Reroute / yield rings are drawn in a first pass, underneath every sprite, tight to the sprite size and
  // de-duplicated on a coarse grid so neighbouring rings never pile up on each other.
  {const seen=new Set(),cell=sz*.7;
   for(const v of vs){const yl=v.yielding,rr=v.rerouted&&v.status!=='stranded';if(v.em||(!yl&&!rr))continue;
    const [px,py]=this.pt(v.lat,v.lng);if(px<-sz||py<-sz||px>w+sz||py>h+sz)continue;
    const key=Math.round(px/cell)+','+Math.round(py/cell);if(seen.has(key))continue;seen.add(key);
    x.beginPath();x.arc(px,py,sz*.5,0,6.283);x.lineWidth=1.8;
    x.strokeStyle=yl?'rgba(255,214,10,.95)':'rgba(10,132,255,.9)';x.stroke();}}

  for(const v of vs){
   const [px,py]=this.pt(v.lat,v.lng);
   if(px<-sz*2||py<-sz*2||px>w+sz*2||py>h+sz*2)continue;
   if(v.id===sid)S1=[px,py];

   // Heading & orientation calculation
   let angle=0,west=false;
   const e=S?.graph?.edges?.[v.route?.[v.i]];
   if(e){
    const fwd=v.nodes?.[v.i]===e.a;
    const f0=Math.min(1,v.s/e.length);
    const f1=Math.min(1,(v.s+5)/e.length);
    const [p1x,p1y]=pointAt(e,f1,fwd);
    const dLat=p1x-v.lat,dLng=p1y-v.lng;
    if(dLat!==0||dLng!==0){
     angle=Math.atan2(dLng*Math.cos(v.lat*radConst),dLat);
     if(dLng<0)west=true;
    }
   }

   // Emergency units are drawn after civilians so they stay on top
   if(v.em){E1.push({v,px,py,angle,west});continue;}
   const spr=EMO[((v.id*2654435761)>>>0)%EMO.length];

   x.save();
   x.translate(px,py);
   if(angle)x.rotate(angle);
   if(west)x.scale(-1,1);
   if(v.status==='stranded')x.globalAlpha=0.45;
   x.drawImage(spr,-sz/2,-sz/2,sz,sz);
   x.restore();
  }

  // Emergency units: pulsing red beacon + rotated sprite
  const ph=Math.floor(nowMs/280)%2,pu=.5+.5*Math.sin(nowMs/140);
  for(const {v,px,py,angle,west} of E1){
   const z=sz*1.35,R=z*.62,g=x.createRadialGradient(px,py,R*.4,px,py,R*2);
   g.addColorStop(0,ph?'rgba(255,59,48,.8)':'rgba(255,59,48,.45)');g.addColorStop(1,'rgba(255,59,48,0)');
   x.fillStyle=g;x.beginPath();x.arc(px,py,R*2,0,6.283);x.fill();
   x.beginPath();x.arc(px,py,R*(1.15+.35*pu),0,6.283);x.lineWidth=2;x.strokeStyle='rgba(255,59,48,'+(.9-.6*pu).toFixed(2)+')';x.stroke();
   x.beginPath();x.arc(px,py,R,0,6.283);x.fillStyle=ph?'#ff3b30':'#d70015';x.fill();x.lineWidth=2.5;x.strokeStyle='#fff';x.stroke();
   x.save();x.translate(px,py);if(angle)x.rotate(angle);if(west)x.scale(-1,1);
   if(v.status==='stranded')x.globalAlpha=.5;
   x.drawImage(SPR_EM[v.em]||SPR_EM.ambulance,-z/2,-z/2,z,z);x.restore();
  }

  // Selected vehicle ring
  if(S1){
   x.beginPath();
   x.arc(S1[0],S1[1],sz*0.82,0,6.283);
   x.lineWidth=3;
   x.strokeStyle='#ff9f0a';
   x.stroke();
  }
 },
 paintHeat(vs,k){const c=this._c,w=c.width,h=c.height,x=c.getContext('2d',{willReadFrequently:true});x.clearRect(0,0,w,h);
  const mpp=156543*Math.cos(CENTER.lat*Math.PI/180)/2**this._m.getZoom(),R=Math.round(Math.max(8,Math.min(36,230/mpp/2)));
  if(this._R!==R){const s=document.createElement('canvas');s.width=s.height=2*R;const sx=s.getContext('2d'),g=sx.createRadialGradient(R,R,0,R,R,R);g.addColorStop(0,'rgba(0,0,0,1)');g.addColorStop(1,'rgba(0,0,0,0)');sx.fillStyle=g;sx.fillRect(0,0,2*R,2*R);this._s=s;this._R=R;}
  for(const v of vs){const wt=heatW(v);if(!wt)continue;const [px,py]=this.pt(v.lat,v.lng);if(px>-R&&py>-R&&px<w+R&&py<h+R){x.globalAlpha=Math.min(1,k*wt);x.drawImage(this._s,px-R,py-R);}}x.globalAlpha=1;
  const im=x.getImageData(0,0,w,h),d=im.data;for(let i=3;i<d.length;i+=4){const al=d[i];if(al){const j=Math.round(al*.72)*4;d[i-3]=PAL[j];d[i-2]=PAL[j+1];d[i-1]=PAL[j+2];d[i]=PAL[j+3];}}x.putImageData(im,0,0);}});

const PAL=(()=>{const c=document.createElement('canvas');c.width=256;c.height=1;const x=c.getContext('2d'),g=x.createLinearGradient(0,0,256,0);[[0,'rgba(52,199,89,0)'],[.25,'rgba(52,199,89,.55)'],[.5,'rgba(255,214,10,.78)'],[.75,'rgba(255,149,0,.86)'],[1,'rgba(255,59,48,.93)']].forEach(([o,s])=>g.addColorStop(o,s));x.fillStyle=g;x.fillRect(0,0,256,1);return x.getImageData(0,0,256,1).data;})();

// Helper to render vehicle sprite at 2x resolution
function createVehicleSprite(char,shadowColor='rgba(0,0,0,0.35)'){
 const c=document.createElement('canvas');
 c.width=c.height=64;
 const x=c.getContext('2d');
 x.shadowColor=shadowColor;
 x.shadowBlur=7;
 x.shadowOffsetX=0;
 x.shadowOffsetY=3;
 x.font='42px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
 x.textAlign='center';
 x.textBaseline='middle';
 x.fillText(char,32,34);
 return c;
}

// Pre-render vehicle emoji ONLY with soft drop shadow at 2x resolution
const EMO_CHARS=['🚗','🚕','🚙','🛺','🏍️','🛵','🚗','🛺','🚙','🚌','🚚','🚑'];
const EMO=EMO_CHARS.map(e=>createVehicleSprite(e));
// Heatmap weight per vehicle: the sprite is picked from the vehicle id, so buses and trucks (which occupy more road) count for more.
// Emergency units add no congestion in the engine, so they are left out of the heatmap.
const HEAT_W={'🚌':1.5,'🚚':1.25,'🏍️':.6,'🛵':.6,'🛺':.8};
const heatW=v=>v.em?0:(HEAT_W[EMO_CHARS[((v.id*2654435761)>>>0)%EMO_CHARS.length]]??1);

// Dedicated high-contrast sprites for emergency vehicles
const EI={ambulance:'🚑',police:'🚓',fire:'🚒'};
const SPR_EM={ambulance:createVehicleSprite(EI.ambulance,'rgba(255,59,48,0.7)'),police:createVehicleSprite(EI.police,'rgba(255,59,48,0.7)'),fire:createVehicleSprite(EI.fire,'rgba(255,59,48,0.7)')};

const heatL=new CL('heat',350,.4);
const casingLayer=L.layerGroup().addTo(map);
const gridLayer=L.layerGroup().addTo(map),glowLayer=L.layerGroup().addTo(map),edgeLayer=L.layerGroup().addTo(map),routeLayer=L.layerGroup().addTo(map),vehLayer=new CL('veh',500,1).addTo(map),mkLayer=L.layerGroup().addTo(map),emLayer=L.layerGroup().addTo(map);
const ll=n=>[n.lat,n.lng];let cells=[],lines={},casings={},glows={},vm=new Map(),barr={};

// Update closed road markers visibility depending on zoom
map.on('zoomend',updateClosuresZoom);
function updateClosuresZoom(){
 const z=map.getZoom();
 for(const id of Object.keys(barr)){
  if(S?.graph?.edges?.[id]?.closed){
   if(z>=13){if(!mkLayer.hasLayer(barr[id]))mkLayer.addLayer(barr[id]);}
   else{if(mkLayer.hasLayer(barr[id]))mkLayer.removeLayer(barr[id]);}
  }
 }
}

// vehicles that were rerouted -> how many still plan to use each road (drives the glow + "receiving traffic" list)
let rrC=null,rrT=-1;const rrCounts=()=>{if(rrC&&rrT===S.t)return rrC;const r={};for(const v of S.vehicles)if(v.rerouted)for(let k=v.i;k<v.route.length;k++)r[v.route[k]]=(r[v.route[k]]||0)+1;rrT=S.t;return rrC=r;};

function build(){
 [casingLayer,gridLayer,glowLayer,edgeLayer,vehLayer,mkLayer,emLayer].forEach(l=>l.clearLayers());
 vm=new Map();barr={};cells=[];lines={};casings={};glows={};ek={};gk={};
 S.grid.cells.forEach((c,i)=>{const r=L.rectangle([[c.south,c.west],[c.north,c.east]],{weight:.5,color:'#555',opacity:0,fillOpacity:0}).addTo(gridLayer);r.on('click',()=>{sel={t:'c',id:i};panel(true);});cells.push(r);});
 const names=new Map();
 for(const e of Object.values(S.graph.edges)){
  // Underlay white casing for Apple Maps look
  const casing=L.polyline(e.geom,{weight:6,color:'#ffffff',opacity:0.65,lineCap:'round',lineJoin:'round',interactive:false,smoothFactor:2}).addTo(casingLayer);
  casings[e.id]=casing;

  const l=L.polyline(e.geom,{weight:4,opacity:.88,lineCap:'round',lineJoin:'round',interactive:false,smoothFactor:2}).addTo(edgeLayer);
  lines[e.id]=l;
  if(!names.has(e.name)&&names.size<150)names.set(e.name,e);
 }
 $('road').innerHTML=[...names.values()].map(e=>`<option value="${e.id}">${e.name} (${e.id})</option>`).join('');
}

function reset(){
 clearTimeout(demoTimer);pending=Math.max(0,+$('nveh').value-120);S=createSim(DATA,{seed:42,vehicles:Math.min(120,+$('nveh').value),opts:{algo:$('algo').value,balance:$('lb').checked,autoJam:$('aj').checked,emPriority:$('emPri').checked,rows:DATA.rows||6,cols:DATA.rows||6,densityRef:Math.max(6,Math.round(+$('nveh').value/((DATA.rows||6)**2)*2.5))}});PRE=null;sel=null;running=false;acc=0;hist=[];lastH=-9;
 $('src').textContent=DATA.source==='OpenStreetMap'?'REAL OSM ROADS - SIMULATED TRAFFIC':'SYNTHETIC ROADS - SIMULATED';
 build();panel(true);
 logEvent('Simulation reset. Prepared '+S.vehicles.length+' initial vehicles.');
}

// Centre the view (and therefore the simulation area) exactly on a point, offset so it sits in the gap between the two panels.
function focusOn(c){const ns=DATA.nodes,W=map.getSize().x,lw=$('pl').offsetWidth+28,rw=$('pr').offsetWidth+28;
 const z=ns.length?map.getBoundsZoom(L.latLngBounds(ns.map(ll)),false,L.point(lw+rw+40,80)):15;
 map.setView([c.lat,c.lng],z,{animate:false});map.panBy([W/2-(lw+W-rw)/2,0],{animate:false});}
const fit=()=>{const ns=DATA.nodes;if(ns.length)map.fitBounds(L.latLngBounds(ns.map(ll)),{paddingTopLeft:[$('pl').offsetWidth+40,40],paddingBottomRight:[$('pr').offsetWidth+40,40]});};

async function useRoads(c,focus){const sc=SC[+$('scale').value];$('st').textContent='Loading roads...';toast('Downloading real OpenStreetMap roads (big areas can take up to 2 min)...',0);
 try{DATA=await loadRoads(c.lat,c.lng,sc.d[0],sc.d[1],sc.cls);DATA.rows=sc.rows;$('nveh').value=sc.n;toast('');logEvent(`Loaded area: ${$('scale').options[$('scale').selectedIndex].text}`);}
 catch(err){toast('Could not download OpenStreetMap roads: '+err.message+'. Check your internet connection, then press "Load real roads" again, or import an Overpass JSON file.',20000);$('st').textContent='No roads loaded';if(!DATA)return;}
reset();focus?focusOn(c):fit();}

function doClose(ids,reason){
 if(!S.closures.length)PRE=structuredClone(S);
 ids.forEach(id=>{
  barr[id]??=L.marker([0,0],{icon:L.divIcon({className:'',html:'<div style="background:#ff3b30;color:#fff;border-radius:50%;width:22px;height:22px;text-align:center;line-height:22px;font-weight:700;font-size:12px;box-shadow:0 0 0 3px #fff,0 3px 8px rgba(0,0,0,0.3)">!</div>',iconSize:[22,22]})});
 });
 closeEdges(S,ids,reason);
 ids.forEach(id=>{
  const g=S.graph.edges[id].geom;
  barr[id].setLatLng(g[g.length>>1]);
  if(map.getZoom()>=13)barr[id].addTo(mkLayer);
  const roadName=S.graph.edges[id].name||id;
  logEvent(`Closed ${roadName} (${reason}) - Traffic diverted`);
 });
 panel(true);
}

// Emergency response (engine: spawnEmergency / manageEm / clearWay in sim.js)
let pickMode=false;
function dispatch(kind,dest){
 if(!S)return null;
 const v=spawnEmergency(S,kind,dest);
 if(!v){toast('No emergency route could be found on this network.',5000);return null;}
 refresh(S);vehLayer.dirty=true;
 logEvent(`EMERGENCY: ${EM_KINDS[kind]} #${v.id} dispatched.`);
 toast(EM_KINDS[kind]+' dispatched. Red route = its path; traffic ahead will make way.',5000);
 panel(true);return v;
}

function draw(now){
 if(now-lastEdge>600){lastEdge=now;const rr=rrCounts();
  for(const e of Object.values(S.graph.edges)){const x=e.count/e.capacity,on=sel?.t==='e'&&sel.id===e.id,n=rr[e.id]||0;
   const w=(on?8:3)+Math.min(e.capacity/8,3),k=e.closed?'X':col(x)+w,g=n?4+Math.min(n,4):0;
   if(ek[e.id]!==k){
    ek[e.id]=k;
    lines[e.id].setStyle(e.closed?{color:'#ff3b30',dashArray:'6 8',weight:7,opacity:1}:{color:col(x),dashArray:null,weight:w,opacity:.88});
    if(casings[e.id])casings[e.id].setStyle({weight:w+3,opacity:e.closed?0.3:0.65});
   }
   if(gk[e.id]!==g){gk[e.id]=g;if(g||glows[e.id])(glows[e.id]??=L.polyline(e.geom,{color:'#fff',lineCap:'round',interactive:false,weight:g,opacity:.18}).addTo(glowLayer).bringToBack()).setStyle({weight:g,opacity:g?.18:0});}}
  for(const id of Object.keys(barr))if(!S.graph.edges[id].closed)mkLayer.removeLayer(barr[id]);
  const hm=document.getElementById('stage').classList.contains('heatmode'),heat=$('heat').checked,gl=$('gridl').checked;
  if(gl!==lastGl){lastGl=gl;cells.forEach(r=>r.setStyle({opacity:gl?.6:0}));}
  if(heat){if(!map.hasLayer(heatL))heatL.addTo(map);if(running||heatL.dirty){heatL.paintHeat(S.vehicles,hm?.2:.12);heatL.dirty=false;}}else if(map.hasLayer(heatL))map.removeLayer(heatL);}
 if(map.hasLayer(vehLayer)&&(running||vehLayer.dirty)){vehLayer.paintVeh(S.vehicles,sel?.t==='v'?sel.id:-1);vehLayer.dirty=false;}}

function panel(force){
 if(force)vehLayer.dirty=true;const now=performance.now();if(!force&&now-lastPanel<400)return;lastPanel=now;
 const A=S.vehicles,mm=Math.floor(S.t/60),ss=String(Math.floor(S.t%60)).padStart(2,'0');
 $('st').textContent=running?'Running':'Paused';$('clock').textContent=`${String(mm).padStart(2,'0')}:${ss}`;$('nv').textContent=`${A.length} vehicles`;$('nc').textContent=`${S.closures.length} closures`;
 const st=A.filter(v=>v.status==='stranded').length,aff=S.lastReroute?.affected??0,spd=A.length?A.reduce((a,v)=>a+v.speed,0)/A.length*3.6:0;
 const jam=Object.values(S.graph.edges).filter(e=>!e.closed&&e.count/e.capacity>=1).length;
 if(running&&S.t-lastH>=5){lastH=S.t;hist.push({v:spd,j:jam});if(hist.length>120)hist.shift();}
 $('chSpeed').innerHTML=spark(hist.map(h=>h.v),'#0a84ff',x=>f(x,1)+' km/h');$('chJam').innerHTML=spark(hist.map(h=>h.j),'#ff3b30',x=>f(x));
 
 // Big Peak V/C calculation and card update
 const peakVC=Math.max(0,...Object.values(S.graph.edges).filter(e=>!e.closed).map(e=>e.count/e.capacity));
 const elPVC=$('valPeakVC');if(elPVC)elPVC.textContent=f(peakVC,2);
 const barPVC=$('barPeakVC');if(barPVC){
  const pct=Math.min(100,peakVC*100);
  barPVC.style.width=pct+'%';
  barPVC.style.background=peakVC<0.5?'#34c759':peakVC<0.8?'#ffd60a':peakVC<1.1?'#ff9f0a':'#ff3b30';
 }
 const tagPVC=$('tagPeakVC');if(tagPVC){
  tagPVC.textContent=peakVC<0.5?'Flowing':peakVC<0.8?'Moderate':peakVC<1.1?'Heavy':'Critical';
  tagPVC.className='card-pill-tag '+(peakVC>=1.1?'red':peakVC>=0.8?'blue':'green');
 }

 $('stats').innerHTML=[['Active',A.length],['Arrived',S.arrived],['Stranded',st],['Affected',aff],['Jammed roads',jam],['Avg trip (s)',f(S.arrived?S.arrivedTime/S.arrived:NaN)],['Avg speed (km/h)',f(spd,1)]].map(([k,v])=>`<div>${k}<b>${v}</b></div>`).join('');
 $('closures').innerHTML=S.closures.length?S.closures.map(c=>`<div class="cl"><span><b>${c.name}</b> (${c.id}) - ${c.reason}, ${f(c.t)}s, ${c.affected} affected</span><button data-o="${c.id}">Reopen</button></div>`).join(''):'<div class="small">No active closures.</div>';
 
 const hot=[...S.grid.cells].sort((x,y)=>y.score-x.score).slice(0,5);
 $('hot').innerHTML=hot.map(c=>`<div class="cl hot" data-c="${c.id}"><span>Cell ${c.id}</span><span><i class="dot" style="background:hsl(${120*(1-c.score)},85%,50%)"></i><b>${c.count}</b> veh, ${c.level}</span></div>`).join('');
 $('hot').querySelectorAll('.hot').forEach(r=>r.onclick=()=>{const i=S.grid.cells.findIndex(c=>c.id==r.dataset.c);const c=S.grid.cells[i];map.flyToBounds([[c.south,c.west],[c.north,c.east]],{maxZoom:16});sel={t:'c',id:i};panel(true);});
 $('closures').querySelectorAll('button').forEach(b=>b.onclick=()=>{
  const cid=b.dataset.o;
  const name=S.graph.edges[cid]?.name||cid;
  openEdge(S,cid);
  panel(true);
  logEvent(`Reopened ${name} (${cid})`);
 });
 
 const r=S.lastReroute;if(r){
  const mx=Math.max(1,...r.dist.map(d=>d.n));
  let h=`<div class="route-card"><div class="route-card-top"><span class="route-line-emblem">&bull;</span><div class="route-pills"><span class="eta-pill">${f(r.avgNew)}s ETA</span><span class="saved-time-chip">${r.avgNew<r.avgOld?'-'+f(r.avgOld-r.avgNew)+'s':'+'+f(r.avgNew-r.avgOld)+'s'}</span></div></div><div class="route-via">${r.kind==='congestion'?'Congestion Bypass':'Closure Detour'} (t=${f(r.t)}s)</div><div class="route-sub">${r.affected} vehicles rerouted via ${r.algo} - Load balancing <b>${r.balance?'ON':'OFF'}</b> - ${r.stranded} stranded</div></div>`;
  h+=r.dist.slice(0,6).map(d=>`<div style="margin:6px 0"><div style="display:flex;justify-content:space-between;font-size:11px"><span>${d.label}</span><span><b>${d.n}</b> veh (${f(d.avgCost)}s)</span></div><div class="bar2" style="width:${100*d.n/mx}%"></div></div>`).join('');
  if(r.stats.both)h+=`<table class="cmp-table"><tr><th>Algorithm</th><th>Expanded</th><th>ms*</th></tr><tr><td>Dijkstra</td><td>${r.stats.dijkstra.expanded}</td><td>${f(r.stats.dijkstra.ms,2)}</td></tr><tr><td>A*</td><td>${r.stats.astar.expanded}</td><td>${f(r.stats.astar.ms,2)}</td></tr></table><div class="small">Identical cost: ${r.stats.sameCost}/${r.stats.n}</div>`;
  $('rr').innerHTML=h;
 }
 
 const top=Object.entries(rrCounts()).sort((a,b)=>b[1]-a[1]).slice(0,6);
 $('div').innerHTML=top.length?top.map(([id,n])=>{const e=S.graph.edges[id],x=e.count/e.capacity;return `<div class="cl"><span>${e.name}</span><span><i class="dot" style="background:${col(x)}"></i>${n} rerouted, V/C ${f(x,2)}</span></div>`;}).join(''):'<div class="small">No rerouted vehicles yet.</div>';
 
 // ---- Emergency panel ----
 const EU=A.filter(v=>v.em),Ed=S.graph.edges,Nd=S.graph.nodes;emLayer.clearLayers();
 for(const v of EU){const pts=[[v.lat,v.lng]];for(let k=v.i;k<v.route.length;k++){const e=Ed[v.route[k]],fw=v.nodes[k]===e.a;pts.push(...(fw?e.geom:[...e.geom].reverse()));}
  L.polyline(pts,{color:'#ff3b30',weight:5,opacity:.85,dashArray:'10 7',lineCap:'round',interactive:false}).addTo(emLayer);
  L.circleMarker(ll(Nd[v.d]),{radius:8,color:'#fff',weight:2,fillColor:'#ff3b30',fillOpacity:1,interactive:false}).addTo(emLayer);}
 $('emStats').innerHTML=[['Active',EU.length],['Dispatched',S.em.dispatched],['Arrived',S.em.arrived],['Redirected',S.em.reroutes],['Cars yielded',S.em.yields],['Cars diverted',S.em.diverted],['Avg trip (s)',f(S.em.arrived?S.em.time/S.em.arrived:NaN)],['Normal est. (s)',f(S.em.arrived?S.em.norm/S.em.arrived:NaN)]].map(([k,v])=>`<div>${k}<b>${v}</b></div>`).join('');
 $('emList').innerHTML=EU.length?EU.map(v=>{const rem=v.route.slice(v.i+1).reduce((a,id)=>a+Ed[id].length,0)+Ed[v.route[v.i]].length-v.s;return `<div class="cl hot" data-u="${v.id}"><span class="emtag">${EI[v.em]} ${EM_KINDS[v.em]} #${v.id}</span><span>~${f(rem/Math.max(v.speed,1))} s | redirected ${v.emReroutes}x</span></div>`;}).join(''):'No active units.';
 $('emList').querySelectorAll('[data-u]').forEach(r=>r.onclick=()=>{const v=S.vehicles.find(x=>x.id==r.dataset.u);if(v){map.panTo([v.lat,v.lng]);sel={t:'v',id:v.id};panel(true);}});
 $('emLog').innerHTML=S.em.log.length?S.em.log.map(l=>`<div>${l}</div>`).join(''):'No events yet.';

 let d='<span class="small">Click a road, vehicle or grid cell to inspect details.</span>';routeLayer.clearLayers();
 if(sel?.t==='e'){const e=S.graph.edges[sel.id];d=`<b>${e.name}</b> (${e.id}${e.hw?', '+e.hw:''})<br>${e.closed?'<span style="color:#ff3b30">CLOSED: '+e.reason+'</span>':'Open'} | ${f(e.length)} m | ${e.kmh} km/h | capacity ${e.capacity}<br>Vehicles <b>${e.count}</b> | V/C <b>${f(e.count/e.capacity,2)}</b><br><button id="tg" class="wide ${e.closed?'pri':'warn-btn'}">${e.closed?'Reopen road':'Close road'}</button>`;}
 if(sel?.t==='c'){const c=S.grid.cells[sel.id];d=`<b>Grid cell ${c.id}</b><br>Vehicles <b>${c.count}</b> | density score <b>${f(c.score,2)}</b> | status: ${c.level}`;}
 if(sel?.t==='v'){const v=S.vehicles.find(x=>x.id===sel.id);
  if(!v){d='Vehicle arrived.';sel=null;}else{const N=S.graph.nodes,E=S.graph.edges,pts=[[v.lat,v.lng]];
   for(let k=v.i;k<v.route.length;k++){const e=E[v.route[k]],fw=v.nodes[k]===e.a;pts.push(...(fw?e.geom:[...e.geom].reverse()));}
   L.polyline(pts,{color:v.em?'#ff3b30':'#0a84ff',weight:v.em?4:3,opacity:.8,dashArray:v.em?'4 6':'2 7'}).addTo(routeLayer);
   L.circleMarker(ll(N[v.o]),{radius:7,color:'#34c759'}).bindTooltip('Origin').addTo(routeLayer);
   L.circleMarker(ll(N[v.d]),{radius:7,color:'#ff3b30'}).bindTooltip('Destination').addTo(routeLayer);
   const rem=v.route.slice(v.i+1).reduce((a,id)=>a+E[id].length,0)+E[v.route[v.i]].length-v.s;
   d=(v.em?`<b class="emtag">${EI[v.em]} ${EM_KINDS[v.em]} #${v.id}</b> (emergency, priority) | redirected ${v.emReroutes}x<br>Normal-traffic estimate at dispatch: ${f(v.normEta)} s<br>`:`<b>Vehicle #${v.id}</b><br>`)+`Status: <b>${v.status}</b>${v.yielding?' (pulled over for emergency)':''}${v.rerouted&&!v.em?' (rerouted: '+v.label+')':''} | ${S.opts.algo}<br>Remaining distance: <b>${f(rem)} m</b>, approx <b>${f(rem/Math.max(v.speed,1))} s</b>`;}}
 $('detail').innerHTML=d;
 const tg=$('tg');if(tg)tg.onclick=()=>{const e=S.graph.edges[sel.id];if(e.closed)openEdge(S,e.id);else doClose([e.id],$('reason').value);panel(true);};
}

function frame(now){
 const dt=(now-last)/1000;last=now;
 if(S){
  if(pending>0){const t0=performance.now();let n=0;while(pending>0&&n<40&&performance.now()-t0<8){if(spawn(S))n++;pending--;}refresh(S);vehLayer.dirty=heatL.dirty=true;}
  if(running){acc+=Math.min(dt,.25)*10*speed;const t0=performance.now();while(acc>=1&&performance.now()-t0<12){tick(S,1);acc--;}acc=Math.min(acc,3);}
  draw(now);panel();
 }
 requestAnimationFrame(frame);
}

$('start').onclick=()=>{running=true;logEvent('Simulation started.');};
$('pause').onclick=()=>{running=false;logEvent('Simulation paused.');};
$('reset').onclick=reset;
$('bm').onchange=e=>{setBase(e.target.value);heatL.dirty=true;};
$('fitb').onclick=fit;

// Speed segmented control synchronization
document.querySelectorAll('#speedSeg .seg-btn').forEach(btn=>{
 btn.onclick=()=>{
  document.querySelectorAll('#speedSeg .seg-btn').forEach(b=>b.classList.remove('on'));
  btn.classList.add('on');
  const sp=+btn.dataset.speed;
  speed=sp;
  $('speed').value=sp;
 };
});

$('speed').onchange=e=>{
 speed=+e.target.value;
 document.querySelectorAll('#speedSeg .seg-btn').forEach(b=>b.classList.toggle('on',+b.dataset.speed===speed));
};

$('nveh').onchange=reset;
$('here').onclick=()=>useRoads(map.getCenter());
$('scale').onchange=()=>useRoads(map.getCenter());
$('imp').onclick=()=>$('file').click();
$('file').onchange=async e=>{try{DATA=toGraph(JSON.parse(await e.target.files[0].text()),CENTER.lat,CENTER.lng);DATA.rows=10;$('nveh').value=600;reset();fit();toast('Imported '+DATA.edges.length+' road segments.');}catch(err){toast('Import failed: '+err.message);}};
$('algo').onchange=e=>{if(S)S.opts.algo=e.target.value;};
$('lb').onchange=e=>{if(S)S.opts.balance=e.target.checked;};
$('aj').onchange=e=>{if(S)S.opts.autoJam=e.target.checked;};
$('close').onclick=()=>doClose([$('road').value],$('reason').value);

// Emergency controls
const goEmTab=()=>{const t=document.querySelector('[data-t=em]');if(t)t.click();};
$('emSend').onclick=()=>dispatch($('emType').value);
$('emAll').onclick=()=>['ambulance','police','fire'].forEach(k=>dispatch(k));
$('emPick').onclick=()=>{pickMode=true;toast('Click the map to set the incident location.',0);};
$('emBlock').onclick=()=>{const id=S&&emBlockEdge(S);if(!id)return toast('Dispatch a unit first (it needs an open road ahead that can be closed).',5000);doClose([id],'accident');toast('Road closed ahead of the unit: watch it get redirected.',6000);};
$('emPri').onchange=e=>{if(S)S.opts.emPriority=e.target.checked;};
$('emDemo').onclick=()=>{reset();while(pending>0){spawn(S);pending--;}refresh(S);for(let i=0;i<120;i++)tick(S,1);
 ['ambulance','police','fire'].forEach(k=>spawnEmergency(S,k));refresh(S);vehLayer.dirty=true;running=true;
 logEvent('Running emergency demo: 3 units dispatched, a road will close ahead of the first one.');goEmTab();
 demoTimer=setTimeout(()=>{const id=emBlockEdge(S);if(id)doClose([id],'accident');},5000);panel(true);};
const btnEm=$('btnEmergency');
if(btnEm)btnEm.onclick=()=>{dispatch($('emType').value);goEmTab();};

$('demo').onclick=()=>{
 reset();while(pending>0){spawn(S);pending--;}refresh(S);for(let i=0;i<120;i++)tick(S,1);running=true;
 logEvent('Running demo: triggering peak rush hour and simulated closure...');
 demoTimer=setTimeout(()=>{
  doClose(busiestEdges(S,2),'construction');
  const rrTab=document.querySelector('[data-t=rr]');if(rrTab)rrTab.click();
 },4000);
};

$('cmp').onclick=()=>{
 const base=PRE??S,ids=S.closures.length?S.closures.map(c=>c.id):busiestEdges(base,2);
 const rows=[true,false].map(b=>runExperiment(base,ids,{balance:b}));
 const onR=rows[0],offR=rows[1];
 const dVC=offR.peakVC?(onR.peakVC-offR.peakVC)/offR.peakVC*100:0;
 const dOver=offR.overloaded?(onR.overloaded-offR.overloaded)/offR.overloaded*100:0;
 const dTrip=offR.avgTrip?(onR.avgTrip-offR.avgTrip)/offR.avgTrip*100:0;
 const dRoutes=offR.routes?(onR.routes-offR.routes)/offR.routes*100:0;

 let h='<div class="amber-banner">Notice: No alternative routes - balancing could not change the outcome for isolated segments.</div>';
 h+='<table class="cmp-table"><tr><th>Metric</th><th>LB ON</th><th>LB OFF</th><th>Delta</th></tr>';
 h+=`<tr><td>Peak V/C</td><td><b>${f(onR.peakVC,2)}</b></td><td>${f(offR.peakVC,2)}</td><td><span class="delta-chip ${dVC<=0?'green':'red'}">${dVC<=0?'':'+'}${f(dVC,0)}%</span></td></tr>`;
 h+=`<tr><td>Overload edge-s</td><td><b>${onR.overloaded}</b></td><td>${offR.overloaded}</td><td><span class="delta-chip ${dOver<=0?'green':'red'}">${dOver<=0?'':'+'}${f(dOver,0)}%</span></td></tr>`;
 h+=`<tr><td>Avg trip s</td><td><b>${f(onR.avgTrip)}</b></td><td>${f(offR.avgTrip)}</td><td><span class="delta-chip ${dTrip<=0?'green':'red'}">${dTrip<=0?'':'+'}${f(dTrip,0)}%</span></td></tr>`;
 h+=`<tr><td>Routes</td><td><b>${onR.routes}</b></td><td>${offR.routes}</td><td><span class="delta-chip ${dRoutes>=0?'blue':'red'}">${dRoutes>=0?'+':''}${f(dRoutes,0)}%</span></td></tr>`;
 h+='</table><div class="small" style="margin-top:6px">Snapshot comparison evaluated 300s post-incident.</div>';
 $('cmpOut').innerHTML=h;
 const cmpTab=document.querySelector('[data-t=cmp]');if(cmpTab)cmpTab.click();
 logEvent('Completed Load Balancing A/B comparison experiment.');
};

document.querySelectorAll('.tabs').forEach(tb=>tb.querySelectorAll('button').forEach(b=>b.onclick=()=>{
 tb.querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b));
 tb.parentElement.querySelectorAll('.pane').forEach(p=>p.hidden=p.dataset.p!==b.dataset.t);
}));

document.querySelectorAll('[data-min]').forEach(b=>b.onclick=()=>{
 $(b.dataset.min).classList.toggle('min');
 b.textContent=$(b.dataset.min).classList.contains('min')?'+':'\u2212';
 setTimeout(()=>map.invalidateSize(),250);
});

$('glowt').onchange=e=>e.target.checked?map.addLayer(glowLayer):map.removeLayer(glowLayer);
$('vehs').onchange=e=>e.target.checked?map.addLayer(vehLayer):map.removeLayer(vehLayer);

requestAnimationFrame(frame);
useRoads(CENTER);

function pickEdge(p){
 const z=map.getZoom(),tol=10*360/(256*2**z),k=Math.cos(p.lat*Math.PI/180);let best=null,bd=tol*tol;
 for(const e of Object.values(S.graph.edges)){const g=e.geom;for(let i=1;i<g.length;i++){const ax=g[i-1][1]*k,ay=g[i-1][0],bx=g[i][1]*k,by=g[i][0],px=p.lng*k,py=p.lat,dx=bx-ax,dy=by-ay,L2=dx*dx+dy*dy;let t=L2?((px-ax)*dx+(py-ay)*dy)/L2:0;t=t<0?0:t>1?1:t;const qx=ax+t*dx-px,qy=ay+t*dy-py,d=qx*qx+qy*qy;if(d<bd){bd=d;best=e.id;}}}
 return best;
}

map.on('click',e=>{
 if(!S)return;
 if(pickMode){pickMode=false;toast('');dispatch($('emType').value,nearestNode(S,e.latlng.lat,e.latlng.lng));return;}
 let b=null,bd=169;
 for(const v of S.vehicles){const p=map.latLngToContainerPoint([v.lat,v.lng]),dx=p.x-e.containerPoint.x,dy=p.y-e.containerPoint.y,d=dx*dx+dy*dy;if(d<bd){bd=d;b=v;}}
 if(b){sel={t:'v',id:b.id};panel(true);return;}
 const e1=pickEdge(e.latlng);if(e1){sel={t:'e',id:e1};panel(true);}
});

let me=null;
$('loc').onclick=()=>{
 if(!navigator.geolocation)return toast('Geolocation is not supported by this browser.');
 toast('Finding your location...',0);
 navigator.geolocation.getCurrentPosition(p=>{
  const c={lat:p.coords.latitude,lng:p.coords.longitude};
  if(!map.options.maxBounds.contains([c.lat,c.lng])){toast('You appear to be outside Bangalore. The map is limited to Bangalore, so nothing was changed.',9000);return;}
  toast('');
  me??=L.circleMarker([c.lat,c.lng],{radius:8,color:'#fff',weight:3,fillColor:'#0a84ff',fillOpacity:1}).bindTooltip('You are here').addTo(map);
  me.setLatLng([c.lat,c.lng]);
  map.setView([c.lat,c.lng],15);
  useRoads(c,true);
  logEvent('Updated map centre to user location.');
 },
 err=>toast('Location unavailable ('+err.message+'). Pan the map and use Load real roads instead.',9000),{enableHighAccuracy:true,timeout:15000});
};
