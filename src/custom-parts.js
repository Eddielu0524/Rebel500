export const MAX_CUSTOM_PARTS = 12;
export const MAX_IMAGE_DATA_LENGTH = 1.5 * 1024 * 1024;

const freezeTemplate = value => Object.freeze({ ...value, size:Object.freeze(value.size), position:Object.freeze(value.position), rotation:Object.freeze(value.rotation) });
export const CUSTOM_TEMPLATES = Object.freeze([
  {id:'bag',name:'側掛包',note:'依照片外觀選擇的通用包款；商品照片僅留作參考。',size:[.36,.29,.17],position:[.68,.51,.28],rotation:[0,0,0],material:'leather',color:'#362b25',usesImage:false},
  {id:'windshield',name:'風鏡',note:'有弧度的通用風鏡，可調整大小與安裝角度。',size:[.10,.30,.34],position:[-.53,1.045,0],rotation:[0,0,0],material:'smoke',color:'#687779',usesImage:false},
  {id:'seat',name:'坐墊',note:'通用單人坐墊外形；請依車上位置調整。',size:[.42,.095,.33],position:[.34,.708,0],rotation:[0,0,0],material:'leather',color:'#352822',usesImage:false},
  {id:'backrest',name:'後靠背',note:'含支桿與靠墊的通用後靠背。',size:[.06,.35,.25],position:[.92,.895,0],rotation:[0,0,0],material:'leather',color:'#202121',usesImage:false},
  {id:'rack',name:'後貨架',note:'通用管狀貨架；尺寸不代表實際鎖點。',size:[.32,.08,.29],position:[.925,.765,0],rotation:[0,0,0],material:'satin',color:'#25292a',usesImage:false},
  {id:'box',name:'收納箱',note:'通用硬殼箱；商品照片僅留作參考，不會貼在模型上。',size:[.36,.29,.31],position:[.80,.91,0],rotation:[0,0,0],material:'matte',color:'#25292a',usesImage:false},
  {id:'photo',name:'照片平面',note:'將照片顯示為平面參考貼片，不是從照片重建的立體模型。',size:[.28,.24,.01],position:[.55,.52,.30],rotation:[0,0,0],material:'matte',color:'#ffffff',usesImage:true},
].map(freezeTemplate));

export const MATERIAL_OPTIONS = Object.freeze([
  {id:'gloss',name:'亮面烤漆'}, {id:'satin',name:'緞面烤漆'}, {id:'matte',name:'消光'},
  {id:'leather',name:'皮革'}, {id:'metal',name:'金屬'}, {id:'smoke',name:'燻黑透明'},
].map(Object.freeze));

const templates = new Map(CUSTOM_TEMPLATES.map(template => [template.id,template]));
const materialIds = new Set(MATERIAL_OPTIONS.map(material => material.id));

export function safeSourceUrl(value = '') {
  if (typeof value !== 'string') throw new Error('商品網址必須是文字。');
  const text = value.trim();
  if (!text) return '';
  if (text.length > 4096 || /[\u0000-\u0020\u007f]/.test(text)) throw new Error('商品網址格式不正確或過長。');
  let url;
  try { url = new URL(text); } catch { throw new Error('請輸入完整的 http 或 https 商品網址。'); }
  if (!['http:','https:'].includes(url.protocol) || !url.hostname || url.username || url.password) {
    throw new Error('商品網址僅支援不含帳號密碼的 http 或 https 連結。');
  }
  return url.href;
}

function imageData(value) {
  if (value === undefined || value === '') return '';
  if (typeof value !== 'string' || value.length > MAX_IMAGE_DATA_LENGTH) throw new Error('照片過大，請縮小後再加入（資料上限 1.5 MiB）。');
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match || match[2].length % 4 !== 0) throw new Error('照片僅支援 PNG、JPEG 或 WebP 圖檔。');
  // Inspect the actual signature rather than trusting a renamed MIME prefix.
  const bytes = atob(match[2].slice(0,32));
  const signature = [...bytes].map(char => char.charCodeAt(0));
  const png = [137,80,78,71,13,10,26,10].every((byte,index) => signature[index] === byte);
  const jpeg = signature[0] === 255 && signature[1] === 216 && signature[2] === 255;
  const webp = bytes.startsWith('RIFF') && bytes.slice(8,12) === 'WEBP';
  if (!(match[1] === 'png' && png || match[1] === 'jpeg' && jpeg || match[1] === 'webp' && webp)) throw new Error('照片內容與圖檔格式不符。');
  return value;
}

function vector(value, limits, label) {
  if (!Array.isArray(value) || value.length !== 3) throw new Error(`${label}必須包含 X、Y、Z 三個數值。`);
  return value.map((number,index) => {
    if (typeof number !== 'number' || !Number.isFinite(number) || number < limits[index][0] || number > limits[index][1]) throw new Error(`${label}超出可調整範圍。`);
    return Object.is(number,-0) ? 0 : number;
  });
}

function validatePart(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('自訂配件格式不正確。');
  if (typeof input.id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(input.id)) throw new Error('自訂配件識別碼不正確。');
  if (typeof input.name !== 'string' || !input.name.trim() || input.name.trim().length > 80) throw new Error('配件名稱必須為 1 至 80 個字元。');
  if (!templates.has(input.template)) throw new Error('不支援此配件外形。');
  if (!materialIds.has(input.material)) throw new Error('不支援此配件材質。');
  if (typeof input.color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(input.color)) throw new Error('配件色彩必須是六位十六進位色碼。');
  if (typeof input.installed !== 'boolean') throw new Error('配件安裝狀態必須是布林值。');
  return {
    id:input.id,name:input.name.trim(),sourceUrl:safeSourceUrl(input.sourceUrl),imageData:imageData(input.imageData),
    template:input.template,material:input.material,color:input.color.toLowerCase(),
    position:vector(input.position,[[-1.5,1.5],[0,1.8],[-1,1]],'位置'),
    rotation:vector(input.rotation,[[-180,180],[-180,180],[-180,180]],'旋轉角度'),
    size:vector(input.size,[[.01,1.5],[.01,1.5],[.01,1.5]],'尺寸'),installed:input.installed,
  };
}

export function validateCustomParts(input) {
  if (!Array.isArray(input) || input.length > MAX_CUSTOM_PARTS) throw new Error(`最多可加入 ${MAX_CUSTOM_PARTS} 件自訂配件。`);
  const result = input.map(validatePart), ids = new Set();
  for (const part of result) {
    if (ids.has(part.id)) throw new Error('自訂配件識別碼不可重複。');
    ids.add(part.id);
  }
  return result;
}

let sequence = 0;
export function createCustomPart(options = {}) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) throw new Error('自訂配件設定不正確。');
  const template = templates.get(options.template ?? 'bag');
  if (!template) throw new Error('不支援此配件外形。');
  const id = globalThis.crypto?.randomUUID?.() ?? `part-${Date.now().toString(36)}-${(++sequence).toString(36)}`;
  return validatePart({
    id,name:template.name,sourceUrl:'',imageData:'',template:template.id,material:template.material,color:template.color,
    position:[...template.position],rotation:[...template.rotation],size:[...template.size],installed:true,...options,
  });
}
