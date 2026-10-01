import './style.css';
import { createIcons, ArrowUpRight, Bookmark, Info, Ruler, Lightbulb, Plus, Minus, Scan, Camera, Box, Rotate3d, Mouse, CircleCheck, Layers2, Check, Columns2, ArrowRight, ShieldCheck, X, Download, Upload, CircleAlert } from 'lucide';
import { createViewer } from './viewer.js';
import { PARTS, COLORS, DEFAULT_CONFIG, SOURCE_URL, togglePart, validateConfig, readSaved } from './config.js';

const icon = (name, cls = '') => `<i data-lucide="${name}" class="${cls}"></i>`;
const icons = { ArrowUpRight, Bookmark, Info, Ruler, Lightbulb, Plus, Minus, Scan, Camera, Box, Rotate3d, Mouse, CircleCheck, Layers2, Check, Columns2, ArrowRight, ShieldCheck, X, Download, Upload, CircleAlert };
const $ = selector => document.querySelector(selector);
const HONDA_JAPAN_FEATURES = 'https://www.honda.co.jp/Rebel500/features01.html';
const HONDA_JAPAN_PRESS = 'https://global.honda/jp/news/2025/2250206-rebel500/image_download.html';
const REFERENCES = [
  { id:'three-quarter', file:'honda-2025-black-001.jpg', label:'右前 3/4', type:'標準車', alt:'Honda 日本 2025 Rebel 500 黑色標準車右前四分之三視角', note:'油箱輪廓、低座姿與車身前後層次。', source:'Honda 日本 · 2025 發表圖', url:HONDA_JAPAN_PRESS },
  { id:'right', file:'honda-2025-black-002.jpg', label:'右側全貌', type:'標準車', alt:'Honda 日本 2025 Rebel 500 黑色標準車右側全貌', note:'車架、排氣管與引擎的側面比例。', source:'Honda 日本 · 2025 發表圖', url:HONDA_JAPAN_PRESS },
  { id:'left', file:'honda-rebel-500.jpg', label:'左側全貌', type:'標準車', alt:'Honda 台灣 Rebel 500 黑色標準車左側全貌', note:'台灣官網主參考圖，可見鏈條與左側車身。', source:'Honda 台灣 · 車款介紹', url:SOURCE_URL },
  { id:'engine', file:'honda-tw-engine.jpg', label:'引擎材質', type:'標準車細節', alt:'Honda 台灣 Rebel 500 引擎外殼、螺栓與車架細節', note:'鑄造金屬、霧面外蓋與亮面螺栓的質感差異。', source:'Honda 台灣 · 車款介紹', url:SOURCE_URL },
  { id:'wheel', file:'honda-detail-09.png', label:'輪框／煞車', type:'標準車細節', alt:'Honda Rebel 500 黑色輪框、胎紋及前煞車碟盤特寫', note:'黑色鑄造輪輻、厚胎壁與鑽孔碟盤。', source:'Honda 日本 · 車款細節', url:HONDA_JAPAN_FEATURES },
  { id:'tank', file:'honda-detail-13.png', label:'油箱曲面', type:'標準車細節', alt:'Honda Rebel 500 黑色油箱曲面及 Honda 翼形標誌特寫', note:'水滴形油箱、下緣折線與黑色烤漆反光。', source:'Honda 日本 · 車款細節', url:HONDA_JAPAN_FEATURES },
  { id:'cowl', file:'honda-tw-headlight.jpg', label:'選配頭燈罩', type:'配件示意 · S 版配備', alt:'Honda Rebel 500 S 版頭燈罩與四眼 LED 頭燈特寫', note:'此圖含頭燈罩；一般版需另行選配，非素車標準外觀。', source:'Honda 台灣 · S 版／選配', url:SOURCE_URL },
];
document.querySelector('meta[name="description"]')?.setAttribute('content','Rebel 500 官網多角度外觀重建：參考 Honda 台灣與日本照片，360° 檢視造型、材質與配色，並自由試裝常見配件。');
let storage;
try { storage = window.localStorage; } catch { storage = { getItem: () => null, setItem: () => { throw new Error('storage unavailable'); } }; }
let config = readSaved(storage) || { ...DEFAULT_CONFIG, parts: [] };
let saved = readSaved(storage);
let category = 'all', compare = false, thumbs = {}, viewer = null, toastTimer;
let lights = false, dimensions = false, autoRotate = false, dark = false;

