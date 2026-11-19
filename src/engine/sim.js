import {buildGraph} from './graph.js?v=6';
import {makeGrid,updateGrid} from './grid.js?v=6';
import {makeCostFn,makeEmCostFn,emTime,EM,congestion} from './edgeCost.js?v=7';
import {dijkstra,astar} from './routing.js?v=7';
import {assignRoutes} from './assignment.js?v=6';
import {rand,haversine} from './util.js?v=6';
// Sim state is plain data (structuredClone-able) -> replayable, and usable for headless what-if experiments.
export function createSim(data,o={}){
 const graph=buildGraph(data);
 const s={t:0,seed:o.seed??42,opts:{algo:'astar',balance:true,respawn:true,autoJam:true,jamThr:1,densityRef:6,rows:6,cols:6,emPriority:true,...o.opts},
  graph,grid:null,vehicles:[],nextId:1,arrived:0,abandoned:0,arrivedTime:0,closures:[],lastReroute:null,loads:{},em:{dispatched:0,arrived:0,time:0,norm:0,reroutes:0,yields:0,diverted:0,log:[]}};
 s.grid=makeGrid(graph,s.opts.rows,s.opts.cols);
 for(let i=0,k=0,n=o.vehicles??120;k<n&&i<n*8;i++)if(spawn(s))k++;
 refresh(s);return s;
}
export const costFor=(s,loads)=>makeCostFn({loads,cellScore:e=>s.grid.cells[s.grid.edgeCell[e.id]].score});
export function computeRoute(s,from,to,cost){const g=s.graph,a=s.opts.algo;
 if(a==='dijkstra')return {res:dijkstra(g,from,to,cost)};
 if(a==='astar')return {res:astar(g,from,to,cost)};
 const d=dijkstra(g,from,to,cost),r=astar(g,from,to,cost);return {res:r,cmp:{d,a:r}};}
// Position follows the real road geometry (polyline), in the direction of travel.
export function pointAt(e,f,fwd){const d=(fwd?f:1-f)*e.length,c=e.cum;let k=1;while(k<c.length-1&&c[k]<d)k++;
 const t=(d-c[k-1])/Math.max(c[k]-c[k-1],1e-9),A=e.geom[k-1],B=e.geom[k];return [A[0]+(B[0]-A[0])*t,A[1]+(B[1]-A[1])*t];}
function place(s,v){const e=s.graph.edges[v.route[v.i]];[v.lat,v.lng]=pointAt(e,Math.min(1,v.s/e.length),v.nodes[v.i]===e.a);}
function connectedWith(s,closed){const nb={};for(const e of Object.values(s.graph.edges)){if(e.closed||closed.has(e.id))continue;(nb[e.a]??=[]).push(e.b);(nb[e.b]??=[]).push(e.a);}
 const ids=Object.keys(s.graph.nodes),seen=new Set([ids[0]]),q=[ids[0]];while(q.length){const u=q.pop();for(const v of nb[u]||[])if(!seen.has(v)){seen.add(v);q.push(v);}}return seen.size===ids.length;}
// Busiest roads whose closure keeps the network connected (so the demo reroutes traffic instead of stranding it).
export function busiestEdges(s,n){const out=[];
 const c=Object.values(s.graph.edges).filter(e=>e.length>40&&!e.closed).sort((a,b)=>(b.count+(s.loads[b.id]||0))-(a.count+(s.loads[a.id]||0))||(a.id<b.id?-1:1));
 for(const e of c.slice(0,80)){if(connectedWith(s,new Set([...out,e.id])))out.push(e.id);if(out.length===n)break;}return out;}
