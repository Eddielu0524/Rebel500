import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { validateCustomParts } from './custom-parts.js';

const UP = new THREE.Vector3(0,1,0);
const IMAGE_TEMPLATES = new Set(['photo']);

function mesh(parent,geometry,material,position=[0,0,0],rotation=[0,0,0]) {
  const object=new THREE.Mesh(geometry,material);object.position.set(...position);object.rotation.set(...rotation);
  object.castShadow=true;object.receiveShadow=true;parent.add(object);return object;
}
function rounded(parent,size,position,material,radius=.008) {
  return mesh(parent,new RoundedBoxGeometry(...size,3,Math.min(radius,...size.map(n=>n*.45))),material,position);
}
function rod(parent,a,b,radius,material) {
  const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),delta=end.clone().sub(start);
  const object=mesh(parent,new THREE.CylinderGeometry(radius,radius,delta.length(),14),material);
  object.position.copy(start.add(end).multiplyScalar(.5));object.quaternion.setFromUnitVectors(UP,delta.normalize());return object;
}
function leatherGrain() {
  const data=new Uint8Array(128*128*4);let seed=207;
  for(let i=0;i<data.length;i+=4){seed=(seed*1664525+1013904223)>>>0;const v=95+(seed>>>25);data[i]=data[i+1]=data[i+2]=v;data[i+3]=255;}
  const texture=new THREE.DataTexture(data,128,128);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(6,6);
  texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.needsUpdate=true;return texture;
}

