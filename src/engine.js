import * as THREE from 'three';

const TAU = Math.PI * 2;

// A cast part is an extruded, filleted outline, not a stack of primitive boxes.
function roundedOutline(points, radius = .008) {
  const shape = new THREE.Shape();
  const corners = points.map((p, i) => {
    const previous = points[(i + points.length - 1) % points.length];
    const next = points[(i + 1) % points.length];
    const before = new THREE.Vector2(previous[0] - p[0], previous[1] - p[1]);
    const after = new THREE.Vector2(next[0] - p[0], next[1] - p[1]);
    before.setLength(Math.min(radius, before.length() * .3));
    after.setLength(Math.min(radius, after.length() * .3));
    return { p, a: [p[0] + before.x, p[1] + before.y], b: [p[0] + after.x, p[1] + after.y] };
  });
  shape.moveTo(...corners[0].a);
  for (const corner of corners) {
    shape.lineTo(...corner.a);
    shape.quadraticCurveTo(...corner.p, ...corner.b);
  }
  shape.closePath();
  return shape;
}

/**
 * Black 471 cc liquid-cooled DOHC parallel twin, reconstructed from Honda's
 * 2025 Taiwan profile and UK engine photography. X points rearwards; Z right.
 * The alternator and clutch covers intentionally have different silhouettes.
 */