// Recompute actual edge counts (vehicles ON an edge) and predicted load (planned edges ahead) separately, then the grid.
// full=false (per tick) skips the O(vehicles x route length) predicted-load rebuild; it is rebuilt every 4 s and on every reroute.
const EL=new WeakMap(),NI=new WeakMap();
const edgeList=g=>EL.get(g)||(EL.set(g,Object.values(g.edges)),EL.get(g));
export function refresh(s,full=true){const g=s.graph;for(const e of edgeList(g))e.count=0;if(full)s.loads={};
 for(const v of s.vehicles){place(s,v);if(v.em)continue; // emergency units do not add to congestion/predicted load
  g.edges[v.route[v.i]].count++;
  if(full)for(let k=v.i+1;k<v.route.length;k++)s.loads[v.route[k]]=(s.loads[v.route[k]]||0)+1;}
 updateGrid(s.grid,s.vehicles,s.opts.densityRef);}
export function spawn(s){for(let i=0;i<30;i++){const v=trySpawn(s);if(v)return v;}return null;}
function trySpawn(s){
 const pick=a=>a[Math.floor(rand(s)*a.length)],N=s.graph.nodes;
 let C=NI.get(s.graph);if(!C){const ids=Object.keys(N),b=s.graph.bounds,sp=b.maxLng-b.minLng;C={ids,W:ids.filter(i=>N[i].lng<b.minLng+.2*sp),E:ids.filter(i=>N[i].lng>b.maxLng-.2*sp)};NI.set(s.graph,C);}
 const {ids,W,E}=C;let o,d;
 if(rand(s)<.65){[o,d]=rand(s)<.5?[pick(W),pick(E)]:[pick(E),pick(W)];}else{o=pick(ids);d=pick(ids);}
 if(o===d)return null;
 const {res}=computeRoute({...s,opts:{...s.opts,algo:'astar'}},o,d,costFor(s,s.loads));
 if(!res.found||!res.edges.length)return null;
 const v={id:s.nextId++,o,d,route:res.edges,nodes:res.nodes,i:0,s:0,speed:0,status:'moving',label:'Base',tripT:0,rerouted:false,lat:0,lng:0};
 s.vehicles.push(v);place(s,v);for(const id of res.edges.slice(1))s.loads[id]=(s.loads[id]||0)+1;return v;}
function replan(s,v){const from=v.nodes[v.i+1],res=v.em?computeEmRoute(s,from,v.d,makeEmCostFn({loads:s.loads})):computeRoute(s,from,v.d,costFor(s,s.loads)).res;
 if(!res.found)return false;v.route=v.route.slice(0,v.i+1).concat(res.edges);v.nodes=v.nodes.slice(0,v.i+2).concat(res.nodes.slice(1));
 if(v.em){v.rerouted=true;v.emReroutes++;s.em.reroutes++;emLog(s,emName(v)+' redirected (road closed ahead)');}return true;}
