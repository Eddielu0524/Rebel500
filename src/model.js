import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { SPEC, COLORS } from './config.js';
import { buildWheel } from './wheels.js';
import { buildBodywork } from './bodywork.js';
import { buildCockpit } from './cockpit.js';
import { buildEngine } from './engine.js';
import { buildMechanicalDetails } from './mechanical-details.js';

const V = (p) => new THREE.Vector3(...p);
const TAU = Math.PI * 2;
const UP = new THREE.Vector3(0, 1, 0);

function mat(color, metalness = .45, roughness = .35, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, metalness, roughness, ...extra });
}

function add(parent, geometry, material, position = [0, 0, 0], rotation) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  if (rotation) mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function rod(parent, a, b, radius, material, topRadius = radius, segments = 12) {
  const av = V(a), bv = V(b), delta = bv.clone().sub(av);
  const mesh = add(parent, new THREE.CylinderGeometry(topRadius, radius, delta.length(), segments), material);
  mesh.position.copy(av.add(bv).multiplyScalar(.5));
  mesh.quaternion.setFromUnitVectors(UP, delta.normalize());
  return mesh;
}

function tube(parent, points, radius, material, segments = 48) {
  return add(parent, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(V)), segments, radius, 8, false), material);
}

function box(parent, size, position, material, radius = .008, rotation) {
  return add(parent, new RoundedBoxGeometry(...size, 3, radius), material, position, rotation);
}

function ring(parent, radius, thickness, position, material, rotation = [0, 0, 0]) {
  return add(parent, new THREE.TorusGeometry(radius, thickness, 8, 64), material, position, rotation);
}

