import * as THREE from 'three';

// All surface detail uses ordinary glTF-compatible texture maps. No lighting is
// painted into the base colour, so the finish remains readable while orbiting.
const cache = new Map();
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const fract = v => v - Math.floor(v);
const noise = (x, y, seed = 17) => {
  let n = Math.imul(x + seed, 374761393) ^ Math.imul(y + seed * 7, 668265263);
  n = Math.imul(n ^ n >>> 13, 1274126177);
  return ((n ^ n >>> 16) >>> 0) / 4294967295;
};
function smoothNoise(x, y, cells, seed) {
  x *= cells; y *= cells;
  const ix = Math.floor(x), iy = Math.floor(y);
  const sx = fract(x) ** 2 * (3 - 2 * fract(x)), sy = fract(y) ** 2 * (3 - 2 * fract(y));
  const a = noise((ix + cells) % cells, (iy + cells) % cells, seed);
  const b = noise((ix + 1 + cells) % cells, (iy + cells) % cells, seed);
  const c = noise((ix + cells) % cells, (iy + 1 + cells) % cells, seed);
  const d = noise((ix + 1 + cells) % cells, (iy + 1 + cells) % cells, seed);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(a, b, sx), THREE.MathUtils.lerp(c, d, sx), sy);
}
function texture(data, size, tile, name, colour = false) {
  const map = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  map.name = name; map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(1 / tile, 1 / tile);
  map.magFilter = THREE.LinearFilter; map.minFilter = THREE.LinearMipmapLinearFilter;
  map.generateMipmaps = true; map.anisotropy = 8;
  map.colorSpace = colour ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  map.needsUpdate = true;
  return map;
}
function mapsFromFields(heights, roughness, colour, size, tile, name) {
  const normal = new Uint8Array(size * size * 4), rough = new Uint8Array(normal.length);
  const pitch = tile / size;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = y * size + x, k = i * 4;
    const dx = (heights[y * size + (x + 1) % size] - heights[y * size + (x + size - 1) % size]) / (2 * pitch);
    const dy = (heights[((y + 1) % size) * size + x] - heights[((y + size - 1) % size) * size + x]) / (2 * pitch);
    const inverseLength = 1 / Math.hypot(dx, dy, 1);
    normal[k] = Math.round((-dx * inverseLength * .5 + .5) * 255);
    normal[k + 1] = Math.round((-dy * inverseLength * .5 + .5) * 255);
    normal[k + 2] = Math.round((inverseLength * .5 + .5) * 255); normal[k + 3] = 255;
    // glTF's packed metal/rough format: G is roughness, B multiplies metalness.
    rough[k] = rough[k + 2] = rough[k + 3] = 255;
    rough[k + 1] = Math.round(clamp(roughness[i]) * 255);
  }
  const packed = texture(rough, size, tile, name + '_metallic_roughness');
  return {
    normalMap: texture(normal, size, tile, name + '_normal'),
    roughnessMap: packed, metalnessMap: packed,
    ...(colour ? { map: texture(colour, size, tile, name + '_basecolour', true) } : {}),
  };
}
function microSurface(kind) {
  if (cache.has(kind)) return cache.get(kind);
  const size = 256, tile = .08;
  const heights = new Float32Array(size * size), roughness = new Float32Array(heights.length);
  const amplitude = { paint: .000008, powder: .000017, cast: .000042, rubber: .000023, brushed: .000004, plastic: .000012 }[kind] || .000012;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = y * size + x, u = x / size, v = y / size;
    const broad = smoothNoise(u, v, kind === 'paint' ? 40 : 78, 21);
    const fine = noise(x, y, 53);
    const grain = kind === 'brushed' ? noise(0, y, 80) * .78 + fine * .22 : broad * .78 + fine * .22;
    heights[i] = (grain - .5) * amplitude;
    roughness[i] = .91 + .075 * grain + .015 * smoothNoise(u, v, 6, 61);
  }
  const maps = mapsFromFields(heights, roughness, null, size, tile, kind);
  cache.set(kind, maps); return maps;
}

export const PAINT_FINISHES = Object.freeze({
  gloss: Object.freeze({ metalness: .08, roughness: .23, clearcoat: 1, clearcoatRoughness: .105 }),
  satin: Object.freeze({ metalness: .055, roughness: .47, clearcoat: .28, clearcoatRoughness: .39 }),
  matte: Object.freeze({ metalness: .025, roughness: .73, clearcoat: .08, clearcoatRoughness: .66 }),
});
export function applyPaintFinish(material, finish = 'gloss') {
  const id = Object.hasOwn(PAINT_FINISHES, finish) ? finish : 'gloss';
  Object.assign(material, PAINT_FINISHES[id]);
  material.normalScale.setScalar(id === 'gloss' ? .18 : id === 'satin' ? .30 : .43);
  material.clearcoatNormalScale.setScalar(.20);
  material.userData.finish = id;
  return id;
}
export function createPaintMaterial(color) {
  const maps = microSurface('paint');
  const material = new THREE.MeshPhysicalMaterial({
    color, ...maps, clearcoatNormalMap: maps.normalMap, clearcoatRoughnessMap: maps.roughnessMap,
    ior: 1.5, specularIntensity: .85,
  });
  material.name = 'automotive_pigment_and_clearcoat'; material.userData.surfaceUV = 'world';
  applyPaintFinish(material); return material;
}