// Fixed timestep (dt seconds of sim time); independent of render frame rate.
export function tick(s,dt=1){
 s.t+=dt;const g=s.graph;let done=0;
 const cor=s.opts.emPriority&&s.vehicles.some(v=>v.em)?corridor(s,YIELD_L):null; // roads just ahead of emergency units: civilians there pull over
 for(const v of s.vehicles){v.tripT+=dt;let e=g.edges[v.route[v.i]];
  if(v.status==='stranded'){if(Math.floor(s.t)%5===0&&replan(s,v)){v.status='moving';v.rerouted=true;}else{if(s.t-v.sAt>60&&!v.em){v.status='arrived';v.abandoned=true;}continue;}}
  v.speed=v.em?e.length/emTime(e,e.count/e.capacity):Math.max(e.speed/congestion(e.count/e.capacity),.15*e.speed);
  if(!v.em&&cor&&mustYield(cor,v,e)){v.speed=0;if(!v.yielding){v.yielding=true;s.em.yields++;}}else v.yielding=false; // pulled over to let an emergency unit pass
  v.s+=v.speed*dt;
  while(v.status!=='arrived'&&v.s>=e.length){
   if(v.i+1>=v.route.length){v.status='arrived';break;}
   if(g.edges[v.route[v.i+1]].closed&&!replan(s,v)){v.status='stranded';v.sAt=s.t;v.s=e.length;v.speed=0;break;}
   v.s-=e.length;v.i++;e=g.edges[v.route[v.i]];}}
 for(const v of s.vehicles)if(v.status==='arrived'){
  if(v.em){s.em.arrived++;s.em.time+=v.tripT;if(Number.isFinite(v.normEta))s.em.norm+=v.normEta;emLog(s,`${emName(v)} arrived in ${Math.round(v.tripT)} s (normal-traffic est. ${Math.round(v.normEta)} s)`);continue;}
  if(v.abandoned)s.abandoned++;else{s.arrived++;s.arrivedTime+=v.tripT;}done++;}
 s.vehicles=s.vehicles.filter(v=>v.status!=='arrived'); // arrived vehicles leave active density
 if(s.opts.respawn)for(let i=0;i<done;i++)spawn(s);
 refresh(s,Math.floor(s.t)%4===0);
 if(s.opts.autoJam&&Math.floor(s.t)%15===0){rerouteCongestion(s,s.opts.jamThr);refresh(s);}
 if(Math.floor(s.t)%3===0&&s.vehicles.some(v=>v.em)){manageEm(s);if(s.opts.emPriority)clearWay(s);refresh(s);}
}
// Congestion-focused rerouting: find roads whose (vehicles + predicted load)/capacity >= thr and move upcoming traffic
// off them, using the same load-balanced assignment (only when the alternative is clearly cheaper).
export function rerouteCongestion(s,thr=1){
 const g=s.graph,jam=new Set(Object.values(g.edges).filter(e=>!e.closed&&(e.count+(s.loads[e.id]||0))/e.capacity>=thr).map(e=>e.id));
 if(!jam.size)return null;
 const aff=s.vehicles.filter(v=>!v.em&&v.status!=='stranded'&&v.route.slice(v.i+1).some(id=>jam.has(id)));
 if(!aff.length)return null;
 const k=Math.ceil(aff.length/150),pick=aff.filter(v=>(v.id+Math.floor(s.t/15))%k===0); // cap batch size per pass to keep the UI responsive
 return assignRoutes(s,pick,{costFor:l=>costFor(s,l),route:(f,t,c)=>computeRoute(s,f,t,c)},{improveOnly:true,kind:'congestion'});}
export function closeEdges(s,ids,reason='manual test'){
 for(const id of ids){const e=s.graph.edges[id];if(e.closed)continue;e.closed=true;e.reason=reason;s.closures.push({id,name:e.name,reason,t:s.t,affected:0});}
 const affected=s.vehicles.filter(v=>!v.em&&v.route.slice(v.i+1).some(id=>s.graph.edges[id].closed));
 const r=assignRoutes(s,affected,{costFor:l=>costFor(s,l),route:(f,t,c)=>computeRoute(s,f,t,c)});
 for(const c of s.closures)if(ids.includes(c.id))c.affected=affected.length;
 manageEm(s); // emergency units are redirected with their own (priority) cost model
 refresh(s);return r;}
export function openEdge(s,id){const e=s.graph.edges[id];e.closed=false;e.reason=null;s.closures=s.closures.filter(c=>c.id!==id);
 for(const v of s.vehicles)if(v.status==='stranded'&&replan(s,v))v.status='moving';refresh(s);}
// Headless what-if on a clone: same snapshot, same seed -> fair ON/OFF comparison.
export function runExperiment(s0,ids,{balance,seconds=300}){
 const s=structuredClone(s0);s.opts.balance=balance;if(s.opts.algo==='both')s.opts.algo='astar';
 closeEdges(s,ids,'experiment');let peak=0,over=0;
 for(let i=0;i<seconds;i++){tick(s);for(const e of Object.values(s.graph.edges)){const x=e.count/e.capacity;peak=Math.max(peak,x);if(x>1)over++;}}
 const n=s.arrived-s0.arrived;
 return {balance,affected:s.lastReroute.affected,routes:s.lastReroute.dist.length,peakVC:peak,overloaded:over,arrived:n,
  avgTrip:n?(s.arrivedTime-s0.arrivedTime)/n:NaN,stranded:s.vehicles.filter(v=>v.status==='stranded').length};}

