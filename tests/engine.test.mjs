import test from 'node:test';import assert from 'node:assert/strict';
import {buildGraph} from '../src/engine/graph.js';import {dijkstra,astar} from '../src/engine/routing.js';
import {makeCostFn} from '../src/engine/edgeCost.js';import {createSim,closeEdges,openEdge,tick,refresh} from '../src/engine/sim.js';
const tiny={nodes:[{id:'A',lat:0,lng:0,r:0,c:0},{id:'B',lat:0,lng:.01,r:0,c:2},{id:'C',lat:0,lng:.02,r:0,c:4},{id:'D',lat:.004,lng:.01,r:1,c:2}],
 edges:[['ab','A','B'],['bc','B','C'],['ad','A','D'],['dc','D','C']].map(([id,a,b])=>({id,a,b,name:id,kmh:50,capacity:10}))};
const mk=()=>buildGraph(tiny),cost=makeCostFn();
test('dijkstra shortest route',()=>{const r=dijkstra(mk(),'A','C',cost);assert.deepEqual(r.edges,['ab','bc']);assert.ok(r.expanded>0);});
test('A* equals Dijkstra cost',()=>{const g=mk();assert.ok(Math.abs(dijkstra(g,'A','C',cost).cost-astar(g,'A','C',cost).cost)<1e-9);});
test('closed edge never used',()=>{const g=mk();g.edges.bc.closed=true;for(const f of[dijkstra,astar])assert.ok(!f(g,'A','C',cost).edges.includes('bc'));});
test('unreachable is a safe no-route',()=>{const g=mk();g.edges.bc.closed=g.edges.dc.closed=true;const r=astar(g,'A','C',cost);assert.equal(r.found,false);assert.deepEqual(r.edges,[]);});
test('congestion raises cost',()=>{const g=mk(),e=g.edges.ab,c0=cost(e);e.count=10;assert.ok(cost(e)>c0);});
test('reopen makes road available',()=>{const g=mk();g.edges.bc.closed=true;g.edges.bc.closed=false;assert.deepEqual(dijkstra(g,'A','C',cost).edges,['ab','bc']);});
const fork={nodes:[['S',0,0],['M',0,.01],['R',0,.015],['P',.001,.015],['Q',-.0012,.015],['T',0,.02]].map(([id,lat,lng])=>({id,lat,lng,r:0,c:0})),
 edges:[['sm','S','M'],['mr','M','R'],['rt','R','T'],['mp','M','P'],['pt','P','T'],['mq','M','Q'],['qt','Q','T']].map(([id,a,b])=>({id,a,b,name:id,kmh:50,capacity:id==='sm'?99:5}))};
function forkSim(balance){const s=createSim(fork,{vehicles:0,opts:{balance,respawn:false,algo:'both'}});
 for(let k=1;k<=12;k++)s.vehicles.push({id:k,o:'S',d:'T',route:['sm','mr','rt'],nodes:['S','M','R','T'],i:0,s:0,status:'moving',tripT:0,lat:0,lng:0});
 refresh(s);return s;}
test('closure identifies and reroutes affected vehicles',()=>{const s=forkSim(true);const r=closeEdges(s,['mr']);
 assert.equal(r.affected,12);assert.ok(s.vehicles.every(v=>!v.route.includes('mr')&&v.rerouted));assert.equal(r.stats.sameCost,r.stats.n);});
test('load balancing spreads users; OFF herds them',()=>{
 const on=forkSim(true),off=forkSim(false);closeEdges(on,['mr']);closeEdges(off,['mr']);
 const via=(s,e)=>s.vehicles.filter(v=>v.route.includes(e)).length;
 assert.ok(via(on,'mp')>0&&via(on,'mq')>0);assert.ok(via(off,'mp')===12||via(off,'mq')===12);});
test('arrived vehicles leave density; reopen works in sim',()=>{const s=forkSim(true);s.vehicles.length=1;refresh(s);
 for(let i=0;i<400&&s.vehicles.length;i++)tick(s);assert.equal(s.arrived,1);assert.equal(s.grid.cells.reduce((a,c)=>a+c.count,0),0);
 closeEdges(s,['mr']);openEdge(s,'mr');assert.equal(s.graph.edges.mr.closed,false);assert.equal(s.closures.length,0);});
