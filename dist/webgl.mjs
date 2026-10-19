/* Small dependency-free WebGL renderer. Depth testing keeps intersecting sleeves
   and body surfaces correct from every angle; vertex normals smooth the mesh. */
const VERTEX=`
attribute vec3 position;
attribute vec3 normal;
attribute vec3 color;
uniform vec2 viewport;
uniform float scale;
uniform float angle;
uniform float tilt;
varying vec3 litColor;
vec3 rotate(vec3 p){float c=cos(angle),s=sin(angle);p=vec3(p.x*c+p.z*s,p.y,-p.x*s+p.z*c);float a=cos(tilt),b=sin(tilt);return vec3(p.x,p.y*a-p.z*b,p.y*b+p.z*a);}
vec4 project(vec3 p){p=rotate(p);float d=5.5-p.z;return vec4(p.x*scale*11.0/viewport.x,p.y*scale*11.0/viewport.y-0.08*d,(20.1/19.9)*d-4.0/19.9,d);}
void main(){vec3 n=normalize(rotate(normal));float light=max(0.0,dot(n,normalize(vec3(-0.55,0.9,1.3))));litColor=color*(0.72+0.34*light);gl_Position=project(position);}
`;
const FRAGMENT=`precision mediump float;varying vec3 litColor;void main(){gl_FragColor=vec4(litColor,1.0);}`;
const DECAL_VERTEX=VERTEX.slice(VERTEX.indexOf('uniform vec2 viewport'),VERTEX.indexOf('void main()')).replace('varying vec3 litColor;','')+`
attribute vec3 position;attribute vec2 uv;varying vec2 texCoord;void main(){texCoord=uv;gl_Position=project(position);}`;
const DECAL_FRAGMENT=`precision mediump float;varying vec2 texCoord;uniform sampler2D artwork;void main(){vec4 c=texture2D(artwork,texCoord);if(c.a<0.02)discard;gl_FragColor=c;}`;
const normalize=v=>{const l=Math.hypot(...v)||1;return v.map(x=>x/l)};
const normal=(a,b,c,flip=1)=>normalize([(b[1]-a[1])*(c[2]-a[2])-(b[2]-a[2])*(c[1]-a[1]),(b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2]),(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])].map(x=>x*flip));
function program(gl,vs,fs){function shader(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s}const p=gl.createProgram(),v=shader(gl.VERTEX_SHADER,vs),f=shader(gl.FRAGMENT_SHADER,fs);gl.attachShader(p,v);gl.attachShader(p,f);gl.linkProgram(p);gl.deleteShader(v);gl.deleteShader(f);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));return p}
export class MeshRenderer{
  constructor(gl,artwork,onReady){this.gl=gl;this.artwork=artwork;this.onReady=onReady;this.program=program(gl,VERTEX,FRAGMENT);this.decalProgram=program(gl,DECAL_VERTEX,DECAL_FRAGMENT);this.buffer=gl.createBuffer();this.decalBuffer=gl.createBuffer();this.textures=new Map();this.model=null;this.attributeCount=gl.getParameter(gl.MAX_VERTEX_ATTRIBS);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA)}
  update(model){
    this.model=model;const summed=new Map(),normals=[];const key=(v,color)=>v.map(x=>x.toFixed(6)).join(',')+color;
    for(const f of model.faces){const n=normal(...f.vertices,f.normalFlip||1);normals.push(n);for(const v of f.vertices){const k=key(v,f.color),sum=summed.get(k)||[0,0,0];summed.set(k,sum.map((x,i)=>x+n[i]))}}
    const data=[];
    for(const f of model.faces){const rgb=[1,3,5].map(i=>parseInt(f.color.slice(i,i+2),16)/255);for(const v of f.vertices){data.push(...v,...normalize(summed.get(key(v,f.color))),...rgb)}}
    const gl=this.gl;gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.STATIC_DRAW);this.count=data.length/9;this.prepareDecal(false);this.prepareDecal(true);
  }
  prepareDecal(back){
    const m=this.model,path=this.artwork[m.product]?.[back?'back':'front'],key=path||`${m.product}:${back}`;
    if(this.textures.has(key))return;
    const gl=this.gl,texture=gl.createTexture();this.textures.set(key,{texture,ready:false});
    const upload=image=>{gl.bindTexture(gl.TEXTURE_2D,texture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);this.textures.get(key).ready=true;this.onReady?.()};
    if(path){const image=new Image();image.onload=()=>{try{upload(image)}catch{this.textures.get(key).ready=false}};image.src=path;return}
    const c=document.createElement('canvas');c.width=512;c.height=512;const ctx=c.getContext('2d');ctx.fillStyle=m.accent;ctx.textAlign='center';ctx.font='500 31px sans-serif';ctx.fillText(back?'TOGETHER, ALWAYS':'OUR COLLECTION',256,116);ctx.font='500 220px sans-serif';ctx.fillText('07',256,336);ctx.font='500 25px sans-serif';ctx.fillText(back?'ONE CLASS · TWO STYLES':'THREADROOM',256,408);upload(c);
  }
  uniforms(p,view){const gl=this.gl;gl.useProgram(p);gl.uniform2f(gl.getUniformLocation(p,'viewport'),view.w,view.h);gl.uniform1f(gl.getUniformLocation(p,'scale'),Math.min(view.h/3.95,view.w/2.2)*view.zoom);gl.uniform1f(gl.getUniformLocation(p,'angle'),view.angle);gl.uniform1f(gl.getUniformLocation(p,'tilt'),view.tilt)}
  resetAttributes(){for(let i=0;i<this.attributeCount;i++)this.gl.disableVertexAttribArray(i)}
  draw(view){
    const gl=this.gl;gl.viewport(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);if(!this.model)return;this.uniforms(this.program,view);this.resetAttributes();gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
    for(const [name,size,offset]of [['position',3,0],['normal',3,12],['color',3,24]]){const at=gl.getAttribLocation(this.program,name);gl.enableVertexAttribArray(at);gl.vertexAttribPointer(at,size,gl.FLOAT,false,36,offset)}
    gl.drawArrays(gl.TRIANGLES,0,this.count);
    this.drawDecal(view,false);this.drawDecal(view,true);
  }
  drawDecal(view,back){
    if(Math.cos(view.angle)*(back?-1:1)<.05)return;const m=this.model,path=this.artwork[m.product]?.[back?'back':'front'],key=path||`${m.product}:${back}`,tex=this.textures.get(key);if(!tex?.ready)return;
    const gl=this.gl,z=(back?-1:1)*(m.depth*1.11+.018),y=back?.60:.55,half=path?.235:.115;
    const vertices=[[-half,y-half,z,back?1:0,0],[half,y-half,z,back?0:1,0],[half,y+half,z,back?0:1,1],[-half,y-half,z,back?1:0,0],[half,y+half,z,back?0:1,1],[-half,y+half,z,back?1:0,1]].flat();
    this.uniforms(this.decalProgram,view);this.resetAttributes();gl.bindBuffer(gl.ARRAY_BUFFER,this.decalBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.DYNAMIC_DRAW);
    for(const [name,size,offset]of [['position',3,0],['uv',2,12]]){const at=gl.getAttribLocation(this.decalProgram,name);gl.enableVertexAttribArray(at);gl.vertexAttribPointer(at,size,gl.FLOAT,false,20,offset)}
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,tex.texture);gl.uniform1i(gl.getUniformLocation(this.decalProgram,'artwork'),0);gl.drawArrays(gl.TRIANGLES,0,6);
  }
  destroy(){const gl=this.gl;gl.deleteBuffer(this.buffer);gl.deleteBuffer(this.decalBuffer);gl.deleteProgram(this.program);gl.deleteProgram(this.decalProgram);for(const x of this.textures.values())gl.deleteTexture(x.texture)}
}
