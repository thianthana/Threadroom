import {measurements,SIZES} from './domain.mjs';
import {MeshRenderer} from './webgl.mjs';
const TAU=Math.PI*2;
const vsub=(a,b)=>a.map((x,i)=>x-b[i]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=a=>{const l=Math.hypot(...a)||1;return a.map(v=>v/l)};
const shade=(hex,f)=>{const n=parseInt(hex.slice(1),16);return `rgb(${[(n>>16)&255,(n>>8)&255,n&255].map(c=>Math.round(Math.min(255,c*f))).join(',')})`};
export function buildModel({size='M',fit='straight',body='female',product='polo'}={}) {
  const i=SIZES.indexOf(size), chest=measurements(size,fit).chest;
  const width=.355+(chest-34)*.010, depth=.211+i*.009;
  const feminine=body==='female', skin='#c4c1b2', pants='#d8d7cb', shoe='#f2f0e6';
  const shirt=product==='polo'?'#283b52':'#e5e0d2', accent=product==='polo'?'#d9e7c2':'#3a5545';
  const faces=[];const tri=(a,b,c,color,normalFlip=1)=>faces.push({vertices:[a,b,c],color,normalFlip});
  function surface(rings,color,n=32){
    for(let j=0;j<rings.length-1;j++)for(let t=0;t<n;t++){
      const a=t/n*TAU,b=(t+1)/n*TAU;
      const point=(r,theta)=>[Math.sin(theta)*r[1]+(r[3]||0),r[0],Math.cos(theta)*r[2]+(r[4]||0)];
      const p=point(rings[j],a),q=point(rings[j],b),r=point(rings[j+1],b),s=point(rings[j+1],a);
      const col=typeof color==='function'?color(j,t,n):color;
      const flip=rings[j+1][0]>=rings[j][0]?1:-1;
      tri(p,q,r,col,flip);tri(p,r,s,col,flip);
    }
  }
  function ellipsoid(cx,cy,cz,rx,ry,rz,color,n=24,l=14){
    const rings=[];for(let j=0;j<=l;j++){const p=Math.PI*j/l;rings.push([cy+Math.cos(p)*ry,Math.max(.001,Math.sin(p)*rx),Math.max(.001,Math.sin(p)*rz),cx,cz]);}surface(rings,color,n);
  }
  function limb(a,b,ra,rb,color,n=16,caps=true){
    const dir=norm(vsub(b,a)),side=norm(cross(dir,[0,0,1])),up=cross(side,dir);
    const point=(o,r,t)=>o.map((v,k)=>v+r*(side[k]*Math.sin(t)+up[k]*Math.cos(t)));
    const rings=6;
    for(let j=0;j<rings;j++)for(let t=0;t<n;t++){
      const u=j/rings,v=(j+1)/rings,c1=a.map((x,k)=>x+(b[k]-x)*u),c2=a.map((x,k)=>x+(b[k]-x)*v),r1=ra+(rb-ra)*u,r2=ra+(rb-ra)*v;
      const p=point(c1,r1,t/n*TAU),q=point(c1,r1,(t+1)/n*TAU),r=point(c2,r2,(t+1)/n*TAU),s=point(c2,r2,t/n*TAU);tri(p,q,r,color);tri(p,r,s,color);
    }
    if(caps){ellipsoid(...a,ra,ra,ra,color,16,8);ellipsoid(...b,rb,rb,rb,color,16,8)}
  }
  // Full, closed surfaces: the view is a rotating 3D mesh, not a sequence of images.
  const hip=width*(feminine?1.03:.97), leg=.112+i*.008;
  surface([[.08,hip,.211+i*.006],[.0,hip*1.02,.22+i*.007],[-.23,hip*.95,.205+i*.007]],pants);
  for(const sign of [-1,1]){
    const x=sign*(.15+i*.009);
    surface([[-.12,leg*1.21,leg*1.12,x],[-.38,leg*1.13,leg,x],[-.7,leg*.92,leg*.91,x],[-.82,leg*.82,leg*.8,x],[-1.08,leg*.85,leg*.78,x],[-1.38,leg*.64,leg*.67,x],[-1.46,leg*.64,leg*.67,x]],pants,24);
    ellipsoid(x,-1.51,.071,leg*.84,.085,.205,shoe);
  }
  const shoulder=width*(feminine?1.01:1.09), arm=.077+i*.004;
  for(const sign of [-1,1]){
    const top=[sign*shoulder,.85,-.01], elbow=[sign*(shoulder+.17),.23,.018], hand=[sign*(shoulder+.19),-.25,.055];
    limb(top,elbow,arm*1.24,arm,skin);
    limb(elbow,hand,arm,arm*.73,skin);
    ellipsoid(sign*(shoulder+.19),-.33,.06,arm*.83,.12,arm*.62,skin,18,10);
  }
  surface([[.92,.108,.10],[1.09,.105,.10],[1.16,.09,.08]],skin,24);
  ellipsoid(0,1.38,-.006,.155, .245,.149,skin,32,22);
  // Neutral, featureless mannequins avoid inventing a person's identity.
  const waist=width*(fit==='shaped'?.80:.985);
  const rings=[[-.235,width*(fit==='shaped'?1.02:1.01),depth*.98],[-.19,width,depth],[.13,waist,depth*(fit==='shaped'?.90:1)],[.29,waist,depth*(fit==='shaped'?.91:1)],[.46,width*.97,depth*1.02],[.63,width,depth*1.08],[.79,shoulder*.99,depth*1.03],[.88,shoulder,depth*.91],[.96,shoulder*.77,depth*.68],[1.015,.122,.113]];
  surface(rings,(row)=>product==='polo'&&row===0?accent:shirt,40);
  for(const sign of [-1,1]){
    const a=[sign*shoulder*.91,.855,-.005],b=[sign*(shoulder+.14),.54,.007];
    limb(a,b,arm*1.62,arm*1.47,shirt,22,false);
    const d=vsub(b,a),c=b.map((v,k)=>v-d[k]*.075);limb(c,b,arm*1.50,arm*1.49,accent,22,false);
  }
  if(product==='polo'){
    // Collar and placket are actual mesh details on the front and back.
    surface([[1.01,.12,.115],[1.035,.13,.12],[1.065,.112,.105]],accent,32);
    tri([-.13,1.035,.12],[-.025,.80,depth*1.08],[-.21,.91,depth*.87],accent);
    tri([.13,1.035,.12],[.21,.91,depth*.87],[.025,.80,depth*1.08],accent);
    tri([-.019,.91,depth*1.04],[.019,.91,depth*1.04],[.019,.68,depth*1.09],'#1d3046');
    tri([-.019,.91,depth*1.04],[.019,.68,depth*1.09],[-.019,.68,depth*1.09],'#1d3046');
    ellipsoid(0,.845,depth*1.09,.008,.008,.008,accent,10,6);
    ellipsoid(0,.76,depth*1.1,.008,.008,.008,accent,10,6);
  }else surface([[1.005,.122,.115],[1.026,.128,.12]],accent,32);
  return {faces,width,depth,shirt,accent,body,size,fit,product};
}
export class MannequinViewer {
  constructor(canvas,onAngle,artwork={}) {
    this.canvas=canvas;this.onAngle=onAngle;this.artwork=artwork;this.angle=-.12;this.tilt=0;this.auto=false;this.zoom=1;this.model=buildModel();this.pointer=null;this.dragMoved=false;this.last=0;this.images={};
    this.gl=canvas.getContext('webgl',{alpha:true,antialias:true,premultipliedAlpha:false});this.ctx=this.gl?null:canvas.getContext('2d');
    if(this.gl)this.renderer=new MeshRenderer(this.gl,artwork,()=>this.draw());
    this.boundFrame=t=>this.frame(t);this.abort=new AbortController();const opt={signal:this.abort.signal};
    canvas.addEventListener('pointerdown',e=>{this.pointer={x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY};this.auto=false;this.dragMoved=false;canvas.setPointerCapture(e.pointerId)},opt);
    canvas.addEventListener('pointermove',e=>{if(!this.pointer)return;const dx=e.clientX-this.pointer.x,dy=e.clientY-this.pointer.y;if(!this.dragMoved&&Math.abs(e.clientY-this.pointer.startY)>Math.abs(e.clientX-this.pointer.startX))return;if(Math.abs(e.clientX-this.pointer.startX)>5)this.dragMoved=true;if(this.dragMoved){this.angle+=dx*.012;this.tilt=Math.max(-.18,Math.min(.18,this.tilt+dy*.0015));canvas.classList.add('dragging');this.draw();}this.pointer.x=e.clientX;this.pointer.y=e.clientY},opt);
    for(const ev of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(ev,()=>{this.pointer=null;canvas.classList.remove('dragging')},opt);
    canvas.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();this.angle=e.key==='Home'?0:e.key==='End'?Math.PI:this.angle+(e.key==='ArrowLeft'?-.15:.15);this.draw()}},opt);
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(canvas);this.resize();this.raf=requestAnimationFrame(this.boundFrame);
  }
  resize(){const {width,height}=this.canvas.getBoundingClientRect();this.w=width||500;this.h=height||470;const dpr=Math.min(devicePixelRatio||1,2);this.canvas.width=this.w*dpr;this.canvas.height=this.h*dpr;this.ctx?.setTransform(dpr,0,0,dpr,0,0);this.draw()}
  update(options){this.model=buildModel(options);this.renderer?.update(this.model);this.draw()}
  setAngle(angle){this.angle=angle;this.auto=false;this.tilt=0;this.draw()}
  toggleAuto(){this.auto=!this.auto;return this.auto}
  setZoom(){this.zoom=this.zoom===1?1.25:1;this.draw()}
  project(p){const c=Math.cos(this.angle),s=Math.sin(this.angle),x=p[0]*c+p[2]*s,z=-p[0]*s+p[2]*c,cy=Math.cos(this.tilt),sy=Math.sin(this.tilt),y=p[1]*cy-z*sy,zz=p[1]*sy+z*cy;const perspective=5.5/(5.5-zz),scale=Math.min(this.h/3.95,this.w/2.2)*this.zoom;return [this.w/2+x*scale*perspective,this.h*.54-y*scale*perspective,zz]}
  draw(){
    if(this.renderer){this.renderer.draw(this);const angle=((this.angle*180/Math.PI)%360+360)%360;this.onAngle?.(Math.round(angle));return}
    if(!this.model||!this.ctx)return;const ctx=this.ctx;ctx.clearRect(0,0,this.w,this.h);
    const floor=this.project([0,-1.59,0]);ctx.save();ctx.translate(floor[0],floor[1]);ctx.scale(1,.17);const g=ctx.createRadialGradient(0,0,0,0,0,Math.min(this.w*.35,170));g.addColorStop(0,'#4e624332');g.addColorStop(.4,'#71835a18');g.addColorStop(1,'#71835a00');ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,Math.min(this.w*.35,170),0,TAU);ctx.fill();ctx.strokeStyle='#b7c2a75a';ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(0,0,Math.min(this.w*.34,155),Math.min(this.w*.34,155),0,0,TAU);ctx.stroke();ctx.restore();
    const c=Math.cos(this.angle),s=Math.sin(this.angle);
    const faces=this.model.faces.map(f=>{const p=f.vertices.map(v=>this.project(v)),n=norm(cross(vsub(f.vertices[1],f.vertices[0]),vsub(f.vertices[2],f.vertices[0]))).map(x=>x*(f.normalFlip||1));const nx=n[0]*c+n[2]*s,nz=-n[0]*s+n[2]*c;const light=Math.max(0,nx*-.40+n[1]*.65+nz*.65);return {p,z:(p[0][2]+p[1][2]+p[2][2])/3,color:shade(f.color,.72+light*.34)}}).sort((a,b)=>a.z-b.z);
    for(const f of faces){ctx.beginPath();ctx.moveTo(f.p[0][0],f.p[0][1]);ctx.lineTo(f.p[1][0],f.p[1][1]);ctx.lineTo(f.p[2][0],f.p[2][1]);ctx.closePath();ctx.fillStyle=f.color;ctx.fill();ctx.strokeStyle=f.color;ctx.lineWidth=.55;ctx.stroke()}
    this.drawDecal(false);this.drawDecal(true);
    const angle=((this.angle*180/Math.PI)%360+360)%360;this.onAngle?.(Math.round(angle));
  }
  drawDecal(back){
    const facing=Math.cos(this.angle)*(back?-1:1);if(facing<.12)return;
    const m=this.model,z=(back?-1:1)*(m.depth*1.1+.012),y=back?.68:.59,center=this.project([0,y,z]);const a=this.project([.13,y,z]),b=this.project([0,y+.13,z]);
    const ctx=this.ctx;ctx.save();ctx.translate(center[0],center[1]);ctx.transform((a[0]-center[0])/40,(a[1]-center[1])/40,(center[0]-b[0])/40,(center[1]-b[1])/40,0,0);
    if(back)ctx.scale(-1,1);
    const imagePath=this.artwork[m.product]?.[back?'back':'front'];
    if(imagePath){if(!this.images[imagePath]){const image=new Image();image.onload=()=>this.draw();image.src=imagePath;this.images[imagePath]=image;}const img=this.images[imagePath];if(img.complete&&img.naturalWidth)ctx.drawImage(img,-70,-60,140,140*img.naturalHeight/img.naturalWidth);}
    else{ctx.fillStyle=m.accent;ctx.textAlign='center';ctx.font='500 8px Manrope, sans-serif';ctx.fillText(back?'TOGETHER, ALWAYS':'OUR COLLECTION',0,-15);ctx.font='500 39px Manrope, sans-serif';ctx.fillText('07',0,25);ctx.font='500 6px Manrope, sans-serif';ctx.fillText(back?'ONE CLASS · TWO STYLES':'THREADROOM',0,40)}ctx.restore();
  }
  frame(t){if(this.auto&&t-this.last>34){this.angle+=.009;this.draw();this.last=t}this.raf=requestAnimationFrame(this.boundFrame)}
  destroy(){cancelAnimationFrame(this.raf);this.abort.abort();this.resizeObserver.disconnect();this.renderer?.destroy()}
}