const PRESETS = {
  powder: { color: '#151719', metalness: .10, roughness: .43, clearcoat: .12, clearcoatRoughness: .38 },
  anodized: { color: '#1b1d20', metalness: .75, roughness: .34 },
  cast: { color: '#333537', metalness: .34, roughness: .64 },
  cover: { color: '#292c2e', metalness: .27, roughness: .39, clearcoat: .16, clearcoatRoughness: .32 },
  rubber: { color: '#18191b', metalness: 0, roughness: .86 },
  plastic: { color: '#121416', metalness: 0, roughness: .49 },
  chrome: { color: '#d1d4d6', metalness: 1, roughness: .17 },
  brushed: { color: '#afb4b7', metalness: .98, roughness: .36, anisotropy: .35 },
  exhaust: { color: '#25272a', metalness: .12, roughness: .51 },
};
export function createSurfaceMaterial(type, overrides = {}) {
  const detail = type === 'cast' ? 'cast' : type === 'rubber' ? 'rubber' : type === 'brushed' || type === 'chrome' ? 'brushed' : type === 'plastic' ? 'plastic' : 'powder';
  const material = new THREE.MeshPhysicalMaterial({ ...PRESETS[type], ...microSurface(detail), ...overrides });
  material.name = overrides.name || type + '_physical_surface';
  material.normalScale.setScalar(type === 'chrome' ? .12 : type === 'brushed' ? .4 : 1);
  material.userData.surfaceUV = 'world';
  return material;
}

export function createLeatherMaterial({ color = '#242322', quilt = false, name = 'leather' } = {}) {
  const key = `leather:${color}:${quilt}`;
  if (!cache.has(key)) {
    const size = 512, tile = .10;
    const heights = new Float32Array(size * size), roughness = new Float32Array(heights.length), colour = new Uint8Array(heights.length * 4);
    const c = new THREE.Color(color).getHexString();
    const rgb = [0, 2, 4].map(start => parseInt(c.slice(start, start + 2), 16));
    const periodicDistance = n => Math.abs(fract(n + .5) - .5);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const i = y * size + x, k = i * 4, u = x / size, v = y / size;
      const grain = smoothNoise(u, v, 96, 43), fine = noise(x, y, 22), patina = smoothNoise(u, v, 8, 36);
      let shade = .94 + .045 * grain + .025 * patina, height = (grain - .5) * .000095 + (fine - .5) * .000020;
      let thread = 0, seam = 0;
      if (quilt) {
        const a = u + v, b = u - v, da = periodicDistance(a), db = periodicDistance(b);
        const puff = Math.pow(Math.max(0, Math.sin(Math.PI * da) * Math.sin(Math.PI * db)), .62);
        seam = Math.max(Math.exp(-((da / .008) ** 2)), Math.exp(-((db / .008) ** 2)));
        // Narrow inset channels with individual offset stitches, not a dark grid.
        const stitchA = Math.abs(da - .008) < .0025 && fract(b * 24) < .53;
        const stitchB = Math.abs(db - .008) < .0025 && fract(a * 24) < .53;
        thread = stitchA || stitchB ? 1 : 0;
        height += .0013 * puff - .00023 * seam + .00013 * thread;
        shade *= 1 - .10 * seam;
      }
      heights[i] = height; roughness[i] = .88 + .07 * grain - .08 * thread;
      for (let channel = 0; channel < 3; channel++) colour[k + channel] = Math.round(clamp(rgb[channel] * shade + thread * (channel === 0 ? 22 : channel === 1 ? 19 : 15), 0, 255));
      colour[k + 3] = 255;
    }
    cache.set(key, mapsFromFields(heights, roughness, colour, size, tile, name));
  }
  const material = new THREE.MeshPhysicalMaterial({ color: '#ffffff', ...cache.get(key), metalness: 0, roughness: quilt ? .70 : .77, sheen: .11, sheenColor: '#887667', sheenRoughness: .82, clearcoat: .035, clearcoatRoughness: .64 });
  material.name = name; material.userData.surfaceUV = quilt ? 'xz' : 'world';
  return material;
}

export function createSmokedScreenMaterial() {
  const material = new THREE.MeshPhysicalMaterial({
    color: '#394641', metalness: 0, roughness: .065,
    transparent: true, opacity: .46, ior: 1.49,
    clearcoat: .55, clearcoatRoughness: .085,
    specularIntensity: .65, side: THREE.DoubleSide, depthWrite: false,
  });
  // Thin alpha-blended acrylic retains the CSS studio behind this transparent
  // canvas. Transmission would sample an opaque offscreen background instead.
  material.name = 'smoked_optical_acrylic';
  return material;
}

// Texture coordinates in metres keep grain consistent on a tiny bracket and a
// full saddlebag. This changes UVs only; all existing vertex positions remain.
export function projectSurfaceUVs(root) {
  root.updateMatrixWorld(true);
  const point = new THREE.Vector3(), normal = new THREE.Vector3(), normalMatrix = new THREE.Matrix3();
  root.traverse(mesh => {
    if (!mesh.isMesh || !mesh.material.userData?.surfaceUV) return;
    const mode = mesh.material.userData.surfaceUV, geometry = mesh.geometry.clone();
    const positions = geometry.getAttribute('position'), normals = geometry.getAttribute('normal');
    const uv = new Float32Array(positions.count * 2);
    normalMatrix.getNormalMatrix(mesh.matrixWorld);
    for (let i = 0; i < positions.count; i++) {
      point.fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld);
      if (normals) normal.fromBufferAttribute(normals, i).applyMatrix3(normalMatrix).normalize(); else normal.set(0, 1, 0);
      const ax = Math.abs(normal.x), ay = Math.abs(normal.y), az = Math.abs(normal.z);
      if (mode === 'xz' || ay >= ax && ay >= az) { uv[i * 2] = point.x; uv[i * 2 + 1] = point.z; }
      else if (ax > az) { uv[i * 2] = point.z; uv[i * 2 + 1] = point.y; }
      else { uv[i * 2] = point.x; uv[i * 2 + 1] = point.y; }
    }
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); mesh.geometry = geometry;
  });
}