document.querySelector('#app').innerHTML = `
  <header class="topbar">
    <a class="brand" href="/" aria-label="Rebel Garage 首頁"><span class="brand-mark">R<span>®</span></span><span class="brand-name">REBEL<span>GARAGE / CUSTOM STUDIO</span></span></a>
    <nav class="header-nav" aria-label="主要導覽"><span class="nav-current">改裝工作室</span><button id="open-specs">車款資料 ${icon('arrow-up-right')}</button></nav>
    <div class="header-actions"><span class="local-badge"><span></span>你的私人車庫</span><button class="button save-button" id="save-build">${icon('bookmark')}<span>儲存方案</span></button></div>
  </header>
  <main class="workspace">
    <section class="studio" aria-label="3D 車輛預覽">
      <div class="studio-heading"><div class="eyebrow"><span class="status-dot"></span>2025 HONDA / CMX500</div><h1>REBEL <span>500</span><sup>®</sup></h1><p>你的 Rebel。你的風格。</p></div>
      <div class="scene-tag"><span class="live-dot"></span>LIVE 3D<span class="tag-divider"></span><button id="accuracy-info">官網多角度重建 ${icon('info')}</button></div>
      <div class="watermark" aria-hidden="true">REBEL</div>
      <div id="viewport"><div id="loading"><span class="loader"></span><strong>正在準備你的 Rebel</strong><small>建立車體、材質與攝影棚光線</small></div></div>
      <div id="compare-label" hidden>${icon('layers-2')} 原廠外觀預覽 <span>保留目前車色</span></div>
      <div class="viewport-tools" role="group" aria-label="預覽工具">
        <button id="dimensions" class="tool" title="顯示參考尺寸" aria-label="顯示參考尺寸" aria-pressed="false">${icon('ruler')}</button>
        <button id="lights" class="tool" title="開啟車燈" aria-label="開啟車燈" aria-pressed="false">${icon('lightbulb')}</button>
        <span class="tool-divider"></span>
        <button id="zoom-in" class="tool" title="放大" aria-label="放大">${icon('plus')}</button>
        <button id="zoom-out" class="tool" title="縮小" aria-label="縮小">${icon('minus')}</button>
        <button id="reset-view" class="tool" title="重設視角" aria-label="重設視角">${icon('scan')}</button>
        <span class="tool-divider"></span>
        <button id="screenshot" class="tool" title="下載目前視角" aria-label="下載目前視角">${icon('camera')}</button>
      </div>
      <div class="scene-bottom">
        <div class="scene-switch"><span class="eyebrow">ENVIRONMENT</span><div><button id="light-studio" class="scene-swatch light active" aria-label="明亮攝影棚" aria-pressed="true"></button><button id="dark-studio" class="scene-swatch dark" aria-label="深色攝影棚" aria-pressed="false"></button><span id="scene-name">日光攝影棚</span></div></div>
        <div class="camera-dock"><div class="view-buttons" role="group" aria-label="視角"><button data-view="perspective" class="active" aria-pressed="true">${icon('box')}<span>自由視角</span></button><button data-view="left" aria-pressed="false">左側</button><button data-view="right" aria-pressed="false">右側</button><button data-view="front" aria-pressed="false">正面</button><button data-view="rear" aria-pressed="false">車尾</button></div><button id="auto-rotate" class="rotate-button" title="自動旋轉" aria-label="自動旋轉" aria-pressed="false">${icon('rotate-3d')}</button></div>
        <div class="interaction-hint">${icon('mouse')}<span>拖曳旋轉 · 滾輪縮放<br>右鍵平移 · 觸控雙指縮放</span></div>
      </div>
      <footer class="spec-strip"><div><span class="spec-label">ENGINE</span><strong>471<span> cc</span></strong></div><div><span class="spec-label">WHEELBASE</span><strong>1,490<span> mm</span></strong></div><div><span class="spec-label">SEAT HEIGHT</span><strong>690<span> mm</span></strong></div><button id="model-info">${icon('circle-check')}<span>官網多角度外觀重建<br><small>查看照片與材質參考</small></span>${icon('arrow-up-right')}</button></footer>
    </section>
    <aside class="customizer" aria-label="改裝配件面板">
      <div class="panel-heading"><div><span class="eyebrow">MAKE IT YOURS</span><h2>打造你的專屬風格<span>↗</span></h2></div><span class="build-number">01</span></div>
      <section class="paint-section"><div class="section-title"><h3>車身配色</h3><span id="paint-name">石墨黑</span></div><div class="paint-options">${COLORS.map(c=>`<button class="paint-swatch" data-color="${c.id}" style="--swatch:${c.hex}" aria-label="${c.name}" title="${c.name}" aria-pressed="false"><span>${icon('check')}</span></button>`).join('')}<span class="paint-finish">GLOSS<br>FINISH</span></div><p class="paint-note" id="paint-note">依官方黑色車款參考 · 螢幕顏色僅供示意</p></section>
      <section class="accessories-section"><div class="section-title"><h3>配件選配 <span class="small-counter" id="installed-count">0</span></h3><button id="remove-all" class="text-button">全部卸下</button></div><div class="category-tabs" role="group" aria-label="配件分類">${[['all','全部'],['front','車頭'],['seat','座墊'],['luggage','載物'],['rear','車尾']].map(([id,name])=>`<button data-category="${id}" class="${id==='all'?'active':''}" aria-pressed="${id==='all'}">${name}</button>`).join('')}</div><div id="parts-list" class="parts-list"></div></section>
      <div class="panel-footer"><div class="build-summary"><span><span class="status-dot"></span><strong id="summary-count">原廠素車</strong></span><button id="compare" aria-pressed="false">${icon('columns-2')}<span>原廠對照</span></button></div><button id="build-details" class="button primary-button">查看我的改裝方案 ${icon('arrow-right')}</button><p>${icon('shield-check')}外觀搭配預覽 · 實際適用性請確認商品規格</p></div>
    </aside>
  </main>
  <div id="toast" class="toast" role="status" aria-live="polite"></div>
  <dialog id="info-dialog" class="modal reference-modal" aria-labelledby="reference-heading">
    <div class="modal-head"><span class="eyebrow">PHOTO REFERENCES</span><button class="close-modal" aria-label="關閉">${icon('x')}</button></div>
    <h2 id="reference-heading">從實車樣貌出發</h2>
    <p class="reference-intro">以 Honda 台灣 2025 Rebel 500 為基礎，搭配日本官網多角度照片，重建輪廓、材質與色彩。</p>
    <figure class="reference-gallery">
      <div class="reference-image"><img id="reference-photo" src="/references/${REFERENCES[0].file}" alt="${REFERENCES[0].alt}"><span id="reference-type" class="reference-type">${REFERENCES[0].type}</span></div>
      <figcaption class="reference-caption" aria-live="polite" aria-atomic="true"><div><strong id="reference-title">${REFERENCES[0].label}</strong><p id="reference-note">${REFERENCES[0].note}</p></div><a id="reference-source" href="${REFERENCES[0].url}" target="_blank" rel="noopener noreferrer"><span>${REFERENCES[0].source}</span>${icon('arrow-up-right')}</a></figcaption>
    </figure>
    <div class="reference-thumbnails" role="group" aria-label="選擇官方參考照片">${REFERENCES.map((ref,index)=>`<button class="reference-thumb ${index===0?'active':''} ${ref.id==='cowl'?'accessory-reference':''}" data-reference="${ref.id}" aria-label="查看${ref.label}：${ref.type}" aria-pressed="${index===0}" aria-controls="reference-photo"><img src="/references/${ref.file}" alt="" loading="lazy"><span>${ref.label}</span></button>`).join('')}</div>
    <p class="reference-scope">前六張為標準車造型與細節；頭燈罩照片為 S 版配備／一般版選配。日本照片用於補足角度，各地車色與配備可能不同。</p>
    <div class="info-callout"><strong>照片參考，持續接近實車</strong><p>這是可旋轉、可試裝配件的 3D 外觀重建。未取得原廠 CAD 或實車掃描，隱藏結構與配件位置仍為估算；安裝孔位及適用性需依商品規格確認。</p></div>
    <dl class="spec-table"><div><dt>原廠車長 × 寬 × 高</dt><dd>2,205 × 820 × 1,090 mm</dd></div><div><dt>軸距</dt><dd>1,490 mm</dd></div><div><dt>座高</dt><dd>690 mm</dd></div><div><dt>前／後輪胎</dt><dd>130/90-16 · 150/80-16</dd></div></dl>
    <p class="source-credit">官方照片 © Honda Motor Co., Ltd.，用於本地設計參考。配件模型為自製外觀示意。</p><div class="reference-links"><a class="source-link" href="${SOURCE_URL}" target="_blank" rel="noopener noreferrer">Honda 台灣車款資料 ${icon('arrow-up-right')}</a><a class="source-link" href="${HONDA_JAPAN_FEATURES}" target="_blank" rel="noopener noreferrer">Honda 日本細節資料 ${icon('arrow-up-right')}</a></div>
  </dialog>
  <dialog id="build-dialog" class="modal build-modal"><div class="modal-head"><span class="eyebrow">YOUR CUSTOM BUILD</span><button class="close-modal" aria-label="關閉">${icon('x')}</button></div><h2>你的 Rebel 500</h2><p class="modal-intro">把喜歡的搭配留下來，下次繼續想像。</p><div id="build-preview"></div><div id="build-list"></div><div class="export-buttons"><button id="download-config" class="button">${icon('download')}匯出方案 JSON</button><button id="import-config" class="button">${icon('upload')}匯入方案</button><button id="export-glb" class="button">${icon('box')}匯出 3D 模型 GLB</button><button id="load-saved" class="button">${icon('bookmark')}載入已儲存方案</button></div><p class="export-note">JSON 保留車色與選配；GLB 保留目前改裝配置的模型，單位為公尺，可在 Blender 等軟體中開啟。</p><input id="config-file" type="file" accept=".json,application/json" hidden></dialog>
`;

