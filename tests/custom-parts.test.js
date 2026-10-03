import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CUSTOM_TEMPLATES, MAX_CUSTOM_PARTS, MAX_IMAGE_DATA_LENGTH, createCustomPart, validateCustomParts, safeSourceUrl } from '../src/custom-parts.js';
import { createCustomPartsManager } from '../src/custom-parts-3d.js';

const PNG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z4zAAAAAASUVORK5CYII=';

test('product URLs accept only explicit HTTP(S) addresses without credentials',()=>{
  assert.equal(safeSourceUrl(' https://shop.example/item?q=rebel%20500 '),'https://shop.example/item?q=rebel%20500');
  assert.equal(safeSourceUrl('http://example.com'),'http://example.com/');assert.equal(safeSourceUrl(''),'');
  for(const value of ['javascript:alert(1)','data:text/html,x','file:///test','//example.com/x','https://user:secret@example.com','https://user@example.com','https://exa\nmple.com','https://','relative/path',23,null])assert.throws(()=>safeSourceUrl(value));
});

test('all templates round trip through JSON with independent vectors and unique ids',()=>{
  const parts=CUSTOM_TEMPLATES.map(template=>createCustomPart({template:template.id}));
  assert.equal(new Set(parts.map(part=>part.id)).size,parts.length);
  assert.deepEqual(validateCustomParts(JSON.parse(JSON.stringify(parts))),parts);
  parts[0].position[0]=1;assert.notEqual(CUSTOM_TEMPLATES[0].position[0],1);
  const clone=validateCustomParts(parts);clone[0].rotation[0]=22;assert.equal(parts[0].rotation[0],0);
});

test('image validation rejects SVG, MIME spoofing, external URLs and oversized data',()=>{
  assert.equal(createCustomPart({imageData:PNG}).imageData,PNG);
  const large='data:image/png;base64,iVBORw0KGgoA'+'A'.repeat(1200000);
  assert.equal(createCustomPart({imageData:large}).imageData.length,large.length);
  for(const imageData of ['data:image/svg+xml;base64,PHN2Zz4=','https://example.com/photo.png',PNG.replace('image/png','image/jpeg'),'data:image/png;base64,AAAA','data:image/png;base64,iVBORw0KGgo!','data:image/png;base64,'+'A'.repeat(MAX_IMAGE_DATA_LENGTH)])assert.throws(()=>createCustomPart({imageData}));
});

test('imports enforce count, unique ids, finite bounded transforms and canonical fields',()=>{
  const valid=createCustomPart({id:'part-a',position:[-1.5,1.8,1],rotation:[-180,0,180],size:[.01,1.5,.4],name:'  外掛包  ',color:'#AaBbCc'});
  assert.equal(valid.name,'外掛包');assert.equal(valid.color,'#aabbcc');
  assert.deepEqual(validateCustomParts([JSON.parse(JSON.stringify(valid))]),[valid]);
  assert.throws(()=>validateCustomParts([valid,valid]));
  assert.throws(()=>validateCustomParts(Array.from({length:MAX_CUSTOM_PARTS+1},(_,index)=>({...valid,id:'p'+index}))));
  for(const patch of [{name:''},{name:'x'.repeat(81)},{id:'../escape'},{id:'x'.repeat(65)},{template:'unknown'},{material:'unknown'},{color:'red'},{installed:1},{size:[0,.2,.3]},{size:[.2,-.3,.4]},{position:[1,2,0]},{position:[0,1,Infinity]},{rotation:[NaN,0,0]},{rotation:[181,0,0]},{size:[.2,.3]},{position:['0',1,0]}])assert.throws(()=>validateCustomParts([{...valid,...patch}]));
  assert.equal('unexpected' in validateCustomParts([{...valid,unexpected:'ignored'}])[0],false);
});

test('3D templates have finite geometry; transforms and install toggles reuse geometry',()=>{
  const parent=new THREE.Group();let invalidations=0;const manager=createCustomPartsManager(parent,{invalidate:()=>invalidations++});
  const parts=CUSTOM_TEMPLATES.map(template=>createCustomPart({template:template.id}));manager.setParts(parts);
  parent.updateMatrixWorld(true);
  parent.traverse(object=>{if(!object.isMesh)return;for(const name of ['position','normal'])for(const value of object.geometry.attributes[name].array)assert.ok(Number.isFinite(value));});
  const part=parts[0],group=parent.getObjectByName('custom_accessory_'+part.id),mesh=group.getObjectByProperty('isMesh',true),geometry=mesh.geometry;
  const adjusted={...part,position:[-.20,.99,-.4],rotation:[45,-90,180],size:[.5,.4,.3],installed:false};
  manager.setParts([adjusted,...parts.slice(1)]);
  assert.equal(group.getObjectByProperty('isMesh',true).geometry,geometry);assert.deepEqual(group.position.toArray(),adjusted.position);assert.deepEqual(group.scale.toArray(),adjusted.size);
  for(let i=0;i<3;i++)assert.ok(Math.abs(group.rotation.toArray()[i]-THREE.MathUtils.degToRad(adjusted.rotation[i]))<1e-12);
  assert.equal(group.visible,false);manager.setParts(parts,{stock:true});assert.equal(manager.getStatus().visible,0);
  manager.setParts(parts);assert.equal(manager.getStatus().visible,parts.length);
  assert.throws(()=>manager.setParts([{...part,size:[0,1,1]}]));assert.equal(manager.getStatus().total,parts.length);
  let disposed=0;geometry.addEventListener('dispose',()=>disposed++);manager.setParts(parts.slice(1));assert.equal(disposed,1);assert.equal(parent.getObjectByName(group.name),undefined);
  manager.dispose();assert.equal(parent.children.length,0);assert.ok(invalidations>0);assert.throws(()=>manager.setParts([]));
});