export function buildEngine(parent, helpers, materials) {
  const { add, rod, tube, box, ring } = helpers;
  const { black, rubber, silver, alloy, dark } = materials;
  const engine = new THREE.Group();
  engine.name = '471cc_liquid_cooled_parallel_twin';
  parent.add(engine);

  const grainPixels = new Uint8Array(128 * 128 * 4);
  let grainSeed = 500;
  for (let i = 0; i < grainPixels.length; i += 4) {
    grainSeed = (grainSeed * 1664525 + 1013904223) >>> 0;
    const shade = 98 + (grainSeed >>> 26);
    grainPixels[i] = grainPixels[i+1] = grainPixels[i+2] = shade;
    grainPixels[i+3] = 255;
  }
  const grain = new THREE.DataTexture(grainPixels,128,128);
  grain.wrapS = grain.wrapT = THREE.RepeatWrapping; grain.repeat.set(6,6);
  grain.magFilter = THREE.LinearFilter; grain.minFilter = THREE.LinearMipmapLinearFilter;
  grain.generateMipmaps = true; grain.needsUpdate = true;
  const cast = new THREE.MeshStandardMaterial({ color: '#303234', metalness: .38, roughness: .59, bumpMap:grain, bumpScale:.00045 });
  cast.name = 'fine_black_cast_aluminium';
  const cover = new THREE.MeshStandardMaterial({ color: '#2f3133', metalness: .44, roughness: .4 });
  cover.name = 'satin_black_engine_covers';
  const raised = new THREE.MeshStandardMaterial({ color: '#414346', metalness: .45, roughness: .49 });
  raised.name = 'cast_rib_edge';
  const joint = new THREE.MeshStandardMaterial({ color: '#0e1211', metalness: .16, roughness: .77 });

  function casting(name, outline, z, depth, material = cast, bevel = .005) {
    const geometry = new THREE.ExtrudeGeometry(roundedOutline(outline), {
      depth, steps: 1, curveSegments: 8,
      bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel,
      bevelSegments: 3,
    });
    const part = add(engine, geometry, material, [0, 0, z]);
    part.name = name;
    return part;
  }

  function screw(x, y, z, size = .0047, sign = Math.sign(z) || 1) {
    rod(engine, [x, y, z], [x, y, z + sign * .0017], size * 1.27, raised, size * 1.27, 20);
    rod(engine, [x, y, z + sign * .0018], [x, y, z + sign * .0048], size, silver, size, 6);
    rod(engine, [x, y, z + sign * .0049], [x, y, z + sign * .0052], size * .39, dark, size * .39, 6);
  }

  function disk(name, x, y, z, radius, depth, material, taper = 1) {
    const sign = Math.sign(z) || 1;
    const part = rod(engine, [x, y, z], [x, y, z + sign * depth], radius, material, radius * taper, 64);
    part.name = name;
    return part;
  }

  // Crankcase follows the sump, front crankshaft and rear gearbox envelope.
  const crank = [
    [-.205,.273],[-.236,.335],[-.225,.399],[-.184,.448],[-.116,.472],
    [-.038,.468],[.010,.493],[.082,.474],[.115,.427],[.174,.394],
    [.181,.303],[.145,.250],[.070,.229],[-.140,.236],
  ];
  casting('crankcase_central_casting', crank, -.132, .264, cast, .009);
  for (const s of [-1, 1]) {
    casting('crankcase_joint_' + s, crank, s < 0 ? -.139 : .136, .003, joint, .002);
    // Moulded webs around the gearbox, intentionally irregular and sparse.
    for (const path of [
      [[.046,.258],[.057,.339],[.041,.414],[.025,.452]],
      [[.082,.263],[.086,.338],[.073,.418],[.062,.450]],
      [[.125,.285],[.119,.342],[.129,.373],[.105,.404]],
      [[-.160,.247],[-.073,.260],[.020,.248]],
    ]) tube(engine, path.map(p => [...p, s * .143]), .0034, raised, 16);
    for (const [x, y] of [[-.184,.284],[-.218,.354],[-.173,.437],[-.07,.456],[.016,.472],[.081,.452],[.150,.385],[.147,.298],[.063,.243]]) {
      disk('casting_bolt_boss',x,y,s*.139,.008,.005,cast);
      screw(x,y,s*.145,.0041,s);
    }
  }

  // Wet-sump pan and vertical strengthening ribs visible below the covers.
  const sump = [[-.153,.252],[.095,.248],[.115,.219],[.091,.165],[-.092,.161],[-.137,.180]];
  casting('wet_sump_oil_pan', sump, -.104, .208, cover, .006);
  for (const s of [-1, 1]) {
    for (let i = 0; i < 8; i++) {
      const x = -.098 + i * .026;
      tube(engine, [[x,.174,s*.112],[x-.004,.202,s*.115],[x-.006,.240,s*.113]], .0026, cast, 8);
    }
    tube(engine, [[-.135,.239,s*.113],[-.07,.246,s*.115],[.03,.245,s*.115],[.092,.237,s*.113]], .0022, raised, 14);
  }
  rod(engine, [.015,.161,0], [.015,.155,0], .010, alloy, .010, 6);

  // Compact forward-inclined water-jacket monobloc, not air-cooled fins.
  const cylinder = [[-.205,.411],[-.278,.551],[-.263,.584],[-.106,.626],[-.061,.591],[-.026,.454],[-.067,.425]];
  casting('liquid_cooled_cylinder_water_jacket', cylinder, -.113, .226, cast, .008);
  const blockJoint = [[-.263,.552],[-.102,.594],[-.091,.581],[-.251,.539]];
  casting('cylinder_head_gasket_front_edge', blockJoint, -.122, .244, joint, .0015);
  for (const s of [-1, 1]) {
    for (const path of [
      [[-.188,.429],[-.204,.478],[-.239,.547]],
      [[-.147,.439],[-.166,.492],[-.194,.561]],
      [[-.075,.449],[-.095,.511],[-.124,.580]],
    ]) tube(engine, path.map(p => [...p, s * .122]), .0048, cast, 14);
    for (const path of [
      [[-.204,.469],[-.179,.462],[-.101,.481]],
      [[-.224,.512],[-.184,.506],[-.106,.527]],
    ]) tube(engine, path.map(p => [...p, s * .123]), .002, raised, 12);
    // Small irregular service cap and coolant pipe flange at the rear.
    casting('cylinder_service_flange', [[-.132,.461],[-.157,.476],[-.151,.503],[-.120,.511],[-.099,.481]], s < 0 ? -.136 : .124, .013, cover, .003);
    screw(-.141,.492,s*.14,.0037,s);
    screw(-.114,.471,s*.14,.0037,s);
  }

  const head = [[-.287,.558],[-.301,.598],[-.282,.632],[-.165,.665],[-.097,.650],[-.071,.614],[-.092,.583],[-.177,.568]];
  casting('DOHC_cylinder_head', head, -.133, .266, cast, .006);
  const valveCover = [[-.296,.620],[-.279,.650],[-.180,.675],[-.102,.659],[-.090,.642],[-.167,.650]];
  casting('cam_cover_rubber_gasket', valveCover, -.14, .280, joint, .002);
  casting('cam_cover', valveCover.map(([x,y]) => [x,y+.006]), -.134, .268, cover, .004);
  for (const s of [-1, 1]) {
    // The broad head face steps down between the exposed cylinder studs.
    casting('head_scalloped_side_face_'+s,[[-.279,.624],[-.257,.644],[-.159,.670],[-.104,.655],[-.077,.611],[-.096,.567],[-.121,.553],[-.142,.592],[-.164,.591],[-.180,.552],[-.230,.548],[-.255,.572]],s<0?-.137:.133,.004,cover,.002);
    // These conspicuous silver circular plugs locate the head in Honda's photo.
    for (const [x,y,r] of [[-.241,.601,.017],[-.140,.631,.016]]) {
      disk('camshaft_end_cast_boss',x,y,s*.137,r+.006,.009,cover);
      disk('camshaft_end_plug',x,y,s*.148,r,.0035,alloy,.95);
      disk('camshaft_end_plug_machined_face',x,y,s*.152,r*.84,.0015,silver);
    }
    for (const [x,y] of [[-.25,.574],[-.108,.61],[-.17,.66],[-.276,.617]]) screw(x,y,s*.145,.0038,s);
    disk('head_rear_service_plug',-.092,.593,s*.139,.013,.011,black);
    ring(engine,.008,.0011,[-.092,.593,s*.151],raised);
    tube(engine,[[-.279,.627,s*.122],[-.224,.644,s*.127],[-.175,.658,s*.126],[-.115,.640,s*.123]],.0025,cast,18);
    for(const [x,y] of [[-.224,.550],[-.108,.581]]) {
      rod(engine,[x,y,s*.133],[x+.02,y-.078,s*.132],.0058,cast,.0058,20);
      screw(x,y,s*.143,.0034,s);
    }
  }

  // Left alternator: round forward lobe with a tapered polygonal rear extension.
  const alternator = [[-.220,.346],[-.211,.394],[-.175,.436],[-.134,.447],[-.100,.439],[-.059,.417],[.048,.415],[.073,.385],[.067,.303],[-.025,.282],[-.072,.243],[-.127,.239],[-.183,.268]];
  casting('left_alternator_cover_gasket', alternator, -.148, .008, joint, .003);
  casting('left_alternator_cover', alternator, -.167, .020, cover, .007);
  disk('left_alternator_raised_rim',-.102,.346,-.174,.099,.012,cast,.94);
  disk('left_alternator_domed_face',-.102,.346,-.186,.083,.009,cover,.91);
  ring(engine,.074,.0028,[-.102,.346,-.197],raised);
  disk('left_alternator_center',-.102,.346,-.195,.064,.004,cover,.97);
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * TAU + .1;
    const r0 = .082, r1 = .094;
    tube(engine,[[ -.102 + Math.cos(a)*r0,.346 + Math.sin(a)*r0,-.187],[ -.102 + Math.cos(a)*r1,.346 + Math.sin(a)*r1,-.181]],.0025,raised,4);
  }
  casting('alternator_rear_recess', [[-.010,.398],[.052,.394],[.050,.313],[-.015,.302],[-.008,.347]], -.177, .002, joint, .004);
  casting('alternator_rear_panel', [[.0,.390],[.043,.387],[.040,.321],[-.004,.312],[.003,.347]], -.180, .003, cover, .003);
  for (const [x,y] of [[-.204,.375],[-.17,.422],[-.101,.435],[-.036,.412],[.057,.387],[.055,.315],[-.057,.264],[-.122,.253],[-.190,.286]]) screw(x,y,-.181,.004,-1);

  // Left output-shaft casting has angled, recessed ribs, distinct from the rotor.
  const sprocketCover = [[.082,.450],[.134,.441],[.164,.401],[.154,.282],[.125,.265],[.080,.287],[.068,.354]];
  casting('left_gearbox_sprocket_cover', sprocketCover, -.164, .017, cast, .005);
  for (const points of [
    [[.095,.430],[.107,.370],[.135,.398],[.135,.423]],
    [[.092,.347],[.126,.310],[.123,.287]],
    [[.108,.427],[.115,.441]],
  ]) tube(engine,points.map(p=>[...p,-.172]),.003,joint,12);
  for (const [x,y] of [[.093,.437],[.145,.399],[.132,.280]]) screw(x,y,-.174,.004,-1);

  // Right clutch: large rear circular lobe, asymmetric water-pump front lobe.
  const clutch = [[-.203,.331],[-.190,.379],[-.148,.404],[-.083,.398],[-.038,.430],[.027,.444],[.095,.419],[.137,.371],[.143,.309],[.109,.261],[.057,.237],[-.019,.243],[-.064,.270],[-.152,.274]];
  casting('right_clutch_gasket', clutch, .139, .004, joint, .002);
  casting('right_clutch_outer_cover', clutch, .145, .032, cover, .006);
  disk('right_clutch_rounded_shoulder',.022,.339,.181,.101,.013,cast,.93);
  disk('right_clutch_domed_face',.022,.339,.193,.085,.009,cover,.93);
  ring(engine,.076,.0024,[.022,.339,.204],raised);
  disk('right_clutch_center',.022,.339,.202,.065,.003,cover,.98);
  for (const [x,y] of [[-.17,.372],[-.089,.39],[-.026,.422],[.06,.429],[.120,.376],[.123,.296],[.074,.255],[-.003,.253],[-.09,.283],[-.18,.306]]) screw(x,y,.185,.004,1);
  disk('right_forward_crank_inspection_housing',-.148,.305,.18,.061,.018,cast,.96);
  disk('right_forward_crank_inspection_recess',-.148,.305,.201,.045,.002,joint);
  disk('right_forward_crank_inspection_cap',-.148,.305,.204,.037,.005,cover,.95);
  disk('right_forward_crank_inspection_cap_inner',-.148,.305,.210,.027,.002,cast,.96);
  rod(engine,[-.148,.305,.213],[-.148,.305,.216],.013,cover,.013,6);
  for (const a of [.3,1.85,3.45,4.65]) screw(-.148+Math.cos(a)*.057,.305+Math.sin(a)*.057,.202,.004,1);
  casting('clutch_lower_cast_recess',[[-.065,.248],[-.047,.267],[.012,.258],[.046,.24],[.055,.231],[-.035,.23]],.183,.002,joint,.002);
  casting('clutch_lower_cast_web',[[-.090,.251],[-.073,.270],[-.048,.23],[-.081,.232]],.184,.002,raised,.002);
  // Filler and oil level glass punctuate the right black cover.
  rod(engine,[.1,.405,.174],[.101,.434,.175],.014,black,.012,24);
  box(engine,[.028,.007,.02],[.101,.437,.175],cover,.003);
  // Clutch cable bracket and release arm sit above the rear of the round case.
  casting('clutch_cable_bracket',[[.014,.442],[.031,.456],[.074,.440],[.088,.418],[.066,.411],[.034,.43]],.149,.010,black,.002);
  screw(.072,.427,.166,.0045,1);
  rod(engine,[.025,.451,.155],[.081,.47,.144],.004,alloy,.004,12);
  tube(engine,[[.067,.472,.145],[.052,.514,.126],[.029,.552,.12],[-.034,.575,.115]],.004,rubber,18);
  disk('oil_level_sight_glass',.091,.292,.191,.010,.003,alloy);
  disk('oil_level_glass',.091,.292,.195,.0075,.001,dark);

  // Starter motor, intake boots, clamps, coolant hoses, wiring and connectors.
  casting('moulded_intake_airbox',[[.008,.545],[.049,.589],[.131,.609],[.196,.571],[.181,.514],[.120,.496],[.071,.512]],-.086,.172,joint,.006);
  for(const s of [-1,1]) {
    tube(engine,[[.019,.55,s*.094],[.057,.578,s*.097],[.13,.591,s*.096],[.171,.566,s*.09]],.0025,black,18);
    for(const x of [.080,.115,.150]) tube(engine,[[x,.522,s*.095],[x+.006,.549,s*.098],[x+.009,.575,s*.097]],.003,black,12);
    tube(engine,[[.164,.514,s*.096],[.122,.487,s*.116],[.141,.435,s*.134],[.11,.418,s*.146]],.006,rubber,18);
    box(engine,[.021,.04,.025],[.158,.526,s*.097],dark,.004);
    screw(.164,.558,s*.099,.0032,s);
  }
  rod(engine,[.012,.487,-.100],[.012,.487,.107],.025,cover,.025,32);
  for (const s of [-1,1]) {
    disk('starter_motor_end',.012,.487,s*.111,.026,.005,cast);
    screw(.011,.487,s*.118,.006,s);
    tube(engine,[[-.112,.605,s*.067],[-.059,.604,s*.067],[-.019,.580,s*.067],[.039,.573,s*.067]],.022,rubber,20);
    rod(engine,[-.039,.590,s*.067],[-.012,.580,s*.067],.024,alloy,.024,24);
    box(engine,[.036,.038,.031],[-.025,.612,s*.066],cast,.004,[0,0,.2]);
    tube(engine,[[-.191,.665,s*.071],[-.194,.697,s*.080],[-.089,.670,s*.101],[.037,.607,s*.093]],.005,rubber,22);
    tube(engine,[[.031,.494,s*.124],[.048,.537,s*.143],[.047,.58,s*.145],[.013,.608,s*.13]],.0065,rubber,20);
    box(engine,[.016,.027,.021],[.048,.55,s*.147],joint,.003);
    tube(engine,[[.036,.435,s*.13],[.013,.49,s*.151],[-.011,.523,s*.15],[-.001,.554,s*.12]],.0035,black,18);
    // Engine mounting ears and unpainted bolt centres.
    casting('upper_rear_mount_'+s,[[.013,.459],[.043,.517],[.077,.51],[.091,.448]],s<0?-.131:.115,.016,cast,.004);
    screw(.052,.492,s*.139,.006,s);
  }
  tube(engine,[[.012,.467,-.161],[.008,.532,-.161],[-.017,.567,-.147],[-.023,.60,-.125]],.014,rubber,24);
  tube(engine,[[-.244,.574,-.134],[-.288,.579,-.13],[-.298,.61,-.126]],.009,rubber,16);
  disk('throttle_linkage_pulley',-.020,.613,.111,.022,.008,alloy);
  disk('throttle_linkage_inner',-.020,.613,.12,.014,.002,cast);
  screw(-.02,.613,.124,.005,1);
  tube(engine,[[-.030,.594,.127],[-.007,.593,.127],[.007,.616,.122],[-.002,.647,.102],[-.040,.668,.098]],.003,black,22);

  // A shallow embossed maker's mark is readable in a close right-hand view.
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 128;
    const context = canvas.getContext('2d');
    if (context) {
      context.clearRect(0,0,512,128);
      context.font = 'bold 76px Arial'; context.textAlign = 'center'; context.textBaseline = 'middle';
      context.fillStyle = '#101312'; context.fillText('HONDA',258,66);
      context.fillStyle = '#484d49'; context.fillText('HONDA',256,63);
      const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
      const brand = new THREE.MeshStandardMaterial({map, transparent:true, roughness:.6, metalness:.35, depthWrite:false});
      add(engine,new THREE.PlaneGeometry(.092,.023),brand,[.022,.339,.2065]);
    }
  }

  return engine;
}