// ================= Emergency response vehicles =================
// 1) Routing: own cost model (emTime: 1.4x speed, weak congestion penalty) with Dijkstra or A* (admissible heuristic via EM.boost).
// 2) Redirect: every 3 s each unit is re-planned from its next junction; it switches when the new route is >12% faster or its route is blocked.
// 3) Make way: civilians ahead of a unit (within YIELD_L m, same direction) pull over; civilians whose next few roads enter the unit's
//    corridor are diverted using the normal load-balanced assignment with a x6 cost penalty on corridor roads.
export const EM_KINDS={ambulance:'Ambulance',police:'Police car',fire:'Fire truck'};
const YIELD_L=300,CLEAR_L=500,CLEAR_PEN=6;
const clock=t=>`${Math.floor(t/60)}:${String(Math.floor(t%60)).padStart(2,'0')}`;
function emLog(s,m){s.em.log.unshift(`${clock(s.t)}  ${m}`);if(s.em.log.length>8)s.em.log.pop();}
const emName=v=>`${EM_KINDS[v.em]} #${v.id}`;
export function computeEmRoute(s,from,to,cost){return s.opts.algo==='dijkstra'?dijkstra(s.graph,from,to,cost):astar(s.graph,from,to,cost,EM.boost);}
export function nearestNode(s,lat,lng){let best=null,bd=Infinity;for(const n of Object.values(s.graph.nodes)){const d=haversine(n,{lat,lng});if(d<bd){bd=d;best=n.id;}}return best;}
// Dispatch a unit. dest = incident node id (origin is then a far-away node); without dest a random far-apart pair is used.
export function spawnEmergency(s,kind='ambulance',dest=null){
 if(!EM_KINDS[kind])kind='ambulance';
 const N=s.graph.nodes,ids=Object.keys(N),pick=a=>a[Math.floor(rand(s)*a.length)],pairs=[];
 if(dest&&N[dest]){const ds=ids.filter(i=>i!==dest).map(i=>[i,haversine(N[i],N[dest])]),mx=ds.reduce((a,d)=>Math.max(a,d[1]),0),far=ds.filter(d=>d[1]>=.6*mx).map(d=>d[0]);
  for(let i=0;i<8&&far.length;i++)pairs.push([pick(far),dest]);}
 else{const ns=Object.values(N),la=ns.map(n=>n.lat),lg=ns.map(n=>n.lng),diag=haversine({lat:Math.min(...la),lng:Math.min(...lg)},{lat:Math.max(...la),lng:Math.max(...lg)});
  for(let i=0;i<40;i++){const o=pick(ids),d=pick(ids);if(o!==d&&haversine(N[o],N[d])>=.4*diag)pairs.push([o,d]);}
  for(let i=0;i<10;i++)pairs.push([pick(ids),pick(ids)]);}
 for(const [o,d] of pairs){if(o===d)continue;
  const res=computeEmRoute(s,o,d,makeEmCostFn({loads:s.loads}));if(!res.found||!res.edges.length)continue;
  const norm=computeRoute({...s,opts:{...s.opts,algo:'astar'}},o,d,costFor(s,s.loads)).res; // an ordinary car's route right now, timed with the same speed model the simulation uses
  const v={id:s.nextId++,o,d,route:res.edges,nodes:res.nodes,i:0,s:0,speed:0,status:'moving',label:'Emergency',tripT:0,rerouted:false,lat:0,lng:0,em:kind,emReroutes:0,normEta:norm.found?norm.edges.reduce((a,id)=>{const e=s.graph.edges[id];return a+e.length/Math.max(e.speed/congestion(e.count/e.capacity),.15*e.speed);},0):NaN};
  s.vehicles.push(v);place(s,v);s.em.dispatched++;emLog(s,emName(v)+' dispatched');return v;}
 return null;}