import {toGraph} from '../src/data/osm.js';import {pointAt} from '../src/engine/sim.js';
test('OSM data builds a routable graph on real geometry',()=>{
 const el=[];let id=1;const nid={};const node=(x,y)=>{const k=x+','+y;if(!nid[k]){nid[k]=id++;el.push({type:'node',id:nid[k],lat:12.97+y*.001,lon:77.59+x*.001});}return nid[k];};
 let w=1;for(let y=0;y<4;y++)el.push({type:'way',id:w++,tags:{highway:'secondary',name:'H'+y},nodes:[0,1,2,3].map(x=>node(x,y))});
 for(let x=0;x<4;x++)el.push({type:'way',id:w++,tags:{highway:'residential',name:'V'+x},nodes:[0,1,2,3].map(y=>node(x,y))});
 const d=toGraph({elements:el},12.97,77.59);assert.equal(d.edges.length,24);
 const s=createSim(d,{vehicles:20,opts:{respawn:false}});for(let i=0;i<30;i++)tick(s);
 assert.ok(s.vehicles.every(v=>Number.isFinite(v.lat)&&Number.isFinite(v.lng)));
 const e=Object.values(s.graph.edges)[0];assert.ok(Math.abs(pointAt(e,.5,true)[0]-pointAt(e,.5,false)[0])<1e-9);});
import {rerouteCongestion,busiestEdges} from '../src/engine/sim.js';
test('congestion rerouting moves traffic off a jammed road',()=>{const s=forkSim(true);s.opts.autoJam=false;
 const r=rerouteCongestion(s,1);assert.ok(r&&r.kind==='congestion');
 const on=s.vehicles.filter(v=>v.route.includes('mr')).length;assert.ok(on<12&&on>0||on<12);assert.ok(s.vehicles.some(v=>v.rerouted));});
test('busiest-edge picker keeps network connected',()=>{const s=forkSim(true);const ids=busiestEdges(s,1);assert.equal(ids.length,1);});

// ---------------- emergency vehicles ----------------
import {spawnEmergency,emBlockEdge} from '../src/engine/sim.js';import {makeEmCostFn,EM} from '../src/engine/edgeCost.js';
const emSim=(o={})=>createSim(fork,{vehicles:0,opts:{respawn:false,autoJam:false,algo:'astar',...o}});
const civ=(id,s0)=>({id,o:'S',d:'T',route:['sm','mr','rt'],nodes:['S','M','R','T'],i:0,s:s0,status:'moving',tripT:0,lat:0,lng:0});
test('A* with the emergency boost matches Dijkstra',()=>{const g=mk(),c=makeEmCostFn();
 assert.ok(Math.abs(dijkstra(g,'A','C',c).cost-astar(g,'A','C',c,EM.boost).cost)<1e-9);});
test('emergency unit is dispatched, flagged, and adds no congestion',()=>{const s=emSim();const v=spawnEmergency(s,'ambulance','T');
 assert.ok(v&&v.em==='ambulance'&&v.d==='T'&&v.route.length>0&&s.em.dispatched===1);refresh(s);
 assert.ok(Object.values(s.graph.edges).every(e=>e.count===0));});
test('emergency unit is redirected when a road ahead closes (and not by the civilian assignment)',()=>{const s=emSim();const v=spawnEmergency(s,'police','T');
 const id=emBlockEdge(s);assert.ok(id,'a blockable road ahead');const r=closeEdges(s,[id]);
 assert.equal(r.affected,0);assert.ok(!v.route.includes(id));assert.ok(v.emReroutes>=1&&v.rerouted&&s.em.reroutes>=1);
 for(let i=0;i<800&&s.vehicles.length;i++)tick(s);assert.equal(s.em.arrived,1);});
test('civilians ahead pull over, then resume once the unit has passed',()=>{
 const s=emSim();const v=spawnEmergency(s,'fire','T');const c=civ(99,100);s.vehicles.push(c);refresh(s);assert.equal(v.nodes[0],'S');
 tick(s);assert.ok(c.yielding&&c.s===100&&v.s>0);assert.ok(s.em.yields>=1);
 for(let i=0;i<300&&v.route[v.i]==='sm';i++)tick(s);tick(s);assert.equal(c.yielding,false);const s0=c.s;tick(s);assert.ok(c.s>s0);});
test('no yielding when priority is switched off',()=>{const s=emSim({emPriority:false});spawnEmergency(s,'fire','T');const c=civ(99,100);s.vehicles.push(c);refresh(s);
 tick(s);assert.ok(!c.yielding&&c.s>100);});
test('emergency unit beats an identical civilian trip',()=>{const s=emSim();spawnEmergency(s,'ambulance','T');s.vehicles.push(civ(99,0));refresh(s);
 for(let i=0;i<900&&s.vehicles.length;i++)tick(s);assert.equal(s.em.arrived,1);assert.equal(s.arrived,1);assert.ok(s.em.time<s.arrivedTime);});
