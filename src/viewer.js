import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { createMotorcycle } from './model.js';
import { SPEC } from './config.js';
import { createCustomPartsManager } from './custom-parts-3d.js';

// Real studio reflections come from a small number of large luminous surfaces.
// Keeping the rest of the room dark preserves the black paint and gives curved
// parts a readable highlight instead of illuminating every surface equally.
function studioEnvironment(renderer) {
  const room = new THREE.Scene();
  room.background = new THREE.Color(.085, .085, .085);
  const panels = [];
  const diffuser = document.createElement('canvas'); diffuser.width = diffuser.height = 128;
  const context = diffuser.getContext('2d'), pixels = context.createImageData(128, 128);
  for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
    const edge = Math.max(Math.abs((x - 63.5) / 64), Math.abs((y - 63.5) / 64));
    const value = Math.round(255 * Math.pow(Math.max(0, 1 - Math.pow(edge, 8)), .75));
    const i = (y * 128 + x) * 4;
    pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = value; pixels.data[i + 3] = 255;
  }
  context.putImageData(pixels, 0, 0);
  const diffuserTexture = new THREE.CanvasTexture(diffuser); diffuserTexture.colorSpace = THREE.SRGBColorSpace;
  function softbox(width, height, at, brightness, color = '#ffffff') {
    const material = new THREE.MeshBasicMaterial({ color, map: diffuserTexture, side: THREE.DoubleSide, toneMapped: false });
    material.color.multiplyScalar(brightness);
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
    panel.position.set(...at); panel.lookAt(0, .55, 0); room.add(panel); panels.push(panel);
  }
  softbox(6.0, 3.8, [-2.5, 4.5, 2], 3.6);
  softbox(4.5, 1.1, [1.2, 2.9, -3.3], 2.8, '#f5f6ff');
  softbox(1.0, 3.0, [-3.8, 1.7, -.8], 2.0);
  softbox(4.2, 3.0, [1.5, 1.8, 4.8], 1.5);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const target = pmrem.fromScene(room, .035, .1, 30);
  for (const panel of panels) { panel.geometry.dispose(); panel.material.dispose(); }
  diffuserTexture.dispose();
  pmrem.dispose();
  return target;
}

