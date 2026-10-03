import { CUSTOM_TEMPLATES, MATERIAL_OPTIONS, createCustomPart, validateCustomParts, safeSourceUrl } from './custom-parts.js';

export const escapeHTML = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const templateName = id => CUSTOM_TEMPLATES.find(t=>t.id===id)?.name || id;

// Images stay in the browser and are embedded in the exported configuration.
async function readPhoto(file) {
  if (!['image/jpeg','image/png','image/webp'].includes(file.type)) throw Error('請選擇 JPG、PNG 或 WebP 圖片。');
  if (file.size > 10 * 1024 * 1024) throw Error('圖片請小於 10 MB。');
  const url = URL.createObjectURL(file);
  try {
    const img = new Image(); img.src = url;
    await img.decode();
    if (!img.naturalWidth || !img.naturalHeight) throw Error('無法讀取這張圖片。');
    const scale = Math.min(1, 1024 / Math.max(img.naturalWidth,img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1,Math.round(img.naturalWidth*scale)); canvas.height = Math.max(1,Math.round(img.naturalHeight*scale));
    canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
    const data = canvas.toDataURL('image/webp',.86);
    if (data.length > 1500000) throw Error('圖片壓縮後仍過大，請裁切商品範圍再試一次。');
    return data;
  } finally { URL.revokeObjectURL(url); }
}

export function createCustomPartsUI({getParts,onChange,onPreview,onEndPreview,toast}) {
  let draft = null, editingId = null, generation = 0, loading = false, deleted = null;
  const dialog = document.createElement('dialog');
  dialog.id = 'custom-editor'; dialog.className = 'custom-editor';
  dialog.setAttribute('aria-labelledby','custom-editor-title');
  dialog.innerHTML = `
    <div class="editor-head"><div><span class="eyebrow">YOUR ACCESSORY LAB</span><h2 id="custom-editor-title">新增自己的配件</h2></div><button type="button" id="custom-cancel" aria-label="取消配件編輯">✕</button></div>
    <form id="custom-form">
      <div class="editor-scroll">
        <p class="editor-intro">貼上商品網址、放入參考圖片，再選擇外形試裝。調整時可以直接旋轉左方車輛。</p>
        <label class="editor-field">配件名稱<input id="custom-name" maxlength="80" required placeholder="例如：短版皮革側包"></label>
        <label class="editor-field">商品網站網址 <span>選填</span><input id="custom-url" type="url" maxlength="2048" placeholder="https://…" inputmode="url"></label>
        <p class="field-note">網址保留商品來源；網站圖片請另行上傳，不會自動轉成精確 3D 模型。</p>
        <div id="custom-drop" class="custom-drop" tabindex="0" role="group" aria-label="拖放或貼上配件圖片">
          <img id="custom-photo" alt="配件參考圖片" hidden><div><strong id="photo-label">拖放圖片，或在這裡貼上</strong><small>JPG / PNG / WebP · 最大 10 MB</small><button type="button" id="custom-upload" class="button">選擇圖片</button><button type="button" id="custom-clear-photo" class="text-button" hidden>移除圖片</button></div>
        </div>
        <input id="custom-image-file" type="file" accept="image/jpeg,image/png,image/webp" hidden>
        <div class="editor-grid"><label class="editor-field">試裝外形<select id="custom-template">${CUSTOM_TEMPLATES.map(t=>`<option value="${t.id}">${escapeHTML(t.name)}</option>`).join('')}</select></label><label class="editor-field">表面材質<select id="custom-material">${MATERIAL_OPTIONS.map(m=>`<option value="${m.id}">${escapeHTML(m.name)}</option>`).join('')}</select></label></div>
        <p class="field-note" id="custom-template-note"></p>
        <div class="editor-color"><label for="custom-color">配件色彩</label><input id="custom-color" type="color" value="#252525"><span id="custom-color-value"></span></div>
        <details open class="editor-adjust"><summary>位置與尺寸 <span>即時試擺</span></summary>
          <div class="anchor-row"><span>快速定位</span><button type="button" data-anchor="left">左側</button><button type="button" data-anchor="right">右側</button><button type="button" data-anchor="front">車頭</button><button type="button" data-anchor="rear">車尾</button></div>
          <div id="custom-transforms"></div>
          <button type="button" id="custom-reset" class="text-button">重設此外形的位置與尺寸</button>
        </details>
        <p class="custom-error" id="custom-error" role="status" aria-live="polite"></p>
        <p class="field-note editor-privacy">圖片僅留在你的瀏覽器。加入後按「儲存方案」保留，或匯出 JSON 備份。</p>
      </div>
      <div class="editor-footer"><button type="button" id="custom-back" class="button">取消</button><button type="submit" id="custom-submit" class="button primary-button">加入並試裝</button></div>
    </form>`;
  document.body.append(dialog);
  const $ = selector => dialog.querySelector(selector);
  const error = message => {$('#custom-error').textContent=message;};
  const transformGroups = [
    {key:'position',title:'位置 · cm',labels:['前後（−前／＋後）','離地高度','左右（−左／＋右）'],bounds:[[-150,150],[0,180],[-100,100]],factor:100,step:1},
    {key:'size',title:'尺寸 · cm',labels:['前後長度','上下高度','左右寬度'],bounds:[[1,150],[1,150],[1,150]],factor:100,step:1},
    {key:'rotation',title:'旋轉 · °',labels:['側傾','水平轉向','俯仰'],bounds:[[-180,180],[-180,180],[-180,180]],factor:1,step:1},
  ];
  $('#custom-transforms').innerHTML=transformGroups.map(g=>`<fieldset><legend>${g.title}</legend>${g.labels.map((label,i)=>`<div class="transform-row"><label for="custom-${g.key}-${i}">${label}</label><input type="range" aria-label="${label}滑桿" data-transform="${g.key}" data-axis="${i}" min="${g.bounds[i][0]}" max="${g.bounds[i][1]}" step="${g.step}"><input type="number" id="custom-${g.key}-${i}" aria-label="${label}" data-transform="${g.key}" data-axis="${i}" min="${g.bounds[i][0]}" max="${g.bounds[i][1]}" step="any" required></div>`).join('')}</fieldset>`).join('');

  function preview() {
    if(!draft)return;
    try { const part=validateCustomParts([draft])[0];onPreview(part,editingId);error(''); }
    catch(e){error(e.message);}
  }
  function sync() {
    $('#custom-name').value=draft.name; $('#custom-url').value=draft.sourceUrl;
    $('#custom-template').value=draft.template; $('#custom-material').value=draft.material;
    $('#custom-color').value=draft.color; $('#custom-color-value').textContent=draft.color.toUpperCase();
    const img=$('#custom-photo');img.hidden=!draft.imageData;
    if(draft.imageData)img.src=draft.imageData;else img.removeAttribute('src');
    $('#photo-label').textContent=draft.imageData?'已加入參考圖片':'拖放圖片，或在這裡貼上';
    $('#custom-clear-photo').hidden=!draft.imageData;
    $('#custom-template-note').textContent=draft.template==='photo'?'圖片貼片是平面參考，會顯示在車上；透明背景 PNG 可用來比對輪廓。':'3D 外形用來比較尺寸與搭配；上傳的圖片保留為參考，不會直接包覆在模型上。';
    for(const g of transformGroups) dialog.querySelectorAll(`[data-transform="${g.key}"]`).forEach(el=>{el.value=Number((draft[g.key][Number(el.dataset.axis)]*g.factor).toFixed(2));});
    $('#custom-submit').disabled=loading;
  }
  function close(){dialog.close();}
  dialog.addEventListener('close',()=>{generation++;draft=null;loading=false;onEndPreview();});
  dialog.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();close();}});
  $('#custom-cancel').onclick=close;$('#custom-back').onclick=close;
  $('#custom-upload').onclick=()=>$('#custom-image-file').click();
  async function addPhoto(file) {
    if(!file||!draft)return;
    const token=++generation;loading=true;sync();error('正在處理圖片…');
    try {const data=await readPhoto(file);if(token!==generation||!draft)return;draft.imageData=data;sync();preview();}
    catch(e){if(token===generation)error(e.message||'無法讀取圖片，請再選一次。');}
    finally {if(token===generation){loading=false;$('#custom-submit').disabled=false;}}
  }
  $('#custom-image-file').onchange=e=>{addPhoto(e.target.files[0]);e.target.value='';};
  $('#custom-clear-photo').onclick=()=>{generation++;loading=false;draft.imageData='';sync();preview();};
  const drop=$('#custom-drop');
  for(const name of ['dragenter','dragover'])drop.addEventListener(name,e=>{e.preventDefault();drop.classList.add('dragging');});
  for(const name of ['dragleave','drop'])drop.addEventListener(name,e=>{e.preventDefault();drop.classList.remove('dragging');});
  drop.addEventListener('drop',e=>addPhoto(e.dataTransfer.files[0]));
  dialog.addEventListener('paste',e=>{const file=[...e.clipboardData.items].find(i=>i.kind==='file')?.getAsFile();if(file){e.preventDefault();addPhoto(file);}else if(e.target===drop){const text=e.clipboardData.getData('text/plain');try{draft.sourceUrl=safeSourceUrl(text);$('#custom-url').value=draft.sourceUrl;error('已加入商品連結，選擇外形即可試裝。');}catch(err){error(err.message);}}});
  $('#custom-name').oninput=e=>{draft.name=e.target.value;};
  $('#custom-url').oninput=e=>{draft.sourceUrl=e.target.value;};
  $('#custom-template').onchange=e=>{
    const next=createCustomPart({template:e.target.value});
    Object.assign(draft,{template:next.template,size:next.size,position:next.position,rotation:next.rotation,material:next.material,color:next.color});
    sync();preview();
  };
  $('#custom-material').onchange=e=>{draft.material=e.target.value;preview();};
  $('#custom-color').oninput=e=>{draft.color=e.target.value;$('#custom-color-value').textContent=draft.color.toUpperCase();preview();};
  $('#custom-reset').onclick=()=>{const next=createCustomPart({template:draft.template});for(const key of ['position','size','rotation'])draft[key]=next[key];sync();preview();};
  dialog.addEventListener('input',e=>{
    const el=e.target;if(!el.dataset.transform||!el.validity.valid||el.value==='')return;
    const group=transformGroups.find(g=>g.key===el.dataset.transform),axis=Number(el.dataset.axis);
    draft[group.key][axis]=Number(el.value)/group.factor;
    dialog.querySelectorAll(`[data-transform="${group.key}"][data-axis="${axis}"]`).forEach(other=>{if(other!==el)other.value=el.value;});preview();
  });
  dialog.addEventListener('click',e=>{const anchor=e.target.closest('[data-anchor]');if(!anchor)return;draft.position=({left:[.55,.52,-.31],right:[.55,.52,.31],front:[-.8,.99,0],rear:[.9,.84,0]})[anchor.dataset.anchor];sync();preview();});
  $('#custom-form').onsubmit=e=>{
    e.preventDefault();if(loading||!draft)return;
    try {
      draft.name=$('#custom-name').value;draft.sourceUrl=safeSourceUrl($('#custom-url').value);
      if(draft.template==='photo'&&!draft.imageData)throw Error('圖片貼片需要先加入一張圖片。');
      const parts=getParts().filter(p=>p.id!==editingId);parts.push({...draft,installed:true});
      onChange(validateCustomParts(parts));close();toast(editingId?'配件已更新並試裝':'配件已加入，可以繼續調整或卸下');
    }catch(e){error(e.message);}
  };

  function open(id) {
    if(!id&&getParts().length>=12){toast('配件庫最多 12 件，請先刪除不需要的配件。');return;}
    if(dialog.open)return;
    editingId=id||null;draft=id?structuredClone(getParts().find(p=>p.id===id)):createCustomPart({template:'bag'});
    if(!draft)return;draft.installed=true;
    $('#custom-editor-title').textContent=id?'調整我的配件':'新增自己的配件';
    $('#custom-submit').textContent=id?'套用調整':'加入並試裝';error('');sync();dialog.show();preview();
    if(matchMedia('(max-width:760px)').matches)window.scrollTo({top:0,behavior:'smooth'});
  }
  function cards() {
    const parts=getParts();
    return `<div class="custom-library"><div class="custom-library-heading"><span>我的配件 <small>${parts.length} / 12</small></span><button type="button" data-custom-add>＋ 新增</button></div>${parts.length?parts.map(p=>`<article class="custom-card ${p.installed?'installed':''}"><div class="custom-thumb">${p.imageData?`<img src="${escapeHTML(p.imageData)}" alt="${escapeHTML(p.name)}參考圖">`:'<span aria-hidden="true">◇</span>'}</div><div class="custom-card-copy"><strong>${escapeHTML(p.name)}</strong><small>${escapeHTML(templateName(p.template))} · ${p.installed?'已加裝':'未加裝'}</small><div><button data-custom-edit="${escapeHTML(p.id)}">調整</button>${p.sourceUrl?`<a href="${escapeHTML(p.sourceUrl)}" target="_blank" rel="noopener noreferrer">來源 ↗</a>`:''}<button data-custom-delete="${escapeHTML(p.id)}" aria-label="刪除${escapeHTML(p.name)}">刪除</button></div></div><button class="custom-install" data-custom-toggle="${escapeHTML(p.id)}" aria-pressed="${p.installed}" aria-label="${p.installed?'卸下':'加裝'}${escapeHTML(p.name)}">${p.installed?'卸下':'加裝'}</button></article>`).join(''):'<p class="custom-empty">把找到的側包、風鏡或坐墊放進車庫，試試它們和 Rebel 的搭配。</p>'}${deleted?'<button class="custom-undo" data-custom-undo>↶ 復原剛才刪除的配件</button>':''}</div>`;
  }
  document.addEventListener('click',e=>{
    if(e.target.closest('[data-custom-add]')){open();return;}
    const edit=e.target.closest('[data-custom-edit]');if(edit){open(edit.dataset.customEdit);return;}
    const toggle=e.target.closest('[data-custom-toggle]');if(toggle){onChange(getParts().map(p=>p.id===toggle.dataset.customToggle?{...p,installed:!p.installed}:p));return;}
    const remove=e.target.closest('[data-custom-delete]');if(remove){deleted=getParts().find(p=>p.id===remove.dataset.customDelete);onChange(getParts().filter(p=>p.id!==remove.dataset.customDelete));toast('配件已移出車庫，可按「復原」取回');return;}
    if(e.target.closest('[data-custom-undo]')&&deleted){if(getParts().some(p=>p.id===deleted.id)){deleted=null;onChange(getParts());toast('此配件已在車庫中');return;}if(getParts().length>=12){toast('配件庫已滿，請先空出一個位置。');return;}const part=deleted;deleted=null;onChange([...getParts(),part]);}
  });
  return {open,cards,isOpen:()=>dialog.open};
}
