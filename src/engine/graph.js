import {haversine} from './util.js?v=6';
// Road graph = source of truth for routing. Nodes are junctions, edges are segments (two-way unless oneWay:true).
export function buildGraph(data){
 const nodes={},edges={},adj={};
 for(const n of data.nodes){nodes[n.id]={...n};adj[n.id]=[];}
 for(const e of data.edges){
  // geom = polyline [lat,lng][] from a to b (real road shape); cum = cumulative metres along it
  const geom=e.geom??[[nodes[e.a].lat,nodes[e.a].lng],[nodes[e.b].lat,nodes[e.b].lng]],cum=[0];
  for(let k=1;k<geom.length;k++)cum.push(cum[k-1]+haversine({lat:geom[k-1][0],lng:geom[k-1][1]},{lat:geom[k][0],lng:geom[k][1]}));
  edges[e.id]={...e,geom,cum,length:Math.max(1,cum[cum.length-1]),speed:e.kmh/3.6,count:0,closed:false,reason:null};
  adj[e.a].push({e:e.id,to:e.b});if(!e.oneWay)adj[e.b].push({e:e.id,to:e.a});}
 const lg=Object.values(nodes).map(n=>n.lng);
 return {nodes,edges,adj,bounds:{minLng:Math.min(...lg),maxLng:Math.max(...lg)},maxSpeed:Math.max(...Object.values(edges).map(e=>e.speed))};
}
