// Loads REAL road geometry from OpenStreetMap via one small Overpass query (~1.3 km box), cached in localStorage.
// Respect OSM/Overpass usage policy: small area, cached, attribution shown on the map. Traffic on top of it is simulated.
import {haversine} from '../engine/util.js?v=6';
const EP=['https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter','https://overpass.private.coffee/api/interpreter','https://maps.mail.ru/osm/tools/overpass/api/interpreter'];
// [free-flow km/h, default lanes]. Order = importance (used to thin the network on large areas).
const CLS={trunk:[50,3],trunk_link:[30,1],primary:[40,2],primary_link:[30,1],secondary:[35,2],secondary_link:[30,1],tertiary:[30,1.5],tertiary_link:[25,1],unclassified:[25,1],residential:[20,1]};
const TIERS={primary:['trunk','trunk_link','primary','primary_link'],secondary:['trunk','trunk_link','primary','primary_link','secondary','secondary_link'],tertiary:['trunk','trunk_link','primary','primary_link','secondary','secondary_link','tertiary','tertiary_link']};
// Real OSM roads for a box around (lat,lng). minClass 'secondary'/'tertiary' keeps only major roads (for big areas); null keeps all.
const idb=()=>new Promise((res,rej)=>{const r=indexedDB.open('trafficsim',1);r.onupgradeneeded=()=>r.result.createObjectStore('roads');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});
const idbGet=async k=>{try{const d=await idb();return await new Promise(res=>{const q=d.transaction('roads').objectStore('roads').get(k);q.onsuccess=()=>res(q.result);q.onerror=()=>res(null);});}catch{return null;}};
const idbSet=async(k,v)=>{try{const d=await idb();d.transaction('roads','readwrite').objectStore('roads').put(v,k);}catch{}};
const MEM=new Map();
// Real OSM roads for a box around (lat,lng). Cached in memory + IndexedDB (no 5 MB localStorage limit), so repeat loads are instant.
// Network: "hedged" requests - first server immediately, backups start after 4 s / 8 s / 12 s only if nothing has answered; first success wins.
export async function loadRoads(lat,lng,dLat=.007,dLng=.008,minClass=null){
 const key=`osm7:${lat.toFixed(3)},${lng.toFixed(3)},${dLat},${minClass}`;
 if(MEM.has(key))return MEM.get(key);
 const hit=await idbGet(key);if(hit){MEM.set(key,hit);return hit;}
 const cls=TIERS[minClass]??Object.keys(CLS);
 const q=`[out:json][timeout:120];way["highway"~"^(${cls.join('|')})$"](${lat-dLat},${lng-dLng},${lat+dLat},${lng+dLng});out body qt;>;out skel qt;`;
 const ac=new AbortController(),kill=setTimeout(()=>ac.abort(),130000);let json;
 const go=(ep,i)=>new Promise(r=>setTimeout(r,i*4000)).then(async()=>{if(ac.signal.aborted)throw new Error('cancelled');
  const r=await fetch(ep+'?data='+encodeURIComponent(q),{signal:ac.signal});if(!r.ok)throw new Error(new URL(ep).hostname+' HTTP '+r.status);return r.json();});
 try{json=await Promise.any(EP.map(go));}catch(e){clearTimeout(kill);throw new Error((e.errors||[e]).map(x=>x.message).filter(m=>m!=='cancelled').join('; ')||'no response');}
 clearTimeout(kill);ac.abort();
 const data=toGraph(json,lat,lng);MEM.set(key,data);idbSet(key,data);return data;
}
// Overpass JSON -> {nodes,edges}. Ways are split at junctions (nodes shared by 2+ ways); one-way respected; largest connected part kept.
// Drop shape points closer than ~6 m (keeps ends): fewer points to draw and to walk along, same visible road.
const thin=g=>{if(g.length<3)return g;const o=[g[0]];let l=g[0];for(let i=1;i<g.length-1;i++){const p=g[i];if(Math.abs(p[0]-l[0])*111000+Math.abs(p[1]-l[1])*108000>=6){o.push(p);l=p;}}o.push(g[g.length-1]);return o;};
export function toGraph(j,lat,lng){
 const P={},ways=[],use={};
 for(const el of j.elements){if(el.type==='node')P[el.id]=[el.lat,el.lon];else if(el.type==='way'&&CLS[el.tags?.highway])ways.push(el);}
 for(const w of ways)for(const n of w.nodes)use[n]=(use[n]||0)+1;
 const nodes={},edges=[];let k=0;
 for(const w of ways){const t=w.tags,[kmh,dl]=CLS[t.highway];let ns=w.nodes.filter(n=>P[n]);if(t.oneway==='-1')ns=ns.reverse();
  const oneWay=['yes','1','-1'].includes(t.oneway);let st=0;
  for(let i=1;i<ns.length;i++)if(i===ns.length-1||use[ns[i]]>1){const seg=ns.slice(st,i+1);st=i;
   if(seg[0]===seg[seg.length-1])continue;
   let geom=seg.map(n=>P[n]);let len=0;for(let q=1;q<geom.length;q++)len+=haversine({lat:geom[q-1][0],lng:geom[q-1][1]},{lat:geom[q][0],lng:geom[q][1]});geom=thin(geom);
   for(const n of [seg[0],seg[seg.length-1]])nodes['n'+n]=nodes['n'+n]||{id:'n'+n,lat:P[n][0],lng:P[n][1]};
   edges.push({id:'e'+k++,a:'n'+seg[0],b:'n'+seg[seg.length-1],name:t.name||t.highway,hw:t.highway,kmh,oneWay,geom,capacity:Math.max(3,Math.round(len/40*(+t.lanes||dl)))});}}
 // largest connected component (undirected) so every junction is reachable from the main network
 const nb={};for(const e of edges){(nb[e.a]??=[]).push(e.b);(nb[e.b]??=[]).push(e.a);}
 let best=new Set(),seen=new Set();
 for(const id of Object.keys(nodes)){if(seen.has(id))continue;const comp=new Set([id]),q=[id];seen.add(id);
  while(q.length){const u=q.pop();for(const v of nb[u]||[])if(!seen.has(v)){seen.add(v);comp.add(v);q.push(v);}}if(comp.size>best.size)best=comp;}
 const E=edges.filter(e=>best.has(e.a)),N=Object.values(nodes).filter(n=>best.has(n.id));
 if(E.length<15)throw new Error('Too few roads in this area');
 return {center:{lat,lng},nodes:N,edges:E,source:'OpenStreetMap'};
}
