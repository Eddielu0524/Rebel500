import * as THREE from 'three';

// Profile and details traced against Honda's 2025 wheel close-up (detail-09).
export function buildWheel(parent, x, radius, width, front, h, m) {
  const { add, rod, tube, ring, box, bolt } = h;
  const { black, rubber, dark, silver, alloy } = m;
  const TAU = Math.PI * 2;
  const group = new THREE.Group(); parent.add(group);
  group.name = front ? 'front_16in_cast_wheel' : 'rear_16in_cast_wheel';
  const sidewall = new THREE.MeshStandardMaterial({ color: '#141517', roughness: .87, metalness: 0 });
  const tread = new THREE.MeshStandardMaterial({ color: '#090a0b', roughness: .98 });
  const rimMat = new THREE.MeshStandardMaterial({ color: '#101214', roughness: .33, metalness: .50 });
  const machining = new THREE.MeshStandardMaterial({ color: '#969da1', roughness: .40, metalness: .94 });
  const points = [
    [.196,-width*.30],[.202,-width*.42],[.221,-width*.49],[radius-.074,-width*.53],
    [radius-.050,-width*.515],[radius-.026,-width*.44],[radius-.010,-width*.29],
    [radius-.002,-width*.13],[radius,0],[radius-.002,width*.13],
    [radius-.010,width*.29],[radius-.026,width*.44],[radius-.050,width*.515],
    [radius-.074,width*.53],[.221,width*.49],[.202,width*.42],[.196,width*.30],[.196,-width*.30],
  ].map(p=>new THREE.Vector2(...p));
  const profile = new THREE.SplineCurve(points).getPoints(90);
  // Cut the zigzag grooves into the tyre surface itself, including the shoulder.
  const tireGeometry=new THREE.LatheGeometry(profile,864);
  const tirePositions=tireGeometry.getAttribute('position');
  const track=[[.0,0],[.045,0],[.24,.012],[.29,.042],[.37,.043],[.465,.076]];
  const step=TAU/54;
  for(let i=0;i<tirePositions.count;i++){
    const px=tirePositions.getX(i),py=tirePositions.getY(i),pz=tirePositions.getZ(i),r=Math.hypot(px,pz),w=Math.abs(py/width);
    if(w>.465||r<radius-.039)continue;
    let offset=0;
    for(let j=1;j<track.length;j++)if(w<=track[j][0]){const t=(w-track[j-1][0])/(track[j][0]-track[j-1][0]);offset=THREE.MathUtils.lerp(track[j-1][1],track[j][1],t);break;}
    const a=Math.atan2(-pz,px)-offset-(py>0?.023:0);
    const d=Math.abs(THREE.MathUtils.euclideanModulo(a+step/2,step)-step/2);
    const depression=.0020*(1-THREE.MathUtils.smoothstep(d,.003,.012));
    const scale=(r-depression)/r;tirePositions.setX(i,px*scale);tirePositions.setZ(i,pz*scale);
  }
  tireGeometry.computeVertexNormals();
  add(group,tireGeometry,sidewall,[x,radius,0],[Math.PI/2,0,0]);
  const rimProfile = [[.184,-width*.345],[.186,-width*.39],[.197,-width*.395],[.202,-width*.37],[.202,width*.37],[.197,width*.395],[.186,width*.39],[.184,width*.345],[.184,-width*.345]].map(p=>new THREE.Vector2(...p));
  add(group,new THREE.LatheGeometry(rimProfile,128),rimMat,[x,radius,0],[Math.PI/2,0,0]);
  for (const s of [-1,1]) {
    ring(group,.219,.0013,[x,radius,s*width*.49],rubber);
    ring(group,radius-.052,.0010,[x,radius,s*width*.51],rubber);
    ring(group,.195,.0030,[x,radius,s*width*.39],rimMat);
    // Discrete fine moulding witness lines around the broad sidewalls.
    ring(group,radius-.066,.0007,[x,radius,s*width*.531],rubber);
  }
  // Dark recessed bottoms reinforce the same profile from grazing angles.
  for(let i=0;i<54;i++)for(const s of [-1,1]){
    const a=i/54*TAU + (s<0?.023:0);
    const curve=track.slice(1).map(([w,b])=>{
      const z=w*width*s;
      let r=0;
      for(let j=1;j<profile.length;j++)if((profile[j].y-z)*(profile[j-1].y-z)<=0){const t=(z-profile[j-1].y)/(profile[j].y-profile[j-1].y);r=Math.max(r,THREE.MathUtils.lerp(profile[j-1].x,profile[j].x,t));}
      r-=.0013;
      return [x+Math.cos(a+b)*r,radius+Math.sin(a+b)*r,z];
    });
    tube(group,curve,.0009,tread,16);
  }
  // Low-contrast moulded tyre size markings follow the curved sidewall.
  const letters=document.createElement('canvas');letters.width=letters.height=1024;
  const lc=letters.getContext('2d');lc.font='600 24px Arial';lc.fillStyle='#292b2d';lc.textAlign='center';
  const arcText=(text,start)=>{for(let i=0;i<text.length;i++){const a=start+(i-text.length/2)*.046;lc.save();lc.translate(512+Math.sin(a)*427,512-Math.cos(a)*427);lc.rotate(a);lc.fillText(text[i],0,0);lc.restore();}};
  arcText(front?'130/90-16 M/C':'150/80-16 M/C',-.25);arcText('TUBELESS',Math.PI+.15);
  const lettersTexture=new THREE.CanvasTexture(letters);lettersTexture.colorSpace=THREE.SRGBColorSpace;
  const lettering=new THREE.MeshStandardMaterial({map:lettersTexture,transparent:true,roughness:.9,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});
  for(const s of [-1,1]){const decal=add(group,new THREE.PlaneGeometry(radius*2,radius*2),lettering,[x,radius,s*width*.535],[0,s<0?Math.PI:0,0]);decal.castShadow=false;}
  // Five V-shaped cast webs, each splitting into two slender rectangular arms.
  const spokeShape=new THREE.Shape();
  spokeShape.moveTo(.034,-.012);spokeShape.bezierCurveTo(.069,-.013,.105,-.007,.145,.005);
  spokeShape.bezierCurveTo(.170,.012,.193,.013,.199,.014);spokeShape.lineTo(.199,.025);
  spokeShape.bezierCurveTo(.169,.023,.137,.016,.102,.012);spokeShape.bezierCurveTo(.075,.008,.055,.015,.034,.019);spokeShape.closePath();
  const spokeGeometry=new THREE.ExtrudeGeometry(spokeShape,{depth:.021,bevelEnabled:true,bevelSegments:3,bevelSize:.0024,bevelThickness:.0024,curveSegments:10,steps:1});
  const mirroredSpoke=spokeGeometry.clone();mirroredSpoke.scale(1,-1,1);
  for(const attribute of Object.values(mirroredSpoke.attributes)){
    for(let i=0;i<attribute.count;i+=3)for(let k=0;k<attribute.itemSize;k++){
      const a=(i+1)*attribute.itemSize+k,b=(i+2)*attribute.itemSize+k,t=attribute.array[a];attribute.array[a]=attribute.array[b];attribute.array[b]=t;
    }
  }
  for(let i=0;i<5;i++)for(const s of [-1,1]){
    const spoke=add(group,s>0?spokeGeometry:mirroredSpoke,rimMat,[x,radius,-.0105],[0,0,i/5*TAU+(s<0?.32:0)]);
  }
  rod(group,[x,radius,-.058],[x,radius,.058],.038,black,.038,48);
  for(const s of [-1,1])rod(group,[x,radius,s*.05],[x,radius,s*.064],.027,alloy,.027,32);
  const discZ=front?.072:.083,outer=front?.148:.120,inner=outer-.033;
  const disc=new THREE.Shape();disc.absarc(0,0,outer,0,TAU,false);
  const hole=new THREE.Path();hole.absarc(0,0,inner,0,TAU,true);disc.holes.push(hole);
  for(let i=0;i<40;i++)for(let row=0;row<2;row++){
    const a=(i+(row?.43:0))/40*TAU,r=outer-.009-row*.014;
    const hole=new THREE.Path();hole.absarc(Math.cos(a)*r,Math.sin(a)*r,.0028,0,TAU,true);disc.holes.push(hole);
  }
  add(group,new THREE.ExtrudeGeometry(disc,{depth:.0035,bevelEnabled:true,bevelThickness:.0004,bevelSize:.0004,bevelSegments:1,curveSegments:20}),machining,[x,radius,discZ]);
  // Narrow circular machining lines are subtle, dark surface relief.
  for(const r of [outer-.002,inner+.002])ring(group,r,.00028,[x,radius,discZ+.0041],alloy);
  for(let i=0;i<5;i++){
    const a=i/5*TAU;
    const shape=new THREE.Shape();shape.moveTo(.027,-.008);shape.lineTo(.049,-.011);shape.lineTo(inner+.003,.008);shape.lineTo(inner+.003,.020);shape.lineTo(.052,.010);shape.lineTo(.027,.009);shape.closePath();
    add(group,new THREE.ExtrudeGeometry(shape,{depth:.004,bevelEnabled:false}),alloy,[x,radius,discZ-.001],[0,0,a]);
    bolt(group,[x+Math.cos(a)*.047,radius+Math.sin(a)*.047,discZ+.004],silver,.0055);
  }
  const tone=new THREE.Shape();tone.absarc(0,0,.054,0,TAU,false);
  const innerTone=new THREE.Path();innerTone.absarc(0,0,.046,0,TAU,true);tone.holes.push(innerTone);
  for(let i=0;i<48;i++){
    const a=i/48*TAU;
    const slot=new THREE.Path();slot.absellipse(Math.cos(a)*.050,Math.sin(a)*.050,.0013,.0030,0,TAU,true,a);tone.holes.push(slot);
  }
  add(group,new THREE.ExtrudeGeometry(tone,{depth:.0013,bevelEnabled:false,curveSegments:6}),black,[x,radius,discZ+.008]);
  const caliperX=x+(front?.099:-.076),caliperY=radius+.075;
  box(group,[.043,.088,.046],[caliperX,caliperY,discZ+.011],alloy,.01,[0,0,front?-.40:.35]);
  box(group,[.036,.066,.009],[caliperX+.004,caliperY,discZ+.038],black,.005,[0,0,front?-.40:.35]);
  for(const yy of [-.028,.029])bolt(group,[caliperX,caliperY+yy,discZ+.045],silver,.0045);
  tube(group,[[caliperX-.01,caliperY-.037,discZ+.028],[caliperX-.029,caliperY-.030,discZ+.027],[caliperX-.021,caliperY+.055,discZ+.024]],.0016,black,16);
  const labelCanvas=document.createElement('canvas');labelCanvas.width=256;labelCanvas.height=96;
  const ctx=labelCanvas.getContext('2d');ctx.font='italic bold 44px Arial';ctx.fillStyle='#b1b1ab';ctx.textAlign='center';ctx.fillText('NISSIN',128,66);
  const tex=new THREE.CanvasTexture(labelCanvas);tex.colorSpace=THREE.SRGBColorSpace;
  add(group,new THREE.PlaneGeometry(.032,.012),new THREE.MeshStandardMaterial({map:tex,transparent:true,roughness:.7,depthWrite:false}),[caliperX+.004,caliperY,discZ+.0445],[0,0,1.13]);
  rod(group,[x,radius,-.106],[x,radius,.108],.0115,silver);
  for(const s of [-1,1]){
    ring(group,.016,.004,[x,radius,s*.105],alloy);
    const nut=rod(group,[x,radius,s*.108],[x,radius,s*.116],.0135,silver,.0135,6);
    rod(group,[x,radius,s*.117],[x,radius,s*.118],.0055,dark,.0055,6);
  }
  return group;
}