function refreshIcons(){createIcons({icons,attrs:{'stroke-width':1.6}});}
function toast(message){const el=$('#toast');el.textContent=message;el.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('visible'),3800);}
function download(blob,name){const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
function downloadDataURL(data,name){const link=document.createElement('a');link.href=data;link.download=name;link.click();}
function checkViewer(){if(viewer)return true;toast('3D 預覽尚未就緒，請稍候或重新載入頁面。');return false;}
function setButton(selector,active){const button=$(selector);button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));}
function setCompare(value){compare=value;$('#compare-label').hidden=!compare;setButton('#compare',compare);$('#compare span').textContent=compare?'返回改裝':'原廠對照';viewer?.setConfig(config,compare);}
function renderParts(){
  const list=PARTS.filter(part=>category==='all'||part.category===category);
  $('#parts-list').innerHTML=list.map(part=>{
    const installed=config.parts.includes(part.id);
    return `<button class="part-card ${installed?'installed':''}" data-part="${part.id}" aria-pressed="${installed}" aria-label="${installed?'卸下':'加裝'}${part.name}"><span class="part-image">${thumbs[part.id]?`<img src="${thumbs[part.id]}" alt="" draggable="false">`:icon('box')}<span class="part-installed-label">已加裝</span></span><span class="part-copy"><span class="part-en">${part.en}</span><strong>${part.name}</strong><span class="part-description">${part.note}</span><span class="part-source">${part.source}</span></span><span class="part-action">${icon(installed?'check':'plus')}</span></button>`;
  }).join('');
  refreshIcons();
}
function update(){
  const color=COLORS.find(c=>c.id===config.color);
  $('#paint-name').textContent=color.name;
  $('#paint-note').textContent=color.factory?'依官方黑色車款參考 · 螢幕顏色僅供示意':'自訂烤漆概念色 · 非台灣原廠販售色保證';
  document.querySelectorAll('[data-color]').forEach(button=>{const selected=button.dataset.color===config.color;button.classList.toggle('active',selected);button.setAttribute('aria-pressed',String(selected));});
  $('#installed-count').textContent=config.parts.length;
  $('#summary-count').textContent=config.parts.length?`${config.parts.length} 件配件已加裝`:'原廠素車';
  $('#remove-all').disabled=config.parts.length===0;
  const unchanged=saved&&JSON.stringify(saved)===JSON.stringify(config);
  $('#save-build span').textContent=unchanged?'已儲存':'儲存方案';
  viewer?.setConfig(config,compare);renderParts();
}

