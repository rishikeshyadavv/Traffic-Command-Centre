// Spatial density grid (separate from edge capacity). Edge->cell mapping is simplified: an edge belongs to the cell of its midpoint.
export function makeGrid(g,rows,cols){
 const ns=Object.values(g.nodes),lat=ns.map(n=>n.lat),lng=ns.map(n=>n.lng),m=0.001;
 const south=Math.min(...lat)-m,north=Math.max(...lat)+m,west=Math.min(...lng)-m,east=Math.max(...lng)+m;
 const dl=(north-south)/rows,dg=(east-west)/cols,cells=[];
 for(let r=0;r<rows;r++)for(let c=0;c<cols;c++)cells.push({id:`g${r}_${c}`,r,c,south:south+r*dl,north:south+(r+1)*dl,west:west+c*dg,east:west+(c+1)*dg,count:0,score:0,level:'low'});
 const gr={rows,cols,south,north,west,east,dl,dg,cells,edgeCell:{}};
 for(const e of Object.values(g.edges)){const a=g.nodes[e.a],b=g.nodes[e.b];gr.edgeCell[e.id]=cellIndex(gr,(a.lat+b.lat)/2,(a.lng+b.lng)/2);}
 return gr;
}
export const cellIndex=(gr,lat,lng)=>Math.min(gr.rows-1,Math.max(0,Math.floor((lat-gr.south)/gr.dl)))*gr.cols+Math.min(gr.cols-1,Math.max(0,Math.floor((lng-gr.west)/gr.dg)));
export function updateGrid(gr,vehicles,ref){
 for(const c of gr.cells)c.count=0;
 for(const v of vehicles)gr.cells[cellIndex(gr,v.lat,v.lng)].count++;
 for(const c of gr.cells){c.score=Math.min(1,c.count/ref);c.level=c.score<.4?'low':c.score<.75?'medium':'high';}
}