test('replacing a moved and scaled template normalizes in local space',()=>{
  const parent=new THREE.Group();parent.position.set(2,3,4);parent.rotation.y=.7;
  const manager=createCustomPartsManager(parent),part=createCustomPart({template:'bag',position:[1,1.5,.8],size:[.6,.3,.8],rotation:[0,70,45]});
  manager.setParts([part]);parent.updateMatrixWorld(true);
  const replacement={...part,template:'box',position:[0,0,0],rotation:[0,0,0],size:[.5,.4,.3]};manager.setParts([replacement]);
  const group=parent.getObjectByName('custom_accessory_'+part.id);parent.remove(group);group.updateMatrixWorld(true);
  const size=new THREE.Box3().setFromObject(group).getSize(new THREE.Vector3());
  size.toArray().forEach((number,i)=>assert.ok(Math.abs(number-replacement.size[i])<1e-6));
  manager.dispose();
});

test('product reference photos are retained as data and never wrapped onto 3D templates',async()=>{
  const parent=new THREE.Group(),manager=createCustomPartsManager(parent);
  const parts=CUSTOM_TEMPLATES.filter(template=>template.id!=='photo').map(template=>createCustomPart({template:template.id,imageData:PNG}));
  manager.setParts(parts);await manager.whenReady();
  assert.equal(manager.getStatus().loading,0);assert.equal(manager.getStatus().errors.length,0);
  parent.traverse(object=>{if(object.isMesh)assert.equal(object.material.map,null);});
  for(const template of CUSTOM_TEMPLATES)assert.equal(template.usesImage,template.id==='photo');
  manager.dispose();
});

test('photo textures update asynchronously and stale loads cannot resurrect removed parts',async()=>{
  const originalImage=globalThis.Image,originalDocument=globalThis.document,images=[];let invalidations=0;
  class FakeImage {constructor(){this.naturalWidth=20;this.naturalHeight=10;images.push(this);}set src(value){this.value=value;}}
  globalThis.Image=FakeImage;globalThis.document={createElement:()=>({getContext:()=>({drawImage(){}})})};
  const parent=new THREE.Group(),manager=createCustomPartsManager(parent,{invalidate:()=>invalidations++});
  try {
    const photo=createCustomPart({template:'photo',imageData:PNG});manager.setParts([photo]);assert.equal(manager.getStatus().loading,1);
    const before=invalidations,ready=manager.whenReady();images[0].onload();await ready;assert.equal(manager.getStatus().parts[0].textureStatus,'ready');assert.ok(invalidations>before);
    const plane=parent.getObjectByName('photo_reference_plane_not_3d_reconstruction'),texture=plane.material.map;assert.ok(texture.isCanvasTexture);
    manager.setParts([{...photo,position:[.2,.7,.3]}]);assert.equal(images.length,1);assert.equal(plane.material.map,texture);
    let released=0;texture.addEventListener('dispose',()=>released++);manager.setParts([]);assert.equal(released,1);
    manager.setParts([photo]);const staleLoad=images[1].onload;manager.dispose();staleLoad();assert.equal(parent.children.length,0);
  } finally {manager.dispose();if(originalImage===undefined)delete globalThis.Image;else globalThis.Image=originalImage;if(originalDocument===undefined)delete globalThis.document;else globalThis.document=originalDocument;}
});

test('whenReady rejects failed visible photos and permits uninstalled or blank photo references',async()=>{
  const originalImage=globalThis.Image,originalDocument=globalThis.document,images=[],errors=[];
  class FakeImage {constructor(){images.push(this);}set src(value){this.value=value;}}
  globalThis.Image=FakeImage;globalThis.document={};
  const manager=createCustomPartsManager(new THREE.Group(),{onError:error=>errors.push(error)});
  try {
    const part=createCustomPart({template:'photo',imageData:PNG});manager.setParts([part]);
    const waiting=manager.whenReady();images[0].onerror();await assert.rejects(waiting,/照片無法解碼/);assert.equal(errors[0].partId,part.id);
    await assert.rejects(manager.whenReady(),/照片無法解碼/);
    manager.setParts([{...part,installed:false}]);await manager.whenReady();
    manager.setParts([{...part,imageData:''}]);await manager.whenReady();assert.equal(manager.getStatus().loading,0);
  } finally {manager.dispose();if(originalImage===undefined)delete globalThis.Image;else globalThis.Image=originalImage;if(originalDocument===undefined)delete globalThis.document;else globalThis.document=originalDocument;}
});