function showDialog(id){$(id).showModal();}
function showBuild(){
  const color=COLORS.find(c=>c.id===config.color);
  if(viewer){const wasCompare=compare;viewer.setConfig(config,false);$('#build-preview').innerHTML=`<img src="${viewer.capture()}" alt="目前的 Rebel 500 改裝配置預覽">`;viewer.setConfig(config,wasCompare);}
  $('#build-list').innerHTML=`<div class="build-color"><span style="background:${color.hex}"></span><strong>${color.name}</strong><small>${color.label}</small></div>${config.parts.length?`<ul>${PARTS.filter(p=>config.parts.includes(p.id)).map(p=>`<li>${icon('check')}<span>${p.name}</span><small>${p.source}</small></li>`).join('')}</ul>`:'<p class="empty-build">目前保留素車輪廓，還沒有選配配件。</p>'}`;
  $('#load-saved').disabled=!saved;refreshIcons();showDialog('#build-dialog');
}

document.addEventListener('click',event=>{
  const reference=event.target.closest('[data-reference]');
  if(reference){const item=REFERENCES.find(ref=>ref.id===reference.dataset.reference);if(!item)return;const photo=$('#reference-photo');photo.src=`/references/${item.file}`;photo.alt=item.alt;$('#reference-title').textContent=item.label;$('#reference-note').textContent=item.note;$('#reference-type').textContent=item.type;$('#reference-type').classList.toggle('is-accessory',item.id==='cowl');const source=$('#reference-source');source.href=item.url;source.querySelector('span').textContent=item.source;document.querySelectorAll('[data-reference]').forEach(button=>{const active=button===reference;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});return;}
  const part=event.target.closest('[data-part]');
  if(part){const id=part.dataset.part;const installing=!config.parts.includes(id);const result=togglePart(config,id);config=result.config;setCompare(false);update();const name=PARTS.find(p=>p.id===id).name;toast(result.removed.length?`已加裝${name}，並卸下${PARTS.find(p=>p.id===result.removed[0]).name}`:`已${installing?'加裝':'卸下'}${name}`);return;}
  const paint=event.target.closest('[data-color]');if(paint){config={...config,color:paint.dataset.color};update();return;}
  const tab=event.target.closest('[data-category]');if(tab){category=tab.dataset.category;document.querySelectorAll('[data-category]').forEach(button=>{const active=button.dataset.category===category;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});renderParts();return;}
  const view=event.target.closest('[data-view]');if(view&&checkViewer()){viewer.setView(view.dataset.view);autoRotate=false;setButton('#auto-rotate',false);document.querySelectorAll('[data-view]').forEach(b=>{const active=b===view;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});return;}
  if(event.target.closest('.close-modal'))event.target.closest('dialog').close();
});

