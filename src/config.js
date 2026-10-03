import { validateCustomParts } from './custom-parts.js';

export const SOURCE_URL = 'https://moto.honda-taiwan.com.tw/motor/Detail/681dd145-be45-4248-a34e-8c554ccc8e8b';

export const SPEC = Object.freeze({ length: 2.205, width: 0.820, height: 1.090, wheelbase: 1.490, seatHeight: 0.690, frontRadius: .2032 + .130 * .90, rearRadius: .2032 + .150 * .80 });

export const COLORS = [
  { id: 'black', name: '石墨黑', hex: '#090b0d', label: 'GRAPHITE BLACK', factory: true },
  { id: 'ivory', name: '沙丘米白', hex: '#bcb8a7', label: 'DUNE IVORY', factory: false },
  { id: 'green', name: '森林綠', hex: '#4b5d4e', label: 'FOREST GREEN', factory: false },
  { id: 'red', name: '酒釀紅', hex: '#713b3d', label: 'OXBLOOD RED', factory: false },
  { id: 'blue', name: '霧海藍', hex: '#526675', label: 'DUSK BLUE', factory: false },
];

export const PARTS = [
  { id: 'cowl', name: '復古頭燈罩', en: 'HEADLIGHT COWL', category: 'front', note: '收攏車頭線條，強化 Bobber 輪廓', source: '原廠配件造型參考', conflicts: ['windshield'] },
  { id: 'windshield', name: '燻黑短風鏡', en: 'SMOKED WINDSCREEN', category: 'front', note: '輕量的視覺延伸，保留圓燈個性', source: '通用概念配件', conflicts: ['cowl'] },
  { id: 'gaiters', name: '前叉防塵護套', en: 'FORK GAITERS', category: 'front', note: '黑色風琴紋，補上復古細節', source: '原廠配件造型參考' },
  { id: 'brownSeat', name: '棕色菱格坐墊', en: 'QUILTED SADDLE', category: 'seat', note: '溫暖皮革色，搭配細緻菱格紋', source: '原廠配件造型參考' },
  { id: 'pillion', name: '後座坐墊', en: 'PASSENGER SEAT', category: 'seat', note: '從單座輪廓切換成雙座配置', source: '原廠配件造型參考' },
  { id: 'saddlebags', name: '雙側皮革馬鞍包', en: 'LEATHER SADDLEBAGS', category: 'luggage', note: '左右成組，預覽含側包支架', source: '原廠配件造型參考' },
  { id: 'backrest', name: '乘客後靠背', en: 'PASSENGER BACKREST', category: 'rear', note: '窄版黑色支架，增加車尾層次', source: '原廠配件造型參考' },
  { id: 'rack', name: '輕旅行後貨架', en: 'REAR CARRIER', category: 'rear', note: '黑色管狀貨架，延伸載物空間', source: '原廠配件造型參考' },
];

export const FINISHES = [{id:'gloss',name:'亮光',label:'GLOSS'}, {id:'satin',name:'緞光',label:'SATIN'}, {id:'matte',name:'消光',label:'MATTE'}];
export const DEFAULT_CONFIG = Object.freeze({ version: 2, color: 'black', finish: 'gloss', parts: [], customParts: [] });

export function validateConfig(input) {
  if (!input || ![1,2].includes(input.version) || !COLORS.some(c => c.id === input.color) || !Array.isArray(input.parts)) throw new Error('方案格式不正確，請匯入本工作室匯出的 JSON 檔。');
  const ids = new Set(PARTS.map(p => p.id));
  if (input.parts.some(id => !ids.has(id)) || new Set(input.parts).size !== input.parts.length) throw new Error('方案包含不支援或重複的配件。');
  for (const part of PARTS) if (input.parts.includes(part.id) && part.conflicts?.some(id => input.parts.includes(id))) throw new Error('方案同時包含互斥配件，請檢查頭燈罩與風鏡。');
  const finish = input.finish ?? 'gloss';
  if (!FINISHES.some(f=>f.id===finish)) throw new Error('不支援此車漆塗層。');
  return { version: 2, color: input.color, finish, parts: [...input.parts], customParts: validateCustomParts(input.customParts ?? []) };
}

export function togglePart(config, id) {
  const part = PARTS.find(p => p.id === id);
  if (!part) throw new Error('找不到此配件');
  const parts = new Set(config.parts);
  const removed = [];
  if (parts.has(id)) parts.delete(id);
  else {
    for (const conflict of part.conflicts || []) if (parts.delete(conflict)) removed.push(conflict);
    parts.add(id);
  }
  return { config: { ...config, parts: [...parts] }, removed };
}

export function readSaved(storage) {
  try {
    const value = storage.getItem('rebel500-build-v1');
    return value ? validateConfig(JSON.parse(value)) : null;
  } catch { return null; }
}
