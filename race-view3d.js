import * as THREE from './vendor/three/build/three.module.js';
import { GLTFLoader } from './vendor/three/examples/jsm/loaders/GLTFLoader.js';
import { clone } from './vendor/three/examples/jsm/utils/SkeletonUtils.js';

// Presentation only: race rules, input and HUD remain owned by race-simulator.js.
// The original horse/jockey rig and all nine animation clips are preserved.
export async function createRaceView(width, height) {
  const renderer = new THREE.WebGLRenderer({ antialias:true, alpha:false, powerPreference:'low-power' });
  const canvas = renderer.domElement;
  canvas.id = 'raceCanvas';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'محاكاة ثلاثية الأبعاد للحصان والفارس المرفقين، تتنافس فيها مع فارس آخر على مضمار تجريبي');
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, width < 700 ? 1.5 : 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#56515a');
  scene.fog = new THREE.Fog('#56515a', 34, 105);
  const camera = new THREE.PerspectiveCamera(36, width / height, .1, 150);
  let cameraMode = 'side', narrow = width < 650;
  const target = new THREE.Vector3(0,1.05,.35);
  const cameraGoal = new THREE.Vector3();
  scene.add(new THREE.HemisphereLight('#f4e4cb', '#524433', 2.1));
  const sun = new THREE.DirectionalLight('#ffdfac', 3);
  sun.position.set(8,12,7); sun.castShadow = true;
  sun.shadow.mapSize.set(1024,1024);
  Object.assign(sun.shadow.camera, {left:-9,right:9,top:9,bottom:-9,near:.5,far:40});
  sun.shadow.normalBias = .03;
  scene.add(sun);
  const rim = new THREE.DirectionalLight('#b7c4d6', 1.25);
  rim.position.set(-8,5,-4); scene.add(rim);

  const mat = (color, roughness=.8) => new THREE.MeshStandardMaterial({color,roughness});
  const sandCanvas = document.createElement('canvas');
  sandCanvas.width = sandCanvas.height = 256;
  const sandCtx = sandCanvas.getContext('2d');
  sandCtx.fillStyle = '#977955'; sandCtx.fillRect(0,0,256,256);
  let seed = 19;
  for(let i=0;i<9000;i++) {
    seed = (seed*16807)%2147483647;
    const x=seed%256, y=(seed>>8)%256;
    sandCtx.fillStyle=i%2?'rgba(45,27,15,.12)':'rgba(237,212,168,.15)';
    sandCtx.fillRect(x,y,1+(i%3),1);
  }
  const texture = new THREE.CanvasTexture(sandCanvas);
  texture.colorSpace=THREE.SRGBColorSpace; texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  texture.repeat.set(5,48); texture.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(13,200),new THREE.MeshStandardMaterial({map:texture,roughness:1}));
  ground.rotation.x=-Math.PI/2; ground.receiveShadow=true; scene.add(ground);
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(180,200),mat('#535744'));
  grass.rotation.x=-Math.PI/2; grass.position.y=-.03; scene.add(grass);
  const railMat=mat('#e3dccb',.55), postGeo=new THREE.BoxGeometry(.08,.9,.08);
  const posts=new THREE.InstancedMesh(postGeo,railMat,104);
  const matrix=new THREE.Matrix4();
  for(let i=0;i<104;i++) {matrix.makeTranslation(i%2?6.5:-6.5,.45,-100+Math.floor(i/2)*4);posts.setMatrixAt(i,matrix);}
  scene.add(posts);
  for(const x of [-6.5,6.5])for(const y of [.52,.91]) {
    const rail=new THREE.Mesh(new THREE.BoxGeometry(.065,.075,200),railMat);
    rail.position.set(x,y,0);scene.add(rail);
  }
  const buildingMat=mat('#8b8272'), seatMat=mat('#424e48'), roofMat=mat('#494740');
  for(let n=0;n<5;n++) {
    const stand=new THREE.Group();
    for(let tier=0;tier<5;tier++) {
      const row=new THREE.Mesh(new THREE.BoxGeometry(1,.4,11),tier%2?buildingMat:seatMat);
      row.position.set(-tier,.2+tier*.4,0);stand.add(row);
    }
    const canopy=new THREE.Mesh(new THREE.BoxGeometry(6,.14,12),roofMat);
    canopy.position.set(-2,3.6,0);stand.add(canopy);
    for(const z of [-5,5]) {
      const column=new THREE.Mesh(new THREE.CylinderGeometry(.08,.08,3.6,6),buildingMat);
      column.position.set(-4,1.8,z);stand.add(column);
    }
    stand.position.set(-15,0,-44+n*16);scene.add(stand);
  }
  const mountainMat=mat('#74695f');
  for(let i=0;i<14;i++) {
    const peak=new THREE.Mesh(new THREE.ConeGeometry(8+i%4,10+i%5*2,5),mountainMat);
    peak.position.set(-50+i*8,2,-73-i%3*6);scene.add(peak);
  }
  const finish = new THREE.Group();
  const finishMat=[new THREE.MeshBasicMaterial({color:'#eee8da'}),new THREE.MeshBasicMaterial({color:'#252624'})];
  for(let col=0;col<20;col++)for(let row=0;row<2;row++){
    const tile=new THREE.Mesh(new THREE.PlaneGeometry(.65,.35),finishMat[(col+row)%2]);
    tile.rotation.x=-Math.PI/2;tile.position.set(-6.175+col*.65,.014,row*.35);finish.add(tile);
  }
  scene.add(finish);
  const dustPositions=new Float32Array(90*3);
  const dustGeo=new THREE.BufferGeometry();dustGeo.setAttribute('position',new THREE.BufferAttribute(dustPositions,3));
  const dust=new THREE.Points(dustGeo,new THREE.PointsMaterial({color:'#d6bd92',size:.065,transparent:true,opacity:.4,depthWrite:false}));
  scene.add(dust);
  let gltf;
  try { gltf=await new GLTFLoader().loadAsync(new URL('./assets/race/horse-jockey.glb',import.meta.url).href); }
  catch(error) { renderer.dispose();throw error; }
  function rider(isPlayer) {
    const model=clone(gltf.scene), entity=new THREE.Group();
    entity.add(model); entity.position.set(isPlayer?1.25:-1.25,.15,0);scene.add(entity);
    model.traverse(object=>{
      if(!object.isMesh)return;
      object.castShadow=true;object.frustumCulled=false;
      object.material=object.material.clone();
      if(/^(Silks|Helmet)$/.test(object.material.name))object.material.color.set(isPlayer?'#bfa064':'#c5cdd5');
      if(!isPlayer&&object.material.name==='Coat')object.material.color.set('#48403b');
    });
    const mixer=new THREE.AnimationMixer(model);
    const actions=Object.fromEntries(gltf.animations.map(clip=>[clip.name,mixer.clipAction(clip)]));
    return {entity,mixer,actions,current:'',action:null};
  }
  const player=rider(true), opponent=rider(false);
  function play(who,name,dt,speed) {
    if(who.current!==name) {
      const next=who.actions[name];next.reset().play();
      if(who.action)who.action.crossFadeTo(next,.2,false);
      who.action=next;who.current=name;
    }
    who.mixer.update(dt*speed);
  }
  function positionCamera(snap=false) {
    const poses={side:[8.5,3.15,4.8],follow:[5.2,3.3,-8.8],front:[4,2.6,9.6]};
    cameraGoal.set(...poses[cameraMode]);
    if(narrow)cameraGoal.multiplyScalar(1.4);
    if(snap)camera.position.copy(cameraGoal);
    camera.lookAt(target);
  }
  let animation='walk_sit', frames=0, frameTotal=0, resetStamp=-1;
  function step(state,dt,reduced) {
    const racing=state.mode==='racing', finished=state.mode==='finished';
    if(state.mode==='idle'&&resetStamp!==state.elapsed) {
      player.current=opponent.current='';player.mixer.stopAllAction();opponent.mixer.stopAllAction();
    }
    resetStamp=state.elapsed;
    animation=racing?(state.elapsed-state.lastBoostAt<.85?'gallop_whip':state.playerSpeed>56?'gallop_headdown':'gallop'):
      finished&&state.winner==='player'?'walk_celebrate':'walk_sit';
    const animDt=(racing||finished)?dt:0;
    play(player,animation,animDt,racing?THREE.MathUtils.clamp(state.playerSpeed/48,.7,1.3):1);
    play(opponent,racing?'gallop':finished&&state.winner==='ai'?'walk_celebrate':'walk_sit',animDt,1);
    opponent.entity.position.z=THREE.MathUtils.clamp((state.aiDistance-state.playerDistance)*.035,-5.5,5.5);
    texture.offset.y=-state.playerDistance*.06;
    posts.position.z=-(state.playerDistance*.14)%4;
    finish.visible=state.playerDistance>790;
    finish.position.z=(900-state.playerDistance)*.12;
    dust.visible=racing&&!reduced;
    if(dust.visible) {
      for(let i=0;i<90;i++){
        const t=(state.elapsed*1.8+i*.037)%1;
        dustPositions[i*3]=(i%2?1.25:-1.25)+Math.sin(i*15)*t*.5;
        dustPositions[i*3+1]=.06+t*.24;
        dustPositions[i*3+2]=-1.4-t*2+(i%2?0:opponent.entity.position.z);
      }
      dustGeo.attributes.position.needsUpdate=true;
    }
    camera.position.lerp(cameraGoal,reduced?1:1-Math.exp(-dt*5));camera.lookAt(target);
  }
  function render(){ const start=performance.now();renderer.render(scene,camera);frameTotal+=performance.now()-start;frames++; }
  function resize(w,h){ narrow=w<650;renderer.setPixelRatio(Math.min(devicePixelRatio||1,narrow?1.5:1.75));renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();positionCamera(true); }
  function setCamera(mode){ if(['side','follow','front'].includes(mode)){cameraMode=mode;positionCamera();} }
  function diagnostics(){return {renderer:'Three.js '+THREE.REVISION,ready:true,animation,camera:cameraMode,model:'horse-jockey.glb',clips:gltf.animations.map(c=>c.name),calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,dpr:renderer.getPixelRatio(),meanRenderMs:Number((frameTotal/Math.max(1,frames)).toFixed(2))};}
  resize(width,height);
  return {canvas,step,render,resize,setCamera,diagnostics};
}