for(const id of ['#accuracy-info','#model-info','#open-specs'])$(id).addEventListener('click',()=>showDialog('#info-dialog'));
$('#build-details').addEventListener('click',showBuild);
$('#save-build').addEventListener('click',()=>{try{storage.setItem('rebel500-build-v1',JSON.stringify(config));saved=validateConfig(config);update();toast('改裝方案已儲存在這個瀏覽器');}catch{toast('此瀏覽器無法儲存，請使用「匯出方案 JSON」保留配置。');}});
$('#remove-all').addEventListener('click',()=>{config={...config,parts:[]};setCompare(false);update();toast('已卸下所有配件，保留目前車色');});
$('#compare').addEventListener('click',()=>setCompare(!compare));
$('#dimensions').addEventListener('click',()=>{if(!checkViewer())return;dimensions=!dimensions;viewer.setDimensions(dimensions);setButton('#dimensions',dimensions);});
$('#lights').addEventListener('click',()=>{if(!checkViewer())return;lights=!lights;viewer.setLights(lights);setButton('#lights',lights);});
$('#zoom-in').addEventListener('click',()=>{if(checkViewer())viewer.zoom(.85);});
$('#zoom-out').addEventListener('click',()=>{if(checkViewer())viewer.zoom(1.15);});
$('#reset-view').addEventListener('click',()=>{if(!checkViewer())return;viewer.reset();autoRotate=false;setButton('#auto-rotate',false);document.querySelector('[data-view="perspective"]').click();});
$('#auto-rotate').addEventListener('click',()=>{if(!checkViewer())return;autoRotate=!autoRotate;viewer.setAutoRotate(autoRotate);setButton('#auto-rotate',autoRotate);});
$('#screenshot').addEventListener('click',()=>{if(!checkViewer())return;downloadDataURL(viewer.capture(),'rebel-500-studio.png');toast('已下載目前視角 PNG');});
function setScene(enabled){dark=enabled;$('.studio').classList.toggle('dark-scene',dark);viewer?.setDark(dark);setButton('#dark-studio',dark);setButton('#light-studio',!dark);$('#scene-name').textContent=dark?'夜色攝影棚':'日光攝影棚';}
$('#light-studio').addEventListener('click',()=>setScene(false));$('#dark-studio').addEventListener('click',()=>setScene(true));
$('#download-config').addEventListener('click',()=>{download(new Blob([JSON.stringify(config,null,2)],{type:'application/json'}),'rebel-500-build.json');toast('改裝方案已匯出');});
$('#import-config').addEventListener('click',()=>$('#config-file').click());
$('#config-file').addEventListener('change',async event=>{const file=event.target.files[0];if(!file)return;try{if(file.size>50000)throw new Error('方案檔案過大，請選擇本工作室匯出的 JSON。');config=validateConfig(JSON.parse(await file.text()));setCompare(false);update();showBuild();toast('改裝方案已載入');}catch(error){toast(error instanceof SyntaxError?'無法讀取 JSON，請確認檔案格式。':error.message);}finally{event.target.value='';}});
$('#load-saved').addEventListener('click',()=>{const value=readSaved(storage);if(!value){toast('找不到可載入的已儲存方案');return;}config=value;setCompare(false);update();showBuild();toast('已載入儲存的改裝方案');});
$('#export-glb').addEventListener('click',async()=>{
  if(!checkViewer())return;const button=$('#export-glb');button.disabled=true;button.textContent='正在建立 GLB…';
  try{viewer.setConfig(config,false);const result=await viewer.exportGLB();download(new Blob([result],{type:'model/gltf-binary'}),'rebel-500-custom.glb');toast('3D 模型已匯出，單位為公尺');}
  catch(error){console.error(error);toast('匯出失敗，請稍後重試。');}
  finally{viewer.setConfig(config,compare);button.disabled=false;button.innerHTML=`${icon('box')}匯出 3D 模型 GLB`;refreshIcons();}
});
for(const dialog of document.querySelectorAll('dialog'))dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
update();refreshIcons();
function showError(error){console.error(error);$('#loading').hidden=false;$('#loading').innerHTML=`${icon('circle-alert')}<strong>3D 預覽無法啟動</strong><small>請使用支援 WebGL 2 的瀏覽器，並開啟硬體加速。</small><button class="button" id="retry-viewer">重新載入</button>`;$('#retry-viewer').addEventListener('click',()=>location.reload());refreshIcons();}
try{
  viewer=createViewer($('#viewport'),api=>{
    viewer=api;viewer.setConfig(config);thumbs=viewer.thumbnails();$('#loading').hidden=true;renderParts();
    viewer.controls.addEventListener('start',()=>{document.querySelectorAll('[data-view]').forEach(b=>{b.classList.remove('active');b.setAttribute('aria-pressed','false');});document.querySelector('[data-view="perspective"]').classList.add('active');document.querySelector('[data-view="perspective"]').setAttribute('aria-pressed','true');});
    // Read-only diagnostics for validating real scene state in browser QA.
    window.rebelStudio={getConfig:()=>structuredClone(config),getStatus:()=>({ready:true,compare,dimensions,dark,parts:Object.fromEntries(Object.entries(viewer.bike.parts).map(([id,g])=>[id,g.visible])),stockSeat:viewer.bike.stockSeat.visible,camera:viewer.camera.position.toArray(),drawCalls:viewer.renderer.info.render.calls,triangles:viewer.renderer.info.render.triangles,scale:viewer.bike.stats})};
  },showError);
}catch(error){showError(error);}

