// Geo + seeded RNG helpers. RNG state lives in the sim state (s.seed) so runs are replayable and clonable.
export const haversine=(a,b)=>{const R=6371000,t=Math.PI/180,dl=(b.lat-a.lat)*t,dg=(b.lng-a.lng)*t;
 const x=Math.sin(dl/2)**2+Math.cos(a.lat*t)*Math.cos(b.lat*t)*Math.sin(dg/2)**2;return 2*R*Math.asin(Math.sqrt(x));};
export function rand(s){s.seed=(s.seed+0x6D2B79F5)|0;let t=Math.imul(s.seed^(s.seed>>>15),1|s.seed);
 t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;}
