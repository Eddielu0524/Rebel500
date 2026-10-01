import * as THREE from 'three';

// Asymmetric upper and lower sections recreate the characteristic Rebel tank.
function shell(sections, material, add, parent, N=100, M=64, squareness=.91) {
  const data=new THREE.CatmullRomCurve3(sections.map(s=>new THREE.Vector3(s[0],s[1],s[2])));
  const widths=new THREE.SplineCurve(sections.map((s,i)=>new THREE.Vector2(i,s[3])));
  const vertices=[],uv=[],indices=[];
  const sample=(t,a)=>{
    const p=data.getPoint(t),w=Math.max(.0001,widths.getPoint(t).y),s=Math.sin(a),c=Math.cos(a);
    const mid=(p.y+p.z)/2,hh=(p.z-p.y)/2;
    const lowTaper=s<0?1-.35*s*s:1;
    const z=Math.sign(c)*Math.pow(Math.abs(c),squareness)*w*lowTaper;
    return new THREE.Vector3(p.x,mid+s*hh,z);
  };
  for(let i=0;i<=N;i++)for(let j=0;j<=M;j++){
    const p=sample(i/N,j/M*Math.PI*2);vertices.push(...p);uv.push(i/N,j/M);
    if(i<N&&j<M){const n=i*(M+1)+j;indices.push(n,n+M+1,n+1,n+1,n+M+1,n+M+2);}
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();
  return {mesh:add(parent,geometry,material),sample};
}

// Crowned steel with an actual thin underside and closed cut edges.
function rearMudguard(parent,add,material,from,to) {
  const positions=[],uvs=[],indices=[],N=96,M=32,thickness=.0032;
  const row=M+1,layer=(N+1)*row;
  for(let side=0;side<2;side++)for(let i=0;i<=N;i++)for(let j=0;j<=M;j++) {
    const a=from+(to-from)*i/N,v=j/M*2-1;
    const crown=.023*Math.pow(Math.max(0,1-v*v),.6);
    const radius=.382+crown-side*thickness;
    positions.push(.745+Math.cos(a)*radius,.3232+Math.sin(a)*radius,v*.1075);
    uvs.push(i/N,j/M);
    if(i<N&&j<M) {
      const n=side*layer+i*row+j;
      if(side===0)indices.push(n,n+row,n+1,n+1,n+row,n+row+1);
      else indices.push(n,n+1,n+row,n+1,n+row+1,n+row);
    }
  }
  // Side hems follow the sheet instead of making a heavy, solid fender.
  for(let i=0;i<N;i++)for(const j of [0,M]) {
    const a=i*row+j,b=(i+1)*row+j;
    if(j===0)indices.push(a,a+layer,b,b,a+layer,b+layer);
    else indices.push(a,b,a+layer,b,b+layer,a+layer);
  }
  for(const i of [0,N])for(let j=0;j<M;j++) {
    const a=i*row+j,b=a+1;
    if(i===0)indices.push(a,b,a+layer,b,b+layer,a+layer);
    else indices.push(a,a+layer,b,b,a+layer,b+layer);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  geometry.setIndex(indices);geometry.computeVertexNormals();
  const mesh=add(parent,geometry,material);mesh.name='crowned_steel_rear_fender';
  return mesh;
}

export function buildBodywork(parent,h,m){
  const {add,rod,ring,tube,box,bolt,fender,loft}=h;
  const {paint,black,dark,silver,alloy,seatMat}=m;
  const tankShape=shell([
    [-.373,.844,.870,.003],[-.348,.821,.931,.064],[-.298,.794,.974,.107],
    [-.222,.768,.987,.143],[-.132,.742,.965,.160],[-.031,.710,.897,.152],
    [.065,.680,.810,.116],[.137,.667,.731,.065],[.175,.667,.688,.020],[.181,.670,.672,.002],
  ],paint,add,parent);
  tankShape.mesh.name='sculpted_2025_fuel_tank';
  // Rolled, lower tank flange follows its sloping belly.
  for(const sign of [-1,1]){
    const edge=[];for(let i=4;i<=96;i++)edge.push(tankShape.sample(i/100,sign>0?-.58:Math.PI+.58).toArray());
    tube(parent,edge,.0031,paint,100);
  }
  const cap=rod(parent,[-.227,.986,0],[-.227,.992,0],.030,silver,.030,64);
  rod(parent,[-.227,.992,0],[-.227,.994,0],.025,alloy,.025,64);
  box(parent,[.021,.002,.009],[-.227,.995,0],black,.002);
  for(let i=0;i<6;i++){const a=i*Math.PI/3;bolt(parent,[-.227+Math.cos(a)*.024,.994,Math.sin(a)*.024],silver,.002,'y');}

  // Decal lies directly on the curved tank UV surface, no floating flat plaque.
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=512;
  const c=canvas.getContext('2d');c.fillStyle='#a0a19b';
  const wings=[[[230,68],[747,186],[702,211],[255,116]],[[266,131],[690,221],[647,248],[292,177]],[[300,191],[636,260],[592,287],[330,236]],[[341,250],[580,301],[529,330],[387,290]],[[418,301],[565,323],[529,351],[437,350]]];
  for(const points of wings){c.beginPath();points.forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p));c.closePath();c.fill();}
  c.font='bold 125px Georgia';c.textAlign='center';c.fillText('HONDA',510,455);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const decalMat=new THREE.MeshStandardMaterial({map:texture,transparent:true,alphaTest:.035,roughness:.49,metalness:.12,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-1});
  decalMat.name='soft_grey_Honda_tank_graphic';
  // Invert the surface coordinates to keep the lettering horizontal in profile.
  const decalPoint=(x,y,sign)=>{
    let lo=0,hi=1;
    for(let i=0;i<20;i++) {const mid=(lo+hi)/2;if(tankShape.sample(mid,0).x<x)lo=mid;else hi=mid;}
    const t=(lo+hi)/2,bottom=tankShape.sample(t,-Math.PI/2).y,top=tankShape.sample(t,Math.PI/2).y;
    const sine=THREE.MathUtils.clamp((y-(bottom+top)/2)/((top-bottom)/2),-.96,.96);
    const angle=Math.asin(sine),p=tankShape.sample(t,sign>0?angle:Math.PI-angle);
    p.z+=sign*.0018;
    return p;
  };
  for(const sign of [-1,1]){
    const positions=[],uvs=[],indices=[],nx=24,ny=16;
    // Correct UV handedness and outward triangle normals on both tank sides.
    for(let y=0;y<=ny;y++)for(let x=0;x<=nx;x++){
      const p=decalPoint(-.252+x/nx*.146,.858+y/ny*.073,sign);
      positions.push(...p);uvs.push(sign>0?x/nx:1-x/nx,y/ny);
      if(y<ny&&x<nx){const i=y*(nx+1)+x;if(sign>0)indices.push(i,i+1,i+nx+1,i+1,i+nx+2,i+nx+1);else indices.push(i,i+nx+1,i+1,i+1,i+nx+1,i+nx+2);}
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setIndex(indices);g.computeVertexNormals();
    const decal=add(parent,g,decalMat);decal.castShadow=false;decal.name='Honda_tank_emblem';
  }
  // Low dished rider saddle; its padded tail rises gently to 760 mm.
  const saddleShape=shell([
    [.181,.650,.666,.004],[.210,.625,.692,.073],[.280,.614,.685,.129],
    [.370,.620,.694,.158],[.452,.647,.719,.161],[.502,.676,.748,.139],
    [.533,.686,.754,.112],[.552,.699,.746,.077],[.567,.711,.731,.026],[.569,.720,.721,.001],
  ],seatMat,add,parent,90,56,.70);
  const seat=saddleShape.mesh;seat.name='stock_seat';
  for(const s of [-1,1]) {
    const seam=[];
    for(let i=5;i<=88;i++) {const p=saddleShape.sample(i/90,s>0?-.23:Math.PI+.23);p.z+=s*.0009;seam.push(p.toArray());}
    tube(parent,seam,.00135,black,84);
  }
  fender(parent,-.745,.3202,.328,.150,.38,2.13,paint);
  // Continuous crown terminates level with the tail lamp, above the tyre.
  const rearFrom=.79,rearTo=2.27;
  rearMudguard(parent,add,paint,rearFrom,rearTo);
  for(const s of [-1,1]){
    const edge=[];for(let i=0;i<=64;i++){const a=rearFrom+i/64*(rearTo-rearFrom);edge.push([.745+Math.cos(a)*.382,.3232+Math.sin(a)*.382,s*.1075]);}tube(parent,edge,.00165,paint,64);
    const shape=new THREE.Shape();
    shape.absarc(.745,.3232,.379,rearFrom,rearTo,false);shape.absarc(.745,.3232,.329,rearTo,rearFrom,true);shape.closePath();
    add(parent,new THREE.ExtrudeGeometry(shape,{depth:.006,bevelEnabled:true,bevelThickness:.0015,bevelSize:.0015,bevelSegments:2,curveSegments:64}),black,[0,0,s*.109-.003]);
    for(const a of [.90,1.45,2.05])bolt(parent,[.745+Math.cos(a)*.354,.3232+Math.sin(a)*.354,s*.118],alloy,.0060);
  }
  // Pressed gussets below the tank are conspicuous in the official 3/4 image.
  for(const sign of [-1,1]){
    const shape=new THREE.Shape();shape.moveTo(-.392,.844);shape.lineTo(-.025,.711);shape.lineTo(-.328,.717);shape.quadraticCurveTo(-.346,.77,-.392,.844);
    add(parent,new THREE.ExtrudeGeometry(shape,{depth:.010,bevelEnabled:true,bevelSize:.003,bevelThickness:.002,bevelSegments:2}),black,[0,0,sign*.093]);
    tube(parent,[[-.343,.805,sign*.107],[-.133,.729,sign*.107],[-.309,.736,sign*.107],[-.343,.805,sign*.107]],.003,dark,24);
    tube(parent,[[-.377,.829,sign*.107],[-.348,.774,sign*.107],[-.307,.805,sign*.107]],.0025,dark,20);
  }
  return {stockSeat:seat};
}
