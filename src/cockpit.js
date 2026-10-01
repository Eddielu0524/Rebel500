import * as THREE from 'three';

export function buildCockpit(parent,h,m){
  const {add,rod,tube,box,ring,bolt}=h;
  const {black,dark,silver,alloy,rubber,amber,glass}=m;
  const chrome=new THREE.MeshStandardMaterial({color:'#c7cdd0',metalness:1,roughness:.18});
  const clear=new THREE.MeshPhysicalMaterial({color:'#e7ecee',metalness:0,roughness:.08,transparent:true,opacity:.19,clearcoat:1,depthWrite:false});
  const satin=new THREE.MeshStandardMaterial({color:'#101214',metalness:.3,roughness:.38});
  const recess=new THREE.MeshStandardMaterial({color:'#030506',metalness:.18,roughness:.26});
  const cockpit=new THREE.Group();cockpit.name='fork_and_controls_2025';parent.add(cockpit);
  for(const s of [-1,1]){
    const z=s*.108;
    rod(cockpit,[-.745,.3202,z],[-.596,.595,z],.026,black,.028,40);
    rod(cockpit,[-.603,.582,z],[-.409,.948,z],.0205,chrome,.0205,48);
    rod(cockpit,[-.431,.907,z],[-.408,.95,z],.027,satin,.027,32);
    rod(cockpit,[-.606,.577,z],[-.590,.607,z],.030,satin,.028,40);
    box(cockpit,[.045,.053,.043],[-.745,.331,z],black,.008,[0,0,-.49]);
    const side=z+s*.028;
    bolt(cockpit,[-.745,.32,side],silver,.013);
    rod(cockpit,[-.622,.497,side],[-.622,.497,side+s*.007],.027,black,.027,48);
    rod(cockpit,[-.622,.497,side+s*.007],[-.622,.497,side+s*.008],.023,amber,.023,48);
    // Fine radial and concentric prism detail gives amber reflectors depth.
    for(let i=0;i<14;i++){const a=i/14*Math.PI*2;tube(cockpit,[[-.622+Math.cos(a)*.003,.497+Math.sin(a)*.003,side+s*.009],[-.622+Math.cos(a)*.022,.497+Math.sin(a)*.022,side+s*.009]],.00045,amber,2);}
    for(const r of [.009,.015,.021])ring(cockpit,r,.0005,[-.622,.497,side+s*.009],amber);
    tube(cockpit,[[-.65,.41,side],[-.614,.495,side+s*.014],[-.58,.651,side],[-.461,.938,z]],.003,rubber,42);
    for(const y of [.434,.529])bolt(cockpit,[-.745+(y-.32)*.54,y,side+.005],silver,.004);
  }
  for(const y of [.814,.938]){const x=-.745+(y-.3202)*.532;box(cockpit,[.063,.028,.291],[x,y,0],black,.008,[0,0,-.49]);for(const s of [-1,1])bolt(cockpit,[x,y+.01,s*.101],silver,.007,'y');}
  for(const z of [-.071,.071]){rod(cockpit,[-.416,.948,z],[-.39,1.011,z],.014,black);box(cockpit,[.046,.022,.042],[-.391,1.014,z],black,.005);for(const dx of [-.013,.013])bolt(cockpit,[-.391+dx,1.027,z],silver,.004,'y');}
  tube(cockpit,[[-.242,1.038,-.392],[-.298,1.030,-.273],[-.397,1.027,-.171],[-.402,1.027,.171],[-.298,1.030,.273],[-.242,1.038,.392]],.0125,black,90);
  const red=new THREE.MeshStandardMaterial({color:'#a01512',roughness:.52});
  for(const s of [-1,1]){
    rod(cockpit,[-.29,1.032,s*.289],[-.238,1.039,s*.403],.0175,rubber,.0175,40);
    for(let i=0;i<22;i++){
      const t=i/21,a=new THREE.Vector3(-.29+t*.052,1.032+t*.007,s*(.291+t*.111));
      const r=ring(cockpit,.0175,.00065,a.toArray(),dark);
      r.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),new THREE.Vector3(.052,.007,s*.114).normalize());
    }
    rod(cockpit,[-.239,1.039,s*.401],[-.233,1.040,s*.414],.0185,black);
    box(cockpit,[.039,.046,.041],[-.3,1.032,s*.27],satin,.007);
    box(cockpit,[.016,.008,.014],[-.303,1.058,s*.27],s>0?red:alloy,.003);
    box(cockpit,[.026,.029,.052],[-.332,1.039,s*.214],black,.004);
    tube(cockpit,[[-.333,1.027,s*.252],[-.363,1.026,s*.302],[-.338,1.029,s*.386]],.0045,black,28);
    add(cockpit,new THREE.SphereGeometry(.007,12,8),black,[-.338,1.029,s*.386]);
    tube(cockpit,[[-.332,1.06,s*.228],[-.345,1.133,s*.237],[-.346,1.176,s*.315]],.005,black,24);
    rod(cockpit,[-.343,1.168,s*.315],[-.330,1.168,s*.315],.046,black,.046,64);
    add(cockpit,new THREE.SphereGeometry(1,36,20),satin,[-.348,1.168,s*.315]).scale.set(.012,.046,.046);
    rod(cockpit,[-.329,1.168,s*.315],[-.327,1.168,s*.315],.0405,new THREE.MeshStandardMaterial({color:'#8b9caa',roughness:.08,metalness:1}),.0405,64);
    for(let i=0;i<2;i++)tube(cockpit,[[-.314,1.045,s*(.23+i*.016)],[-.386,1.066,s*.20],[-.449,1.017,s*.06],[-.413,.883,s*(.042+i*.013)]],.0030,rubber,48);
  }
  // Slightly offset instrument, recessed LCD bezel and soft glass reflection.
  const gauge=new THREE.Group();cockpit.add(gauge);gauge.position.set(-.367,1.01,-.014);gauge.rotation.z=.34;
  rod(gauge,[0,0,0],[0,.023,0],.048,satin,.048,64);rod(gauge,[0,.023,0],[0,.026,0],.043,alloy,.043,64);
  const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const c=canvas.getContext('2d');c.fillStyle='#626b60';c.fillRect(0,0,512,512);c.fillStyle='#19221c';c.textAlign='center';c.font='bold 204px monospace';c.fillText('0',266,320);c.font='30px monospace';c.fillText('N  •  12:45',256,105);c.font='26px monospace';c.fillText('km/h',256,380);c.fillText('E ▮▮▮▮▮▮ F',256,432);c.font='17px sans-serif';c.fillText('HONDA',256,470);
  const tx=new THREE.CanvasTexture(canvas);tx.colorSpace=THREE.SRGBColorSpace;
  add(gauge,new THREE.CircleGeometry(.0395,64),new THREE.MeshStandardMaterial({map:tx,roughness:.30,metalness:.10}),[0,.0261,0],[-Math.PI/2,0,-Math.PI/2]);

  const lamp=new THREE.Group();lamp.name='four_projector_LED_headlight';lamp.position.set(-.527,.895,0);cockpit.add(lamp);
  add(lamp,new THREE.SphereGeometry(1,48,32),satin,[.029,0,0]).scale.set(.061,.084,.084);
  rod(lamp,[.007,0,0],[-.034,0,0],.0875,satin,.0875,80);
  rod(lamp,[-.035,0,0],[-.046,0,0],.0875,chrome,.0875,80);
  rod(lamp,[-.047,0,0],[-.049,0,0],.078,recess,.078,80);
  ring(lamp,.081,.0025,[-.048,0,0],alloy,[0,Math.PI/2,0]);
  for(const y of [-.030,.030]){
    box(lamp,[.0025,.043,.092],[-.051,y,0],chrome,.011);
    box(lamp,[.003,.038,.085],[-.053,y,0],recess,.009);
    for(const z of [-.023,.023]){
      rod(lamp,[-.054,y,z],[-.056,y,z],.0175,chrome,.0175,48);
      const lens=add(lamp,new THREE.SphereGeometry(.016,32,20),glass,[-.058,y,z]);lens.scale.x=.29;
      ring(lamp,.0165,.0012,[-.058,y,z],chrome,[0,Math.PI/2,0]);
    }
  }
  for(const angle of [0,Math.PI/2,Math.PI,Math.PI*1.5])bolt(lamp,[-.052,Math.cos(angle)*.069,Math.sin(angle)*.069],alloy,.003,'x');
  const outerLens=add(lamp,new THREE.SphereGeometry(1,64,40),clear,[-.052,0,0]);outerLens.scale.set(.009,.081,.081);outerLens.castShadow=false;
  for(const s of [-1,1]){
    rod(cockpit,[-.473,.899,s*.093],[-.490,.91,s*.166],.012,satin);
    rod(cockpit,[-.482,.91,s*.171],[-.529,.91,s*.171],.021,satin,.024,48);
    rod(cockpit,[-.53,.91,s*.171],[-.533,.91,s*.171],.0195,chrome,.0195,48);
    rod(cockpit,[-.534,.91,s*.171],[-.535,.91,s*.171],.017,new THREE.MeshStandardMaterial({color:'#989993',metalness:.5,roughness:.28}),.017,48);
    for(const r of [.004,.007,.010,.013,.016])ring(cockpit,r,.0005,[-.536,.91,s*.171],chrome,[0,Math.PI/2,0]);
  }
  return cockpit;
}
