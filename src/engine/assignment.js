// Sequential assignment with incremental predicted-load updates (a heuristic, NOT a global optimum).
// 1) sort affected vehicles: longest remaining trip first, then id (deterministic)
// 2) remove their stale planned load (avoids double counting)
// 3) balance ON: after each vehicle picks a route, add its load so the next vehicle sees updated costs
//    balance OFF: everyone is priced against the same frozen snapshot -> everyone picks the same cheapest route
export function assignRoutes(s,affected,{costFor,route},{improveOnly=false,kind='closure'}={}){
 const g=s.graph,bal=s.opts.balance,sumE=(ids)=>ids.reduce((a,id)=>a+g.edges[id].length,0);
 const remLen=v=>g.edges[v.route[v.i]].length-v.s+sumE(v.route.slice(v.i+1));
 const sorted=[...affected].sort((a,b)=>remLen(b)-remLen(a)||a.id-b.id);
 const base=costFor(s.loads),oldCost=new Map(sorted.map(v=>[v.id,v.route.slice(v.i+1).reduce((a,id)=>a+base(g.edges[id]),0)]));
 const loads={...s.loads};for(const v of sorted)for(let k=v.i+1;k<v.route.length;k++)loads[v.route[k]]--;
 const frozen={...loads},groups=new Map(),stats={dijkstra:{expanded:0,ms:0},astar:{expanded:0,ms:0},both:false,sameCost:0,n:0};
 let newSum=0,oldSum=0,stranded=0,routed=0;
 for(const v of sorted){
  const cf=costFor(bal?loads:frozen),{res,cmp}=route(v.nodes[v.i+1],v.d,cf);
  if(cmp){stats.both=true;stats.n++;if(Math.abs(cmp.d.cost-cmp.a.cost)<1e-6)stats.sameCost++;
   for(const [k,r] of [['dijkstra',cmp.d],['astar',cmp.a]]){stats[k].expanded+=r.expanded;stats[k].ms+=r.ms;}}
  else{const k=s.opts.algo;stats[k].expanded+=res.expanded;stats[k].ms+=res.ms;}
  if(!res.found){stranded++;continue;} // vehicle will strand at the next junction (see tick)
  if(improveOnly){ // congestion mode: only move a vehicle if the new route is clearly (>10%) cheaper than staying put
   const cur=v.route.slice(v.i+1).reduce((a,id)=>a+cf(g.edges[id]),0);
   if(res.cost>cur*0.9){if(bal)for(const id of v.route.slice(v.i+1))loads[id]=(loads[id]||0)+1;continue;}}
  v.route=v.route.slice(0,v.i+1).concat(res.edges);v.nodes=v.nodes.slice(0,v.i+2).concat(res.nodes.slice(1));v.rerouted=true;
  if(bal)for(const id of res.edges)loads[id]=(loads[id]||0)+1;
  const key=res.edges[0]??''; 
  if(!groups.has(key))groups.set(key,{key,n:0,cost:0,edges:res.edges});
  const gr=groups.get(key);gr.n++;gr.cost+=res.cost;newSum+=res.cost;oldSum+=oldCost.get(v.id);routed++;
 }
 if(improveOnly&&!routed)return s.lastReroute;
 const ord=[...groups.values()].sort((a,b)=>b.n-a.n),lbl=new Map(ord.map((x,i)=>[x.key,'Via '+(g.edges[x.key]?.name??'destination')+' ('+x.key+')']));
 for(const v of sorted)if(v.rerouted)v.label=lbl.get(v.route[v.i+1]??'')??v.label;
 return s.lastReroute={kind,t:s.t,affected:sorted.length,balance:bal,algo:s.opts.algo,stranded,stats,
  dist:ord.map(x=>({label:lbl.get(x.key),n:x.n,avgCost:x.cost/x.n,edges:x.edges})),
  avgOld:routed?oldSum/routed:NaN,avgNew:routed?newSum/routed:NaN};
}
