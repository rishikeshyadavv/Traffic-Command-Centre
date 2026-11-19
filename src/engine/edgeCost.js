// edgeCost (seconds) = freeFlowTime * (congestion(V/C) + gridWeight * cellDensityScore)
//   freeFlowTime = length / speed ; V/C = (vehicles on edge + predicted load) / capacity
//   congestion(x) = 1 + alpha * x^beta  (BPR-style). Closed edges are excluded by the routers, not priced.
export const PARAMS={alpha:0.6,beta:3,gridWeight:0.5};
export const congestion=vc=>1+PARAMS.alpha*Math.pow(Math.min(vc,3),PARAMS.beta);
export const makeCostFn=({loads={},cellScore=()=>0}={})=>e=>
 (e.length/e.speed)*(congestion((e.count+(loads[e.id]||0))/e.capacity)+PARAMS.gridWeight*cellScore(e));

// Emergency vehicles: faster (EM.boost x the road speed) and only weakly slowed by congestion (EM.cw), because civilians pull over.
// emTime is used for BOTH the routing cost and the actual simulated speed, so the planner and the simulation agree.
export const EM={boost:1.4,cw:0.12};
export const emTime=(e,vc)=>e.length/Math.max(e.speed*EM.boost/(1+EM.cw*(congestion(vc)-1)),0.5*e.speed);
export const makeEmCostFn=({loads={}}={})=>e=>emTime(e,(e.count+(loads[e.id]||0))/e.capacity);