function buildStructure(record) {
  // Normalize while detached: a previously positioned accessory must not leak
  // its world transform into the replacement template's local dimensions.
  const content=new THREE.Group();record.content=content;
  const body=new THREE.MeshPhysicalMaterial();body.name='custom_accessory_surface';record.mainMaterial=body;
  const trim=new THREE.MeshStandardMaterial({color:'#131718',metalness:.32,roughness:.51});
  const hardware=new THREE.MeshStandardMaterial({color:'#959c9e',metalness:.9,roughness:.32});
  record.materials=[body,trim,hardware];
  const patch=(width,height,position,standalone=false)=>{
    const material=standalone?body:new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.65,transparent:true,alphaTest:.02,side:THREE.DoubleSide});
    if(!standalone)record.materials.push(material);
    record.pictureMaterial=material;
    record.pictureMesh=mesh(content,new THREE.PlaneGeometry(width,height),material,position);
    record.pictureMesh.name=standalone?'photo_reference_plane_not_3d_reconstruction':'small_photo_reference_patch';
    record.pictureMesh.castShadow=false;record.pictureMesh.visible=standalone;
  };
  const template=record.template;
  if(template==='bag') {
    rounded(content,[.34,.245,.145],[0,-.007,0],body,.02);
    rounded(content,[.354,.072,.156],[0,.103,.003],body,.018);
    for(const x of [-.093,.093]) {
      rounded(content,[.019,.186,.008],[x,-.016,.078],trim,.002);
      rounded(content,[.029,.030,.007],[x,.013,.085],hardware,.003);
      rounded(content,[.018,.020,.008],[x,.013,.090],trim,.002);
    }
    rod(content,[-.06,.133,0],[-.047,.152,0],.006,trim);rod(content,[-.047,.152,0],[.047,.152,0],.006,trim);rod(content,[.047,.152,0],[.06,.133,0],.006,trim);
  } else if(template==='box') {
    rounded(content,[.345,.260,.297],[0,-.011,0],body,.017);
    rounded(content,[.36,.034,.311],[0,.128,0],body,.009);
    rounded(content,[.043,.050,.012],[0,.075,.158],trim,.004);
    rounded(content,[.022,.016,.013],[0,.073,.163],hardware,.003);
    for(const x of [-.115,.115])rounded(content,[.022,.044,.014],[x,.103,-.152],hardware,.003);
  } else if(template==='windshield') {
    const positions=[],indices=[],nx=30,ny=28;
    for(let y=0;y<=ny;y++)for(let x=0;x<=nx;x++){
      const u=x/nx*2-1,v=y/ny;
      positions.push(-.040+.034*u*u+.024*v,-.145+.265*v+.024*(1-u*u)*v,u*(.17-.033*v*v));
      if(x<nx&&y<ny){const i=y*(nx+1)+x;indices.push(i,i+1,i+nx+1,i+1,i+nx+2,i+nx+1);}
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();
    mesh(content,geometry,body);
    for(const z of [-.106,.106]){rod(content,[.010,-.146,z],[.005,-.076,z],.0045,trim);rounded(content,[.009,.016,.016],[-.021,-.084,z],hardware,.004);}
  } else if(template==='seat') {
    const sections=[[-.208,-.016,.005,.009],[-.16,-.025,.068,.023],[-.075,-.026,.132,.025],[.035,-.014,.160,.027],[.13,.015,.155,.030],[.195,.044,.093,.022],[.21,.049,.003,.006]];
    const center=new THREE.CatmullRomCurve3(sections.map(s=>new THREE.Vector3(s[0],s[1],0)));
    const profile=new THREE.SplineCurve(sections.map(s=>new THREE.Vector2(s[2],s[3]))),positions=[],indices=[],uv=[];const nx=64,ny=40;
    for(let i=0;i<=nx;i++)for(let j=0;j<=ny;j++){
      const c=center.getPoint(i/nx),p=profile.getPoint(i/nx),a=j/ny*Math.PI*2;
      positions.push(c.x,c.y+Math.sin(a)*Math.max(.001,p.y),Math.sign(Math.cos(a))*Math.abs(Math.cos(a))**.72*Math.max(.001,p.x));uv.push(i/nx,j/ny);
      if(i<nx&&j<ny){const n=i*(ny+1)+j;indices.push(n,n+ny+1,n+1,n+1,n+ny+1,n+ny+2);}
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();mesh(content,geometry,body);
    rounded(content,[.26,.012,.21],[.012,-.030,0],trim,.005);
  } else if(template==='backrest') {
    for(const z of [-.096,.096]){rod(content,[.014,-.172,z],[.006,.034,z],.008,trim);rod(content,[.006,.034,z],[0,.10,z*.76],.008,trim);}
    rounded(content,[.055,.159,.246],[0,.09,0],body,.018);
    rounded(content,[.009,.095,.151],[.032,.091,0],trim,.004);
    for(const z of [-.055,.055])rod(content,[.037,.091,z],[.041,.091,z],.005,hardware);
  } else if(template==='rack') {
    for(const z of [-.136,.136])rod(content,[-.147,.021,z],[.147,.021,z],.007,body);
    for(const x of [-.147,.147])rod(content,[x,.021,-.136],[x,.021,.136],.007,body);
    for(const x of [-.105,-.052,0,.052,.105])rod(content,[x,.018,-.13],[x,.018,.13],.0045,body);
    for(const z of [-.115,.115]){rod(content,[-.093,.014,z],[-.127,-.039,z*.83],.006,trim);rod(content,[.105,.014,z],[.076,-.039,z*.83],.006,trim);}
  } else if(template==='photo') patch(.28,.24,[0,0,0],true);
  // All physical template envelopes are normalized once; slider edits only touch
  // the outer group transform and preserve geometry/material/texture identities.
  content.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(content),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
  const reciprocal=new THREE.Vector3(1/Math.max(.00001,size.x),1/Math.max(.00001,size.y),size.z>1e-6?1/size.z:1);
  content.scale.copy(reciprocal);content.position.copy(center.multiply(reciprocal).negate());
  record.group.add(content);
}

function clearStructure(record) {
  const geometries=new Set();record.group.traverse(object=>{if(object.isMesh)geometries.add(object.geometry);});
  for(const geometry of geometries)geometry.dispose();
  for(const material of record.materials??[])material.dispose();
  record.group.clear();record.materials=[];record.pictureMaterial=null;record.pictureMesh=null;
}

export function createCustomPartsManager(parent,{invalidate=()=>{},onError=()=>{}}={}) {
  if(!parent?.isObject3D)throw new Error('自訂配件需要有效的 3D 場景。');
  const records=new Map(),waiters=new Set();let disposed=false,stock=false,grain=null;
  function settleWaiters() {
    if(!waiters.size)return;
    const relevant=[...records.values()].filter(record=>record.group.visible&&IMAGE_TEMPLATES.has(record.template)&&record.imageData);
    const failed=relevant.find(record=>record.textureStatus==='error');
    if(!failed&&relevant.some(record=>record.textureStatus==='loading'))return;
    for(const waiter of waiters) {
      if(failed)waiter.reject(new Error(`${failed.part.name}：${failed.error}`));
      else waiter.resolve(getStatus());
    }
    waiters.clear();
  }
  function configureMaterial(record,part) {
    const material=record.mainMaterial,smoke=part.material==='smoke',wasTransparent=material.transparent;
    material.color.set(part.color);material.metalness=part.material==='metal'?.92:part.material==='gloss'?.24:.05;
    material.roughness={gloss:.18,satin:.46,matte:.9,leather:.83,metal:.27,smoke:.09}[part.material];
    material.clearcoat=part.material==='gloss'?.95:part.material==='satin'?.2:0;material.clearcoatRoughness=.15;
    material.transparent=smoke||record.template==='photo';material.opacity=smoke?.43:1;material.depthWrite=!smoke;
    material.side=record.template==='windshield'||record.template==='photo'?THREE.DoubleSide:THREE.FrontSide;
    material.alphaTest=record.template==='photo'?.02:0;
    const previousBump=material.bumpMap;
    if(part.material==='leather'){grain??=leatherGrain();material.bumpMap=grain;material.bumpScale=.00065;}else material.bumpMap=null;
    if(previousBump!==material.bumpMap||wasTransparent!==material.transparent)material.needsUpdate=true;
    record.group.traverse(object=>{if(object.isMesh&&object.material===material)object.castShadow=!smoke&&record.template!=='photo';});
  }
  function cancelLoad(record) {
    record.generation++;
    if(record.pending){record.pending.onload=null;record.pending.onerror=null;record.pending=null;}
  }
  function applyPicture(record) {
    if(record.pictureMaterial&&record.pictureMaterial.map!==(record.texture??null)){record.pictureMaterial.map=record.texture??null;record.pictureMaterial.needsUpdate=true;}
    if(record.pictureMesh)record.pictureMesh.visible=record.template==='photo'||Boolean(record.texture);
  }
  function failImage(record,message,generation) {
    if(disposed||generation!==record.generation||!records.has(record.id))return;
    record.pending=null;record.textureStatus='error';record.error=message;
    const error=new Error(message);error.partId=record.id;settleWaiters();onError(error);invalidate();
  }
  function setImage(record,part,structuralChange) {
    const changed=record.imageData!==part.imageData;
    if(changed){cancelLoad(record);record.texture?.dispose();record.texture=null;record.imageData=part.imageData;record.error='';record.textureStatus='none';}
    if(!IMAGE_TEMPLATES.has(record.template)){cancelLoad(record);record.textureStatus='unused';record.error='';applyPicture(record);return;}
    if(!part.imageData){record.textureStatus='none';applyPicture(record);return;}
    if(record.texture){record.textureStatus='ready';applyPicture(record);return;}
    if(record.pending||record.textureStatus==='error'&&!changed&&!structuralChange){applyPicture(record);return;}
    if(typeof Image==='undefined'||typeof document==='undefined'){failImage(record,'目前環境無法載入配件照片。',record.generation);return;}
    const image=new Image(),generation=++record.generation;record.pending=image;record.textureStatus='loading';record.error='';applyPicture(record);
    image.onload=()=>{
      if(disposed||generation!==record.generation||!records.has(record.id))return;
      const width=image.naturalWidth||image.width,height=image.naturalHeight||image.height;
      if(!width||!height||width>16384||height>16384||width*height>33554432){failImage(record,'照片解析度過大或沒有有效尺寸，請縮小照片。',generation);return;}
      try {
        const ratio=Math.min(1,1536/Math.max(width,height)),canvas=document.createElement('canvas');
        canvas.width=Math.max(1,Math.round(width*ratio));canvas.height=Math.max(1,Math.round(height*ratio));
        const context=canvas.getContext('2d');if(!context)throw new Error('無法建立照片材質。');
        context.drawImage(image,0,0,canvas.width,canvas.height);
        record.texture=new THREE.CanvasTexture(canvas);record.texture.colorSpace=THREE.SRGBColorSpace;record.texture.anisotropy=4;
        record.texture.name='uploaded_accessory_reference';record.pending=null;record.textureStatus='ready';applyPicture(record);settleWaiters();invalidate();
      } catch {failImage(record,'照片無法轉成材質，請換一張 PNG、JPEG 或 WebP。',generation);}
    };
    image.onerror=()=>failImage(record,'照片無法解碼，請換一張有效的 PNG、JPEG 或 WebP。',generation);
    image.src=part.imageData;
  }
  function release(record) {cancelLoad(record);record.group.removeFromParent();clearStructure(record);record.texture?.dispose();record.texture=null;}
  function getStatus() {
    const parts=[...records.values()].map(record=>({id:record.id,template:record.template,installed:record.part.installed,visible:record.group.visible,textureStatus:record.textureStatus}));
    return {total:parts.length,installed:parts.filter(part=>part.installed).length,visible:parts.filter(part=>part.visible).length,stock,loading:parts.filter(part=>part.textureStatus==='loading').length,errors:[...records.values()].filter(record=>record.error).map(record=>({id:record.id,message:record.error})),parts};
  }
  return {
    setParts(input,{stock:showStock=false}={}) {
      if(disposed)throw new Error('自訂配件場景已釋放。');
      const parts=validateCustomParts(input),wanted=new Set(parts.map(part=>part.id));stock=Boolean(showStock);
      for(const [id,record]of records)if(!wanted.has(id)){release(record);records.delete(id);}
      for(const part of parts){
        let record=records.get(part.id);
        if(!record){const group=new THREE.Group();group.name='custom_accessory_'+part.id;parent.add(group);record={id:part.id,group,template:null,generation:0,imageData:'',texture:null,pending:null,textureStatus:'none',error:''};records.set(part.id,record);}
        const changed=record.template!==part.template;
        if(changed){clearStructure(record);record.template=part.template;buildStructure(record);}
        record.part=part;record.group.visible=part.installed&&!stock;record.group.position.set(...part.position);
        record.group.rotation.set(...part.rotation.map(THREE.MathUtils.degToRad),'XYZ');record.group.scale.set(...part.size);
        record.group.userData={customAccessory:true,id:part.id,name:part.name,template:part.template,sourceUrl:part.sourceUrl,representation:part.template==='photo'?'2D photographic reference':'generic adjustable template'};
        configureMaterial(record,part);setImage(record,part,changed);
      }
      settleWaiters();invalidate();return getStatus();
    },
    getStatus,
    whenReady() {
      if(disposed)return Promise.reject(new Error('自訂配件場景已釋放，無法完成照片載入。'));
      return new Promise((resolve,reject)=>{waiters.add({resolve,reject});settleWaiters();});
    },
    dispose() {if(disposed)return;disposed=true;for(const record of records.values())release(record);records.clear();grain?.dispose();grain=null;for(const waiter of waiters)waiter.reject(new Error('自訂配件場景已釋放，無法完成照片載入。'));waiters.clear();invalidate();},
  };
}