function loft(parent, sections, material, roundness = 1) {
  // Sections: x, vertical center, half width, half height. Dimensions in metres.
  const center = new THREE.CatmullRomCurve3(sections.map(s => new THREE.Vector3(s[0], s[1], 0)));
  const profile = new THREE.CatmullRomCurve3(sections.map(s => new THREE.Vector3(s[2], s[3], 0)));
  const positions = [], indices = [], uvs = [], N = 72, M = 48;
  for (let i = 0; i <= N; i++) {
    const c = center.getPoint(i / N), p = profile.getPoint(i / N);
    for (let j = 0; j <= M; j++) {
      const a = j / M * TAU, sin = Math.sin(a), cos = Math.cos(a);
      positions.push(c.x, c.y + Math.sign(sin) * Math.pow(Math.abs(sin), roundness) * Math.max(.001, p.y), Math.sign(cos) * Math.pow(Math.abs(cos), roundness) * Math.max(.001, p.x));
      uvs.push(i / N, j / M);
      if (i < N && j < M) { const n = i * (M + 1) + j; indices.push(n, n + M + 1, n + 1, n + 1, n + M + 1, n + M + 2); }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return add(parent, geometry, material);
}

function fender(parent, x, y, radius, width, from, to, material) {
  const positions = [], indices = [], N = 80, M = 18;
  for (let i = 0; i <= N; i++) {
    const a = from + (to - from) * i / N;
    for (let j = 0; j <= M; j++) {
      const v = (j / M - .5) * 2;
      const r = radius + .024 * Math.sqrt(Math.max(0, 1 - v * v));
      positions.push(x + Math.cos(a) * r, y + Math.sin(a) * r, v * width / 2);
      if (i < N && j < M) { const n = i * (M + 1) + j; indices.push(n, n + 1, n + M + 1, n + 1, n + M + 2, n + M + 1); }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex(indices); g.computeVertexNormals();
  const mesh = add(parent, g, material); mesh.material.side = THREE.DoubleSide;
  return mesh;
}

function bolt(parent, at, material, radius = .007, axis = 'z') {
  const end = [...at]; end[axis === 'z' ? 2 : axis === 'x' ? 0 : 1] += .005;
  rod(parent, at, end, radius, material, radius, 6);
}

function leatherTexture(quilt = false) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d'); ctx.fillStyle = '#969696'; ctx.fillRect(0, 0, 512, 512);
  let seed = 123;
  for (let i = 0; i < 30000; i++) {
    seed = (seed * 16807) % 2147483647; const x = seed % 512;
    seed = (seed * 16807) % 2147483647; const y = seed % 512;
    ctx.fillStyle = i % 2 ? '#777777' : '#aaaaaa'; ctx.fillRect(x, y, 1, 1);
  }
  if (quilt) {
    ctx.strokeStyle = '#424242'; ctx.lineWidth = 5;
    for (let i = -512; i < 1024; i += 85) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + 512, 512); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i - 512, 512); ctx.stroke();
    }
  }
  const texture = new THREE.CanvasTexture(canvas); texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

export function createMotorcycle() {
  const root = new THREE.Group(); root.name = 'Rebel_500_reference_reconstruction_metres';
  root.userData = { units: 'metres', source: 'Honda Taiwan 2025 Rebel 500', accuracy: 'Reference reconstruction. Not OEM CAD. Unmeasured surfaces and accessories are approximate.', wheelbase: SPEC.wheelbase };
  const base = new THREE.Group(); base.name = 'stock_motorcycle'; root.add(base);
  const paint = new THREE.MeshPhysicalMaterial({ color: COLORS[0].hex, metalness: .14, roughness: .24, clearcoat: 1, clearcoatRoughness: .19 });
  const black = mat('#101214', .38, .36), rubber = mat('#181b1d', .02, .94), groove = mat('#080a0b', .02, .99);
  const silver = mat('#c0c5c7', .74, .31), alloy = mat('#34383b', .70, .43), dark = mat('#090e10', .6, .34);
  const seatMat = mat('#1c1d1b', .0, .88, { bumpMap: leatherTexture(), bumpScale: .0006 });
  const quiltTexture = leatherTexture(true); quiltTexture.colorSpace = THREE.SRGBColorSpace;
  const brown = mat('#8a5942', .0, .86, { map: quiltTexture, bumpMap: quiltTexture, bumpScale: .002 });
  const red = mat('#5e0710', .05, .25, { emissive: '#8c0a10', emissiveIntensity: .45 });
  const amber = mat('#dd780b', .15, .25, { emissive: '#ff8800', emissiveIntensity: .2 });
  const glass = mat('#9fa9ae', .6, .12, { emissive: '#dbe7f3', emissiveIntensity: .025 });
  const parts = {};
  const partGroup = (id) => { const g = new THREE.Group(); g.name = 'accessory_' + id; g.visible = false; root.add(g); parts[id] = g; return g; };

  const helpers = { add, rod, tube, box, ring, bolt, loft, fender };
  const materials = { paint, black, rubber, silver, alloy, dark, seatMat, amber, glass };
  buildWheel(base,-SPEC.wheelbase/2,SPEC.frontRadius,.130,true,helpers,materials);
  buildWheel(base,SPEC.wheelbase/2,SPEC.rearRadius,.150,false,helpers,materials);

  // Diamond frame and tubular rear subframe.
  for(const z of [-.105,.105]) {
    tube(base,[[-.421,.871,z],[-.25,.776,z],[.18,.640,z],[.49,.61,z]],.019,black);
    tube(base,[[-.421,.857,z],[-.39,.62,z],[-.25,.227,z],[-.11,.161,z],[.28,.20,z],[.32,.39,z],[.13,.639,z]],.0165,black);
    tube(base,[[.13,.639,z],[.33,.465,z],[.62,.703,z]],.0175,black);
    rod(base,[-.38,.715,z],[.05,.688,z],.012,black);
    rod(base,[.17,.315,z],[.75,.323,z*1.21],.019,black);
    rod(base,[.13,.358,z],[.72,.353,z*1.21],.014,black);
    bolt(base,[.235,.33,z*1.12],silver,.011);
  }
  rod(base,[.74,.323,-.15],[.74,.323,.15],.020,alloy);
  rod(base,[.20,.31,-.14],[.20,.31,.14],.024,black);
  // Side covers, shaped triangular panels.
  for(const s of [-1,1]) {
    const shape = new THREE.Shape(); shape.moveTo(.135,.62); shape.lineTo(.47,.615); shape.quadraticCurveTo(.42,.54,.32,.47); shape.quadraticCurveTo(.30,.455,.275,.48); shape.lineTo(.135,.62);
    const panel = add(base,new THREE.ExtrudeGeometry(shape,{depth:.015,bevelEnabled:true,bevelSize:.008,bevelThickness:.005,bevelSegments:3,steps:1}),black,[0,0,s*.11]);
    bolt(base,[.35,.60,s*.13],alloy,.005);
  }
  const {stockSeat} = buildBodywork(base,helpers,materials);
  const brownSeat=partGroup('brownSeat');const customSeat=stockSeat.clone();customSeat.name='quilted_brown_seat';customSeat.material=brown;brownSeat.add(customSeat);

  buildEngine(base,helpers,materials);

  const {tailGlass}=buildMechanicalDetails(base,helpers,materials);

  // Left chain drive, sprocket and individual chain rollers.
  const sprocket=new THREE.Shape();sprocket.absarc(0,0,.102,0,TAU,false);
  const sprocketAxle=new THREE.Path();sprocketAxle.absarc(0,0,.025,0,TAU,true);sprocket.holes.push(sprocketAxle);
  for(let i=0;i<5;i++){const a=i/5*TAU;const opening=new THREE.Path();opening.absellipse(Math.cos(a)*.063,Math.sin(a)*.063,.023,.015,0,TAU,true,a);sprocket.holes.push(opening);bolt(base,[.745+Math.cos(a)*.038,.323+Math.sin(a)*.038,-.128],silver,.006);}
  add(base,new THREE.ExtrudeGeometry(sprocket,{depth:.005,bevelEnabled:false,curveSegments:32}),alloy,[.745,.323,-.125]);
  ring(base,.098,.007,[.745,.323,-.126],silver);
  rod(base,[.17,.31,-.142],[.17,.31,-.151],.041,black,.041,32);
  for(let i=0;i<40;i++){ const a=i/40*TAU;box(base,[.01,.013,.008],[.745+Math.cos(a)*.105,.323+Math.sin(a)*.105,-.125],alloy,.001,[0,0,a]); }
  for(const direction of [-1,1]){
    const path=[[.17,.31+direction*.041,-.145],[.40,.315+direction*.064,-.145],[.75,.323+direction*.10,-.13]];
    tube(base,path,.006,alloy);
    for(let i=0;i<36;i++){const t=i/35;bolt(base,[.17+t*.58,.31+t*.013+direction*(.041+t*.059),-.15+t*.015],silver,.003);}
  }
  box(base,[.49,.029,.04],[.54,.44,-.13],black,.006,[0,0,.04]);

  // Twin rear shocks with continuous helical springs.
  for(const s of [-1,1]) {
    const lower=V([.68,.365,s*.126]),upper=V([.47,.650,s*.135]);
    rod(base,lower.toArray(),upper.toArray(),.015,alloy);
    const axis=upper.clone().sub(lower), normal=new THREE.Vector3(axis.y,-axis.x,0).normalize(),binormal=new THREE.Vector3(0,0,1), helix=[];
    for(let i=0;i<=220;i++){const t=i/220;const p=lower.clone().addScaledVector(axis,t*.78+.09).addScaledVector(normal,Math.cos(t*TAU*12)*.027).addScaledVector(binormal,Math.sin(t*TAU*12)*.027);helix.push(p.toArray());}
    tube(base,helix,.005,black,220);
    rod(base,[.66,.390,s*.126],[.62,.446,s*.127],.028,black);
    for(const p of [lower,upper]){ring(base,.016,.006,p.toArray(),black);bolt(base,[p.x,p.y,s*.162],silver,.008);}
  }

  buildCockpit(base,helpers,materials);
  for(const s of [-1,1]) {
    rod(base,[-.064,.229,s*.13],[-.064,.229,s*.23],.013,black);
    rod(base,[-.064,.229,s*.20],[-.064,.229,s*.292],.020,rubber,.020,20);
    for(let i=0;i<7;i++)ring(base,.020,.0014,[-.064,.229,s*(.20+i*.013)],black);
    rod(base,[.40,.34,s*.123],[.40,.34,s*.196],.012,black);
  }
  tube(base,[[.0,.224,.13],[-.15,.217,.185],[-.162,.217,.235]],.006,alloy);
  box(base,[.028,.011,.039],[-.162,.217,.239],rubber,.003);

  // Each accessory is a separate removable mesh group.
  const cowl=partGroup('cowl');
  const cowlShape=new THREE.Shape();cowlShape.absellipse(0,0,.099,.102,0,TAU,false,0);
  const opening=new THREE.Path();opening.absarc(0,0,.078,0,TAU,true);cowlShape.holes.push(opening);
  add(cowl,new THREE.ExtrudeGeometry(cowlShape,{depth:.070,bevelEnabled:true,bevelSize:.007,bevelThickness:.008,bevelSegments:4,curveSegments:64}),black,[-.573,.828,0],[0,-Math.PI/2,0]);
  fender(cowl,-.528,.83,.102,.116,.18,2.5,black);
  const windshield=partGroup('windshield');
  const positions=[],indices=[];
  for(let y=0;y<=22;y++)for(let x=0;x<=30;x++){
    const u=x/30*2-1,v=y/22, width=.182*(1-.20*v*v), top= Math.sqrt(Math.max(0,1-u*u))*.047*v;
    positions.push(-.554+.17*v+.045*u*u,.872+v*.235+top,u*width);
    if(y<22&&x<30){const i=y*31+x;indices.push(i,i+1,i+31,i+1,i+32,i+31);}
  }
  const wg=new THREE.BufferGeometry();wg.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));wg.setIndex(indices);wg.computeVertexNormals();
  add(windshield,wg,new THREE.MeshPhysicalMaterial({color:'#353c3b',metalness:0,roughness:.11,transparent:true,opacity:.32,side:THREE.DoubleSide,depthWrite:false,clearcoat:.65,clearcoatRoughness:.10}));
  for(const s of [-1,1]){rod(windshield,[-.448,.85,s*.098],[-.47,.998,s*.12],.006,black);bolt(windshield,[-.470,.988,s*.122],silver,.005,'x');}
  const gaiters=partGroup('gaiters');
  for(const s of [-1,1])for(let i=0;i<14;i++){
    const t=i/13;const a=[-.593+t*.089,.61+t*.166,s*.098],b=[a[0]+.004,a[1]+.008,a[2]];
    rod(gaiters,a,b,.029+(i%2)*.0015,rubber,.030,28);
  }
  const pillion=partGroup('pillion');
  box(pillion,[.25,.065,.202],[.755,.775,0],seatMat,.027,[0,0,-.06]);
  const strap=box(pillion,[.022,.071,.206],[.786,.777,0],dark,.020,[0,0,-.06]);
  const backrest=partGroup('backrest');
  for(const s of [-1,1])tube(backrest,[[.68,.63,s*.117],[.915,.72,s*.115],[.926,1.03,s*.078]],.011,black);
  box(backrest,[.062,.142,.208],[.913,1.009,0],seatMat,.031,[0,0,.06]);
  const rack=partGroup('rack');
  tube(rack,[[.863,.737,-.134],[1.10,.733,-.134],[1.116,.731,0],[1.10,.733,.134],[.863,.737,.134]],.009,black);
  for(let i=0;i<5;i++)rod(rack,[.875+i*.045,.733,-.13],[.875+i*.045,.733,.13],.006,black);
  for(const s of [-1,1]){rod(rack,[.92,.733,s*.13],[.92,.596,s*.104],.008,black);rod(rack,[.88,.733,s*.13],[.61,.628,s*.12],.007,black);}
  const saddlebags=partGroup('saddlebags');
  const bagLeather=mat('#25231e',0,.86,{bumpMap:leatherTexture(),bumpScale:.0008});
  for(const s of [-1,1]){
    tube(saddlebags,[[.49,.60,s*.13],[.52,.58,s*.211],[.51,.34,s*.211],[.83,.34,s*.211],[.88,.59,s*.211],[.84,.64,s*.11]],.007,black);
    box(saddlebags,[.340,.270,.137],[.714,.493,s*.269],bagLeather,.035,[0,0,-.06]);
    box(saddlebags,[.352,.081,.144],[.708,.603,s*.269],bagLeather,.018,[0,0,-.06]);
    tube(saddlebags,[[.57,.594,s*.342],[.567,.389,s*.342],[.851,.373,s*.342],[.86,.578,s*.342]],.0014,alloy);
    for(const x of [.613,.81]){
      box(saddlebags,[.023,.214,.008],[x,.509,s*.342],dark,.003);
      box(saddlebags,[.034,.039,.01],[x,.508,s*.351],silver,.004);
      box(saddlebags,[.023,.027,.012],[x,.508,s*.357],dark,.003);
      for(let y=0;y<4;y++)bolt(saddlebags,[x,.447+y*.01,s*.35],alloy,.0015);
    }
  }
  for(const id of ['cowl','windshield'])for(const mesh of parts[id].children)mesh.position.y+=.071;
  // Merge static geometry by material. Independent accessories remain removable.
  // This keeps the detailed model responsive on integrated graphics.
  function batch(group, skip) {
    group.updateMatrixWorld(true);
    const buckets=new Map(), remove=[];
    group.traverse(object=>{
      if(!object.isMesh || object===skip)return;
      let geometry=object.geometry.clone(); geometry.applyMatrix4(object.matrixWorld);
      if(geometry.index){const expanded=geometry.toNonIndexed();geometry.dispose();geometry=expanded;}
      if(!geometry.getAttribute('uv'))geometry.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(geometry.getAttribute('position').count*2),2));
      const key=`${object.material.uuid}:${object.castShadow}:${object.receiveShadow}`;
      if(!buckets.has(key))buckets.set(key,{material:object.material,geometries:[],castShadow:object.castShadow,receiveShadow:object.receiveShadow});
      buckets.get(key).geometries.push(geometry);remove.push(object);
    });
    for(const object of remove)object.removeFromParent();
    for(const {material,geometries,castShadow,receiveShadow}of buckets.values()){const geometry=mergeGeometries(geometries);if(geometry){const indexed=mergeVertices(geometry,1e-5);const mesh=add(group,indexed,material);mesh.castShadow=castShadow;mesh.receiveShadow=receiveShadow;geometry.dispose();}geometries.forEach(g=>g.dispose());}
  }
  batch(base,stockSeat);
  for(const [id,group] of Object.entries(parts))if(!['brownSeat','pillion'].includes(id))batch(group);
  return {
    root, base, parts, paint, stockSeat,
    setConfig(config, stock = false) {
      const color=COLORS.find(c=>c.id===config.color) || COLORS[0];
      paint.color.set(color.hex);
      for(const [id,group]of Object.entries(parts))group.visible=!stock&&config.parts.includes(id);
      stockSeat.visible=stock||!config.parts.includes('brownSeat');
      pillion.children[0].material=!stock&&config.parts.includes('brownSeat')?brown:seatMat;
    },
    setLights(on) { glass.emissiveIntensity=on?3.1:.025;tailGlass.emissiveIntensity=on?1.6:.18; },
    stats: { wheelbase: SPEC.wheelbase, frontRadius: SPEC.frontRadius, rearRadius: SPEC.rearRadius },
  };
}