// Re-plan every emergency unit from its next junction; switch only if blocked or clearly faster.
function manageEm(s){const g=s.graph;let changed=false;
 for(const v of s.vehicles){if(!v.em||v.status!=='moving')continue;
  const cost=makeEmCostFn({loads:s.loads}),res=computeEmRoute(s,v.nodes[v.i+1],v.d,cost);if(!res.found)continue;
  const cur=v.route.slice(v.i+1),blocked=cur.some(id=>g.edges[id].closed),curCost=blocked?Infinity:cur.reduce((a,id)=>a+cost(g.edges[id]),0);
  if(res.cost<curCost*.88){v.route=v.route.slice(0,v.i+1).concat(res.edges);v.nodes=v.nodes.slice(0,v.i+2).concat(res.nodes.slice(1));v.rerouted=true;v.emReroutes++;s.em.reroutes++;changed=true;
   emLog(s,`${emName(v)} redirected (${blocked?'road closed ahead':'saves ~'+Math.round(curCost-res.cost)+' s'})`);}}
 return changed;}
// Edges within L metres ahead of each emergency unit, with the unit's direction and position (for the first edge).
function corridor(s,L){const g=s.graph,m=new Map();
 for(const v of s.vehicles){if(!v.em)continue;let rem=L;
  for(let k=v.i;k<v.route.length&&rem>0;k++){const e=g.edges[v.route[k]],st=k===v.i?v.s:0;
   if(!m.has(e.id))m.set(e.id,[]);m.get(e.id).push({fwd:v.nodes[k]===e.a,s:st,first:k===v.i});rem-=e.length-st;}}
 return m;}
// A civilian yields if it travels the same way on a corridor road and (on the unit's own road) is ahead of it.
function mustYield(cor,v,e){const en=cor.get(e.id);if(!en)return false;const fwd=v.nodes[v.i]===e.a;
 return en.some(x=>x.fwd===fwd&&(!x.first||(v.s>x.s&&v.s-x.s<YIELD_L)));}
// Divert civilians that are about to drive into an emergency unit's corridor (same direction, next 4 roads).
function clearWay(s){const g=s.graph,cor=corridor(s,CLEAR_L);if(!cor.size)return 0;
 const hits=v=>{for(let k=v.i+1;k<Math.min(v.route.length,v.i+5);k++){const e=g.edges[v.route[k]],en=cor.get(e.id),fwd=v.nodes[k]===e.a;if(en&&en.some(x=>x.fwd===fwd))return true;}return false;};
 const aff=s.vehicles.filter(v=>!v.em&&v.status!=='stranded'&&hits(v)).slice(0,40);if(!aff.length)return 0;
 const prev=s.lastReroute,before=new Map(aff.map(v=>[v.id,v.route]));
 assignRoutes(s,aff,{costFor:l=>{const b=costFor(s,l);return e=>b(e)*(cor.has(e.id)?CLEAR_PEN:1);},route:(f,t,c)=>computeRoute(s,f,t,c)},{improveOnly:true,kind:'emergency'});
 s.lastReroute=prev; // keep the closure/jam summary in the Reroutes tab; emergency diversions are counted in s.em
 let n=0;for(const v of aff)if(v.route!==before.get(v.id))n++;s.em.diverted+=n;return n;}
// A road a few hundred metres ahead of the first active unit whose closure keeps the network connected (to demo the redirect).
export function emBlockEdge(s){const g=s.graph;
 for(const v of s.vehicles){if(!v.em||v.status!=='moving')continue;
  for(const id of v.route.slice(v.i+2).filter(id=>g.edges[id].length>40&&!g.edges[id].closed).slice(0,6))if(connectedWith(s,new Set([id])))return id;}
 return null;}
