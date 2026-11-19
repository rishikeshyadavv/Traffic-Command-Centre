import {haversine} from './util.js?v=6';
class Heap{a=[];get size(){return this.a.length;}
 push(k,v){const a=this.a;a.push([k,v]);let i=a.length-1;while(i>0){const p=(i-1)>>1;if(a[p][0]<=a[i][0])break;[a[p],a[i]]=[a[i],a[p]];i=p;}}
 pop(){const a=this.a,top=a[0],last=a.pop();if(a.length){a[0]=last;let i=0;for(;;){const l=2*i+1,r=l+1;let m=i;
  if(l<a.length&&a[l][0]<a[m][0])m=l;if(r<a.length&&a[r][0]<a[m][0])m=r;if(m===i)break;[a[m],a[i]]=[a[i],a[m]];i=m;}}return top;}}
// Shared search: h=0 gives Dijkstra, h=admissible heuristic gives A*. Closed edges are skipped entirely.
function search(g,from,to,cost,h){
 const t0=performance.now(),dist={[from]:0},prev={},done=new Set(),H=new Heap();let expanded=0;
 H.push(h(from),from);
 while(H.size){const [,u]=H.pop();if(done.has(u))continue;done.add(u);expanded++;if(u===to)break;
  for(const {e,to:v} of g.adj[u]){const ed=g.edges[e];if(ed.closed||done.has(v))continue;
   const nd=dist[u]+cost(ed);if(nd<(dist[v]??Infinity)){dist[v]=nd;prev[v]={u,e};H.push(nd+h(v),v);}}}
 const ms=performance.now()-t0;
 if(!(to in dist))return {found:false,nodes:[],edges:[],cost:Infinity,distance:0,time:Infinity,expanded,ms};
 const nodes=[to],edges=[];for(let c=to;c!==from;){const p=prev[c];edges.unshift(p.e);nodes.unshift(p.u);c=p.u;}
 return {found:true,nodes,edges,cost:dist[to],time:dist[to],distance:edges.reduce((s,e)=>s+g.edges[e].length,0),expanded,ms};
}
export const dijkstra=(g,a,b,cost)=>search(g,a,b,cost,()=>0);
// Heuristic: straight-line metres / fastest speed in network = lower bound on any edge-cost sum (cost >= length/speed).
// boost>1 keeps the heuristic admissible for vehicles that travel faster than the posted speed (emergency units).
export const astar=(g,a,b,cost,boost=1)=>search(g,a,b,cost,n=>haversine(g.nodes[n],g.nodes[b])/(g.maxSpeed*boost));