// This cached, height-weighted projection follows the actual tyre and engine
// geometry. It is regenerated only when the build changes, never while orbiting.
function createContactShadow(renderer, root) {
  const target = new THREE.WebGLRenderTarget(768, 512, { depthBuffer: true });
  const blurTarget = new THREE.WebGLRenderTarget(768, 512, { depthBuffer: false });
  const depthMaterial = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    vertexShader: `varying float height; void main(){ vec4 p=modelMatrix*vec4(position,1.0); height=max(p.y,0.0); gl_Position=projectionMatrix*viewMatrix*p; }`,
    fragmentShader: `varying float height; void main(){ gl_FragColor=vec4(0.0,0.0,0.0,.66*exp(-height*8.5)); }`,
  });
  const shadowScene = new THREE.Scene(); shadowScene.overrideMaterial = depthMaterial;
  const shadowCamera = new THREE.OrthographicCamera(-1.5, 1.5, .95, -.95, .001, 1.6);
  shadowCamera.position.set(0, -.012, 0); shadowCamera.up.set(0, 0, 1); shadowCamera.lookAt(0, 1, 0);
  const blurMaterial = new THREE.ShaderMaterial({
    uniforms: { map: { value: null }, step: { value: new THREE.Vector2() } },
    depthTest: false, depthWrite: false,
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.0,1.0); }`,
    fragmentShader: `uniform sampler2D map; uniform vec2 step; varying vec2 vUv; void main(){
      vec4 sum=texture2D(map,vUv)*.227027;
      sum+=(texture2D(map,vUv+step*1.384615)+texture2D(map,vUv-step*1.384615))*.316216;
      sum+=(texture2D(map,vUv+step*3.230769)+texture2D(map,vUv-step*3.230769))*.070270;
      gl_FragColor=sum;
    }`,
  });
  const blurScene = new THREE.Scene(), quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), blurMaterial);
  quad.frustumCulled = false; blurScene.add(quad);
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(3, 1.9), new THREE.MeshBasicMaterial({
    map: target.texture, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
  }));
  plane.rotation.x = Math.PI / 2; plane.position.y = .0003; plane.renderOrder = -1;
  let dirty = true;
  return {
    plane,
    invalidate() { dirty = true; },
    update() {
      if (!dirty) return;
      const clone = root.clone(true);
      const nonCasters=[];clone.traverse(object=>{if(object.isMesh&&!object.castShadow)nonCasters.push(object);});
      nonCasters.forEach(object=>object.removeFromParent());shadowScene.add(clone);
      const previousTarget = renderer.getRenderTarget(), previousColor = renderer.getClearColor(new THREE.Color()), previousAlpha = renderer.getClearAlpha();
      const shadowsEnabled = renderer.shadowMap.enabled;
      renderer.shadowMap.enabled = false; renderer.setClearColor(0x000000, 0);
      renderer.setRenderTarget(target); renderer.clear(); renderer.render(shadowScene, shadowCamera);
      blurMaterial.uniforms.map.value = target.texture; blurMaterial.uniforms.step.value.set(3.2 / 768, 0);
      renderer.setRenderTarget(blurTarget); renderer.clear(); renderer.render(blurScene, shadowCamera);
      blurMaterial.uniforms.map.value = blurTarget.texture; blurMaterial.uniforms.step.value.set(0, 3.2 / 512);
      renderer.setRenderTarget(target); renderer.clear(); renderer.render(blurScene, shadowCamera);
      renderer.setRenderTarget(previousTarget); renderer.setClearColor(previousColor, previousAlpha); renderer.shadowMap.enabled = shadowsEnabled;
      shadowScene.remove(clone); dirty = false;
    },
    dispose() { target.dispose(); blurTarget.dispose(); depthMaterial.dispose(); blurMaterial.dispose(); quad.geometry.dispose(); plane.geometry.dispose(); plane.material.dispose(); },
  };
}

export function createViewer(container, onReady, onError) {
  let renderer;
  try { renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true,powerPreference:'high-performance'}); }
  catch(error){onError(error);return null;}
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.AgXToneMapping;
  renderer.toneMappingExposure=1.0;
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.domElement.setAttribute('aria-label','Rebel 500 互動 3D 模型。拖曳旋轉、滾輪縮放、右鍵平移。');
  renderer.domElement.setAttribute('role','img');
  renderer.domElement.tabIndex=0;
  container.prepend(renderer.domElement);
  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(27,1,.02,40);
  const homePosition=new THREE.Vector3(-1.50,1.15,3.55);
  const target=new THREE.Vector3(0,.56,0);
  camera.position.copy(homePosition);
  const controls=new OrbitControls(camera,renderer.domElement);
  controls.target.copy(target);controls.enableDamping=true;controls.dampingFactor=.09;
  controls.minDistance=1.45;controls.maxDistance=7;controls.maxPolarAngle=Math.PI*.495;controls.minPolarAngle=.08;
  controls.autoRotateSpeed=.65;
  controls.enablePan=true;controls.listenToKeyEvents(renderer.domElement);
  const envTarget=studioEnvironment(renderer);scene.environment=envTarget.texture;scene.environmentIntensity=.82;
  const hemisphere=new THREE.HemisphereLight('#ffffff','#444444',.58);scene.add(hemisphere);
  const key=new THREE.DirectionalLight('#fffaf3',1.45);key.position.set(-3.4,5,3.0);key.castShadow=true;
  key.shadow.mapSize.set(2048,2048);key.shadow.camera.left=-1.65;key.shadow.camera.right=1.65;key.shadow.camera.top=1.55;key.shadow.camera.bottom=-1.55;key.shadow.camera.near=.5;key.shadow.camera.far=12;key.shadow.normalBias=.0015;key.shadow.bias=-.00008;key.shadow.radius=4;scene.add(key);
  const rim=new THREE.DirectionalLight('#eef2ff',.8);rim.position.set(1.8,3.5,-3);scene.add(rim);
  const fill=new THREE.DirectionalLight('#ffffff',.80);fill.position.set(2,1.5,4);scene.add(fill);
  const bike=createMotorcycle();scene.add(bike.root);

  const shadowPlane=new THREE.Mesh(new THREE.PlaneGeometry(20,20),new THREE.ShadowMaterial({opacity:.025}));shadowPlane.rotation.x=-Math.PI/2;shadowPlane.position.y=-.002;shadowPlane.receiveShadow=true;scene.add(shadowPlane);
  const contactShadow=createContactShadow(renderer,bike.root);scene.add(contactShadow.plane);
  const measurement=new THREE.Group();measurement.visible=false;scene.add(measurement);
  const dimensionMat=new THREE.LineBasicMaterial({color:'#7a8154',transparent:true,opacity:.8,depthTest:false});
  const coords=[[-.745,.06,.37],[.745,.06,.37],[-.745,.015,.34],[-.745,.14,.34],[.745,.015,.34],[.745,.14,.34],[.30,.01,.38],[.30,SPEC.seatHeight,.38],[.25,SPEC.seatHeight,.38],[.35,SPEC.seatHeight,.38]];
  measurement.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(coords.map(p=>new THREE.Vector3(...p))),dimensionMat));
  const labelElements=[];
  for(const [text,position] of [['軸距 1,490 mm',[0,.06,.37]],['座高 690 mm',[.33,.73,.38]]]){
    const element=document.createElement('span');element.className='dimension-label';element.textContent=text;element.hidden=true;container.append(element);labelElements.push({element,position:new THREE.Vector3(...position)});
  }
  let dirty=true, dark=false, tween=null, last=0, size={width:0,height:0};
  const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const invalidate=()=>{dirty=true;};
  const customParts=createCustomPartsManager(bike.root,{invalidate:()=>{contactShadow.invalidate();invalidate();},onError:error=>console.warn('配件圖片載入失敗',error)});
  controls.addEventListener('change',invalidate);
  controls.addEventListener('start',()=>{tween=null;});
  let fitScale=1;
  function resize(){const {width,height}=container.getBoundingClientRect();if(!width||!height)return;size={width,height};camera.aspect=width/height;const nextScale=Math.max(1,1.43/camera.aspect);camera.position.sub(controls.target).multiplyScalar(nextScale/fitScale).add(controls.target);fitScale=nextScale;camera.updateProjectionMatrix();renderer.setSize(width,height);invalidate();}
  const observer=new ResizeObserver(resize);observer.observe(container);resize();
  function positionLabels(){
    for(const {element,position}of labelElements){element.hidden=!measurement.visible;if(!measurement.visible)continue;const p=position.clone().project(camera);element.style.left=`${(p.x*.5+.5)*size.width}px`;element.style.top=`${(-p.y*.5+.5)*size.height}px`;element.style.opacity=p.z<1?1:0;}
  }
  function render(){contactShadow.update();positionLabels();renderer.render(scene,camera);}
  function frame(time){
    const delta=Math.min((time-last)/1000,.1);last=time;
    if(tween){const t=Math.min(1,(time-tween.start)/650),u=1-Math.pow(1-t,3);camera.position.lerpVectors(tween.from,tween.to,u);controls.target.lerpVectors(tween.targetFrom,target,u);if(t===1)tween=null;dirty=true;}
    controls.update(delta);
    if(dirty||controls.autoRotate){render();dirty=false;}
  }
  renderer.setAnimationLoop(frame);
  renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();onError(new Error('圖形處理器連線中斷，請重新載入頁面。'));});
  renderer.domElement.addEventListener('webglcontextrestored',()=>location.reload());

  function thumbnails(){
    const result={};
    const previewScene=new THREE.Scene();previewScene.environment=scene.environment;previewScene.environmentIntensity=.8;previewScene.background=new THREE.Color('#f2f2f0');previewScene.add(new THREE.HemisphereLight('#ffffff','#444444',.4));
    const light=new THREE.DirectionalLight('#fffaf3',1.7);light.position.set(-2,4,4);previewScene.add(light);
    const previewCamera=new THREE.PerspectiveCamera(32,1.5,.001,15);
    const oldSize=renderer.getSize(new THREE.Vector2()),ratio=renderer.getPixelRatio();
    renderer.setPixelRatio(1);renderer.setSize(240,160,false);
    for(const [id,part]of Object.entries(bike.parts)){
      const clone=part.clone();clone.visible=true;previewScene.add(clone);
      const box=new THREE.Box3().setFromObject(clone),center=box.getCenter(new THREE.Vector3()),s=box.getSize(new THREE.Vector3());
      const radius=Math.max(s.x,s.y,s.z)*1.7;
      previewCamera.position.copy(center).add(new THREE.Vector3(-.95,.60,1.6).normalize().multiplyScalar(radius));previewCamera.lookAt(center);
      renderer.render(previewScene,previewCamera);result[id]=renderer.domElement.toDataURL('image/webp',.87);previewScene.remove(clone);
    }
    renderer.setPixelRatio(ratio);renderer.setSize(oldSize.x,oldSize.y);invalidate();return result;
  }
  const api={
    bike, camera, controls, scene, renderer, customParts,
    setConfig(config,stock=false){bike.setConfig(config,stock);customParts.setParts(config.customParts||[],{stock});contactShadow.invalidate();invalidate();},
    setView(view){
      const distance=3.65;const views={perspective:homePosition,left:new THREE.Vector3(0,.70,-distance),right:new THREE.Vector3(0,.70,distance),front:new THREE.Vector3(-distance,.76,0),rear:new THREE.Vector3(distance,.76,0),top:new THREE.Vector3(0,4.1,.001)};
      controls.autoRotate=false;
      const to=(views[view]||homePosition).clone().sub(target).multiplyScalar(fitScale).add(target);
      if(reducedMotion){camera.position.copy(to);controls.target.copy(target);controls.update();}else tween={from:camera.position.clone(),to,targetFrom:controls.target.clone(),start:performance.now()};
      invalidate();
    },
    reset(){controls.autoRotate=false;api.setView('perspective');},
    zoom(amount){const d=camera.position.clone().sub(controls.target);d.multiplyScalar(amount);d.clampLength(controls.minDistance,controls.maxDistance);camera.position.copy(controls.target).add(d);invalidate();},
    setAutoRotate(enabled){controls.autoRotate=enabled;invalidate();},
    setDimensions(enabled){measurement.visible=enabled;invalidate();},
    setLights(enabled){bike.setLights(enabled);invalidate();},
    setDark(enabled){dark=enabled;renderer.toneMappingExposure=dark?1.08:1.0;hemisphere.intensity=dark?.35:.58;scene.environmentIntensity=dark?.86:.82;shadowPlane.material.opacity=dark?.07:.025;contactShadow.plane.material.opacity=dark?.65:1;invalidate();},
    capture(){
      const previous=scene.background;scene.background=new THREE.Color(dark?'#242a27':'#f1f2ec');render();const data=renderer.domElement.toDataURL('image/png');scene.background=previous;invalidate();return data;
    },
    async exportGLB(){await customParts.whenReady();return new GLTFExporter().parseAsync(bike.root,{binary:true,onlyVisible:true,maxTextureSize:512});},
    thumbnails,
    dispose(){observer.disconnect();controls.dispose();renderer.setAnimationLoop(null);customParts.dispose();contactShadow.dispose();envTarget.dispose();renderer.dispose();},
  };
  requestAnimationFrame(()=>{render();onReady(api);});
  return api;
}
