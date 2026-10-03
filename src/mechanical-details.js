import * as THREE from 'three';
import { createSurfaceMaterial } from './materials.js';

// Additional assemblies shaped against Honda's radiator/exhaust/rear photographs.
export function buildMechanicalDetails(parent,h,m) {
  const {add,rod,tube,box,ring,bolt}=h;
  const {black,rubber,dark,silver,alloy,amber}=m;
  const charcoal=createSurfaceMaterial('powder',{color:'#282a2c',roughness:.58,name:'cooling_matrix_and_brackets'});
  const exhaustPaint=createSurfaceMaterial('exhaust',{name:'heat_resistant_satin_exhaust_coating'});
  const brushed=createSurfaceMaterial('brushed',{color:'#b7bec0',roughness:.30,name:'brushed_silencer_end_cap'});
  const radiator=new THREE.Group();radiator.name='radiator_and_cooling_lines';
  radiator.position.set(-.377,.553,0);radiator.rotation.z=.26;parent.add(radiator);
  box(radiator,[.038,.259,.231],[0,0,0],dark,.009);
  // Fine black cooling matrix behind the outer guard and pressed side tanks.
  for(let i=0;i<53;i++)rod(radiator,[-.023,-.118+i*.0045,-.103],[-.023,-.118+i*.0045,.103],.0009,charcoal,.0009,4);
  for(let i=0;i<24;i++)rod(radiator,[-.024,-.120,-.102+i*.0089],[-.024,.120,-.102+i*.0089],.00055,charcoal,.00055,4);
  for(const s of [-1,1]){
    box(radiator,[.049,.279,.026],[0,0,s*.122],black,.008);
    for(const y of [-.084,.095])bolt(radiator,[-.002,y,s*.138],silver,.005);
    rod(radiator,[-.022,-.126,s*.109],[-.022,.126,s*.109],.005,black);
    tube(parent,[[-.412,.67,s*.106],[-.36,.712,s*.138],[-.28,.662,s*.152]],.009,rubber,28);
  }
  rod(radiator,[-.017,.126,-.109],[-.017,.126,.109],.005,black);
  rod(radiator,[-.017,-.126,-.109],[-.017,-.126,.109],.005,black);
  tube(parent,[[-.321,.416,-.123],[-.27,.389,-.160],[-.186,.355,-.16]],.011,rubber,30);

  const exhaust=new THREE.Group();exhaust.name='two_into_one_satin_black_exhaust';parent.add(exhaust);
  for(const z of [-.057,.057]){
    tube(exhaust,[[-.27,.617,z],[-.337,.562,z],[-.349,.375,z],[-.268,.17,z],[.09,.156,z+.055],[.241,.198,.188]],.0185,exhaustPaint,80);
    rod(exhaust,[-.268,.617,z],[-.277,.595,z],.023,black,.023,32);
  }
  const silencer=new THREE.Group();exhaust.add(silencer);silencer.position.set(.226,.201,.188);
  silencer.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(1,.143,.015).normalize());
  const profile=[[.020,0],[.024,.028],[.041,.094],[.061,.165],[.065,.182],[.068,.196],[.069,.208],[.069,.618],[.0685,.632],[.067,.646]];
  const points=profile.map(p=>new THREE.Vector2(...p));
  add(silencer,new THREE.LatheGeometry(points,96),exhaustPaint);
  for(const y of [.188,.204])ring(silencer,.069,.0014,[0,y,0],charcoal,[Math.PI/2,0,0]);
  const capPoints=[[.067,.640],[.069,.649],[.065,.670],[.057,.693],[.039,.707],[.029,.707],[.027,.694]].map(p=>new THREE.Vector2(...p));
  add(silencer,new THREE.LatheGeometry(capPoints,96),brushed);
  ring(silencer,.029,.002,[0,.707,0],alloy,[Math.PI/2,0,0]);
  rod(silencer,[0,.678,0],[0,.708,0],.025,dark,.025,64);
  rod(silencer,[0,.707,0],[0,.708,0],.020,new THREE.MeshStandardMaterial({color:'#010203',roughness:1}),.020,64);
  // Welded hanger and the silver fastener sit above the canister.
  box(exhaust,[.113,.032,.060],[.798,.341,.179],black,.009,[0,0,.143]);
  bolt(exhaust,[.801,.356,.222],silver,.009);
  tube(exhaust,[[.79,.379,.153],[.791,.366,.213],[.799,.319,.241]],.008,black,16);
  // Under-engine catalyst shield with stamped longitudinal ribs.
  box(exhaust,[.268,.055,.124],[.061,.163,.043],black,.021);
  for(const z of [-.002,.029,.06,.09])tube(exhaust,[[-.049,.138,z],[.04,.137,z],[.165,.146,z]],.0014,charcoal,12);

  const tail=new THREE.Group();tail.name='LED_tail_and_clear_indicators';parent.add(tail);
  box(tail,[.075,.048,.136],[1.029,.613,0],black,.017,[0,0,.34]);
  const tailGlass=new THREE.MeshPhysicalMaterial({color:'#830918',roughness:.22,metalness:.15,clearcoat:1,emissive:'#650512',emissiveIntensity:.18});
  box(tail,[.010,.032,.115],[1.068,.604,0],tailGlass,.012,[0,0,.2]);
  const facet=new THREE.MeshStandardMaterial({color:'#b81325',roughness:.26,metalness:.3});
  for(let i=0;i<15;i++)for(let j=0;j<3;j++)box(tail,[.0015,.004,.005],[1.074,.596+j*.005,-.046+i*.0065],facet,.001);
  for(const z of [-.046,.046])bolt(tail,[1.032,.639,z],alloy,.0028,'y');
  for(const s of [-1,1]){
    rod(tail,[1.035,.569,s*.066],[1.051,.560,s*.166],.010,black);
    rod(tail,[1.036,.56,s*.17],[1.076,.56,s*.17],.023,black,.023,48);
    rod(tail,[1.077,.56,s*.17],[1.08,.56,s*.17],.019,brushed,.019,48);
    rod(tail,[1.081,.56,s*.17],[1.082,.56,s*.17],.0158,alloy,.0158,48);
    for(const r of [.005,.009,.013,.016])ring(tail,r,.0006,[1.083,.56,s*.17],silver,[0,Math.PI/2,0]);
  }
  box(tail,[.028,.185,.04],[1.102,.505,0],black,.006,[0,0,.30]);
  box(tail,[.008,.106,.174],[1.14,.446,0],black,.004,[0,0,.30]);
  const plateMaterial=new THREE.MeshStandardMaterial({color:'#eeeae0',metalness:.05,roughness:.52});
  box(tail,[.005,.080,.145],[1.146,.449,0],plateMaterial,.003,[0,0,.30]);
  for(const z of [-.06,.06])bolt(tail,[1.14,.482,z],silver,.0027,'x');
  box(tail,[.014,.022,.057],[1.117,.506,0],black,.004);
  // Folded side stand, shift linkage and serrated foot-control brackets.
  tube(parent,[[.087,.235,-.142],[.13,.17,-.17],[.366,.149,-.191]],.011,black,30);
  box(parent,[.048,.009,.032],[.36,.148,-.19],black,.004);
  for(const s of [-1,1]){
    const shape=new THREE.Shape();shape.moveTo(.03,.32);shape.lineTo(.145,.32);shape.lineTo(.171,.27);shape.lineTo(-.07,.223);shape.lineTo(-.09,.241);shape.closePath();
    add(parent,new THREE.ExtrudeGeometry(shape,{depth:.01,bevelEnabled:true,bevelSize:.004,bevelThickness:.002,bevelSegments:2}),charcoal,[0,0,s*.16]);
    for(const x of [.04,.136])bolt(parent,[x,.306,s*.174],silver,.006);
  }
  return {tailGlass};
}
