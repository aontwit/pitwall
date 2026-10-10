// Hero scene: an F1 car in light. The paint is near-black and lit only by a matcap of bright strips
// that slowly turns, so streaks run along the car's real surfaces (the technique the reference uses).
// On the engine stage the body goes see-through and the power unit comes apart, one part per step of a lap.
// Drive mode hands the car to the keyboard (or touch buttons) with a chase camera and a speed gauge.
//
// Models: public/models/car.glb ("Formula 1 Car" by spsvision, CC BY 4.0, decimated, new wheels)
//         public/models/engine.glb ("V6 car engine" by Blendoriano, CC BY 4.0, assembled parts only)
// Sources and edits: site/design/hero.blend (not committed, see site/design/README.md)
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export type Telemetry = { kmh: number; gear: number; rpm: number };
export type Controls = { throttle: number; brake: number; steer: number };
export type SceneOptions = {
  base: string; // deploy base, for model and decoder URLs
  labels: Map<string, HTMLElement>; // engine part name → its label, positioned by the scene
};
export type Scene = {
  focus(stage: number): void;
  drive(on: boolean): void;
  input(c: Partial<Controls>): void;
  telemetry(): Telemetry;
  dispose(): void;
};

const BG = 0x15151e;
/** Stage index whose camera shows the engine through the body. */
const ENGINE_STAGE = 2;
/** Where the engine sits in the car (metres, car space: x forward, y up). */
const ENGINE_AT = new THREE.Vector3(-1.2, 0.16, 0);
/** Where each part goes when the engine comes apart (engine space: x forward, y up, z toward the camera). */
const EXPLODED: Record<string, THREE.Vector3> = {
  intake: new THREE.Vector3(0, 0.8, -0.35),
  ignition: new THREE.Vector3(-0.7, 0.5, -0.2),
  heads: new THREE.Vector3(0.7, 0.5, -0.2),
  crank: new THREE.Vector3(-0.75, -0.25, 0.55),
  pistons: new THREE.Vector3(0.75, -0.2, 0.55),
  exhaust: new THREE.Vector3(0.15, -0.3, 0.75),
  gearbox: new THREE.Vector3(-1.05, 0, 0),
};

type Pose = { pos: THREE.Vector3; look: THREE.Vector3 };
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const POSES: Pose[] = [
  { pos: v(7.6, 3.2, 8.0), look: v(0, 0.4, 0) }, // three-quarter front
  { pos: v(0.4, 2.0, 11.5), look: v(0, 0.5, 0) }, // side profile
  { pos: v(0.2, 5.4, 6.4), look: v(-1.2, 0.85, 0) }, // engine, from above
  { pos: v(-9.0, 3.4, 5.4), look: v(-0.3, 0.45, 0) }, // three-quarter rear
  { pos: v(10.5, 1.2, 1.8), look: v(0, 0.5, 0) }, // head-on, low
];

// ---------- materials ----------

/** Black canvas with soft bright strips, read as a matcap: strips become streaks along the car's curves. */
function stripMatcap(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, 512, 512);
    const strip = (y: number, tilt: number, width: number, color: string, blur: number) => {
      ctx.save();
      ctx.translate(256, y);
      ctx.rotate(tilt);
      ctx.shadowColor = color;
      ctx.shadowBlur = blur;
      ctx.fillStyle = color;
      ctx.fillRect(-300, -width / 2, 600, width);
      ctx.restore();
    };
    strip(120, -0.1, 2, '#ffffff', 8);
    strip(246, -0.03, 3, '#ffffff', 12);
    strip(336, 0.08, 2, '#e10600', 10);
    // a thin ring at the rim of the sphere outlines the silhouette
    ctx.shadowColor = '#fff';
    ctx.shadowBlur = 12;
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(256, 256, 248, 0, Math.PI * 2);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Studio sphere for the engine metal: bright key, tinted mids, dark rim. */
function metalMatcap(tint: string): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  if (ctx) {
    const g = ctx.createRadialGradient(100, 90, 6, 128, 128, 128);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.3, tint);
    g.addColorStop(0.75, 'rgb(60, 62, 70)');
    g.addColorStop(1, 'rgb(14, 14, 18)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const paintVertex = /* glsl */ `
  varying vec3 vN;
  varying vec3 vV;
  varying float vX;
  void main() {
    vN = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vV = normalize(-mv.xyz);
    vX = (modelMatrix * vec4(position, 1.0)).x;
    gl_Position = projectionMatrix * mv;
  }
`;
// Matcap lookup on a slowly turning sphere; `uReveal` paints the car in from nose to tail on load.
const paintFragment = /* glsl */ `
  uniform sampler2D uMatcap;
  uniform float uTime;
  uniform float uReveal;
  uniform float uOpacity;
  uniform float uStreak;
  varying vec3 vN;
  varying vec3 vV;
  varying float vX;
  void main() {
    vec3 n = normalize(vN);
    float a = sin(uTime * 0.18) * 0.5;
    mat2 r = mat2(cos(a), -sin(a), sin(a), cos(a));
    vec2 uv = r * n.xy * 0.49 + 0.5;
    vec3 streak = texture2D(uMatcap, uv).rgb;
    float rim = pow(1.0 - max(dot(n, normalize(vV)), 0.0), 3.0);
    float shown = smoothstep(uReveal - 0.6, uReveal, vX);
    vec3 c = vec3(0.006, 0.006, 0.009) + streak * uStreak * shown + vec3(0.5, 0.52, 0.6) * rim * 0.12;
    gl_FragColor = vec4(c, uOpacity);
  }
`;

function paint(matcap: THREE.Texture, streak: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: paintVertex,
    fragmentShader: paintFragment,
    uniforms: {
      uMatcap: { value: matcap },
      uTime: { value: 0 },
      uReveal: { value: 3.2 },
      uOpacity: { value: 1 },
      uStreak: { value: streak },
    },
    transparent: true,
  });
}

const setUniform = (m: THREE.ShaderMaterial, name: string, value: number): void => {
  const u = m.uniforms[name];
  if (u) u.value = value;
};

// ---------- scene ----------

export function mountCar(canvas: HTMLCanvasElement, opts: SceneOptions): Scene {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 400);

  const strips = stripMatcap();
  const bodyPaint = paint(strips, 1.8);
  const tyrePaint = paint(strips, 0.3);
  const mirrorPaint = paint(strips, 0.12);
  setUniform(mirrorPaint, 'uOpacity', 0.3);
  const paints = [bodyPaint, tyrePaint, mirrorPaint];

  // carRoot moves when driving; it holds the car and its floor reflection
  const carRoot = new THREE.Group();
  scene.add(carRoot);
  const wheels: THREE.Object3D[] = [];
  const mirrorWheels: THREE.Object3D[] = [];

  const engineScene = new THREE.Scene(); // drawn after the bloom so the metal stays crisp
  const engineRoot = new THREE.Group();
  engineRoot.visible = false;
  engineScene.add(engineRoot);
  const parts = new Map<string, { node: THREE.Object3D; home: THREE.Vector3; out: THREE.Vector3 }>();
  const engineMats: THREE.MeshMatcapMaterial[] = [];

  const draco = new DRACOLoader().setDecoderPath(`${opts.base}draco/`);
  const loader = new GLTFLoader().setDRACOLoader(draco);
  let revealStart = -1;

  loader.load(`${opts.base}models/car.glb`, (gltf) => {
    const car = gltf.scene;
    const isWheel = (o: THREE.Object3D): boolean => o.name.startsWith('wheel') || (o.parent?.name.startsWith('wheel') ?? false);
    car.traverse((o) => {
      if (o instanceof THREE.Mesh) o.material = isWheel(o) ? tyrePaint : bodyPaint;
    });
    const mirror = car.clone(true);
    mirror.traverse((o) => {
      if (o instanceof THREE.Mesh) o.material = mirrorPaint;
    });
    mirror.scale.y = -1;
    for (const name of ['wheel_fl', 'wheel_fr', 'wheel_rl', 'wheel_rr']) {
      const w = car.getObjectByName(name);
      const m = mirror.getObjectByName(name);
      if (w && m) {
        w.rotation.order = m.rotation.order = 'YZX'; // steer about Y, then spin about the axle
        wheels.push(w);
        mirrorWheels.push(m);
      }
    }
    carRoot.add(car, mirror);
    revealStart = performance.now();
  });

  loader.load(`${opts.base}models/engine.glb`, (gltf) => {
    const metal = metalMatcap('rgb(190, 194, 202)');
    const red = metalMatcap('rgb(225, 40, 30)');
    const dark = metalMatcap('rgb(70, 72, 80)');
    gltf.scene.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const name = (o.material as THREE.Material).name;
      const mc = /Paint/.test(name) ? red : /Plastic|plastic|Filter|Remen|Procladka/.test(name) ? dark : metal;
      const mat = new THREE.MeshMatcapMaterial({ matcap: mc, transparent: true, opacity: 0 });
      engineMats.push(mat);
      o.material = mat;
    });
    for (const node of [...gltf.scene.children]) {
      const key = node.name.replace(/^engine_/, '');
      parts.set(key, { node, home: node.position.clone(), out: EXPLODED[key]?.clone() ?? new THREE.Vector3() });
      engineRoot.add(node);
    }
  });

  const floor = new THREE.GridHelper(400, 200, 0x3a3a48, 0x24242f);
  const floorMat = floor.material as THREE.Material;
  floorMat.transparent = true;
  floorMat.opacity = 0;
  const platform = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(
      Array.from({ length: 128 }, (_, i) => v(Math.cos((i / 128) * Math.PI * 2) * 4.2, 0, Math.sin((i / 128) * Math.PI * 2) * 2.7)),
    ),
    new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.12 }),
  );
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(Float32Array.from({ length: 1500 }, () => (Math.random() - 0.5) * 40), 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.025, transparent: true, opacity: 0.3 }));
  scene.add(floor, platform, dust);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.75, 0.45, 0.1);
  composer.addPass(bloom);
  const enginePass = new RenderPass(engineScene, camera);
  enginePass.clear = false;
  enginePass.clearDepth = true;
  composer.addPass(enginePass);
  composer.addPass(new OutputPass());

  let fit = 1;
  const resize = (): void => {
    const { clientWidth: w, clientHeight: h } = canvas;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    bloom.resolution.set(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    fit = Math.max(1, 1.1 / camera.aspect); // portrait screens: step back until the car fits
  };
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);

  const pointer = new THREE.Vector2();
  const onPointer = (e: PointerEvent): void => {
    pointer.set(e.clientX / window.innerWidth - 0.5, e.clientY / window.innerHeight - 0.5);
  };
  window.addEventListener('pointermove', onPointer);

  // ---------- state ----------
  let active = 0;
  let driving = false;
  let explode = 0;
  const controls: Controls = { throttle: 0, brake: 0, steer: 0 };
  const car = { speed: 0, heading: 0, steer: 0, spin: 0, pos: new THREE.Vector3() };
  const pose = (n: number): Pose => POSES[n % POSES.length] ?? { pos: v(8, 3, 8), look: v(0, 0.4, 0) };
  const camPos = pose(0).pos.clone().multiplyScalar(1.5);
  const camLook = pose(0).look.clone();
  const target = new THREE.Vector3();
  const lookTarget = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const up = THREE.Object3D.DEFAULT_UP;
  const start = performance.now();
  let last = start;
  let frame = 0;

  const TOP = 94; // m/s, about 340 km/h
  const WHEELBASE = 3.7;
  const RADIUS = 0.395;
  const tick = (now: number): void => {
    const t = (now - start) / 1000;
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    const k = 1 - Math.exp(-dt * 1.8);

    // ---- drive physics: arcade acceleration and drag, bicycle-model turning ----
    if (driving) {
      const accel = controls.throttle * 16 * (1 - car.speed / TOP) - controls.brake * (car.speed > 0 ? 30 : 6) - 0.4 * Math.sign(car.speed) - car.speed * 0.012;
      car.speed = THREE.MathUtils.clamp(car.speed + accel * dt, -8, TOP);
      if (controls.throttle === 0 && controls.brake === 0 && Math.abs(car.speed) < 0.3) car.speed = 0;
      const lock = 0.42 / (1 + Math.abs(car.speed) / 25); // less lock at speed
      car.steer += (controls.steer * lock - car.steer) * Math.min(1, dt * 8);
      car.heading += (car.speed / WHEELBASE) * Math.tan(car.steer) * dt;
      car.pos.x += Math.cos(car.heading) * car.speed * dt;
      car.pos.z -= Math.sin(car.heading) * car.speed * dt;
    } else {
      // glide back onto the stage
      car.speed *= 1 - Math.min(1, dt * 2);
      car.steer *= 1 - Math.min(1, dt * 4);
      car.pos.lerp(tmp.set(0, 0, 0), k);
      car.heading += Math.atan2(Math.sin(-car.heading), Math.cos(-car.heading)) * k;
    }
    car.spin -= (car.speed / RADIUS) * dt;
    carRoot.position.copy(car.pos);
    carRoot.rotation.y = car.heading;
    for (const set of [wheels, mirrorWheels]) {
      set.forEach((w, i) => {
        w.rotation.z = car.spin;
        w.rotation.y = i < 2 ? car.steer : 0;
      });
    }
    engineRoot.position.copy(ENGINE_AT).applyAxisAngle(up, car.heading).add(car.pos);
    engineRoot.rotation.y = car.heading;

    // ---- camera ----
    if (driving) {
      // chase cam: behind and above, swinging out with the steering
      target.set(-8 - car.speed * 0.03, 2.6, -car.steer * 5).applyAxisAngle(up, car.heading).add(car.pos);
      lookTarget.set(4, 0.6, 0).applyAxisAngle(up, car.heading).add(car.pos);
      camPos.lerp(target, 1 - Math.exp(-dt * 5));
      camLook.lerp(lookTarget, 1 - Math.exp(-dt * 8));
    } else {
      const p = pose(active);
      const sway = Math.sin(t * 0.15) * 0.06;
      target.copy(p.pos).sub(p.look).multiplyScalar(fit).add(p.look).applyAxisAngle(up, sway);
      target.x += pointer.x * 0.8;
      target.y -= pointer.y * 0.5;
      camPos.lerp(target, k);
      camLook.lerp(p.look, k);
    }
    camera.position.copy(camPos);
    camera.lookAt(camLook);

    // ---- paint, x-ray and the engine ----
    const xray = active === ENGINE_STAGE && !driving;
    const reveal = revealStart < 0 ? 3.2 : 3.2 - Math.min(1, (now - revealStart) / 2600) * 7;
    for (const m of paints) {
      setUniform(m, 'uTime', t);
      setUniform(m, 'uReveal', reveal);
    }
    const bodyOpacity = (bodyPaint.uniforms['uOpacity']?.value as number | undefined) ?? 1;
    const nextBody = bodyOpacity + ((xray ? 0.16 : 1) - bodyOpacity) * k * 1.5;
    setUniform(bodyPaint, 'uOpacity', nextBody);
    setUniform(tyrePaint, 'uOpacity', nextBody);
    bodyPaint.depthWrite = tyrePaint.depthWrite = !xray;

    const engineOpacity = engineMats[0]?.opacity ?? 0;
    const nextEngine = engineOpacity + ((xray ? 1 : 0) - engineOpacity) * k * 1.5;
    for (const m of engineMats) m.opacity = nextEngine;
    engineRoot.visible = nextEngine > 0.01;
    explode += ((xray && nextEngine > 0.8 ? 1 : 0) - explode) * k;
    const e = explode * explode * (3 - 2 * explode);
    for (const p of parts.values()) p.node.position.copy(p.home).addScaledVector(p.out, e);

    // ---- labels follow their parts on screen ----
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    for (const [key, el] of opts.labels) {
      const p = parts.get(key);
      if (!p) continue;
      p.node.getWorldPosition(tmp).project(camera);
      el.style.transform = `translate(${((tmp.x + 1) / 2) * w}px, ${((1 - tmp.y) / 2) * h}px)`;
      el.style.opacity = String(Math.max(0, explode * 1.4 - 0.4));
    }

    floorMat.opacity += ((driving ? 0.5 : 0) - floorMat.opacity) * k;
    platform.visible = !driving;
    dust.rotation.y = t * 0.008;
    composer.render();
    frame = requestAnimationFrame(tick);
  };
  resize();
  frame = requestAnimationFrame(tick);

  return {
    focus(stage) {
      active = stage;
    },
    drive(on) {
      driving = on;
      if (!on) Object.assign(controls, { throttle: 0, brake: 0, steer: 0 });
    },
    input(c) {
      Object.assign(controls, c);
    },
    telemetry() {
      const kmh = Math.abs(car.speed) * 3.6;
      const gear = car.speed < -0.1 ? -1 : car.speed < 0.3 ? 0 : Math.min(8, 1 + Math.floor(kmh / 42));
      const band = gear <= 0 ? 0 : (kmh - (gear - 1) * 42) / 42;
      return { kmh, gear, rpm: gear === 0 ? 4000 + controls.throttle * 3000 : 6000 + Math.min(1, band) * 9000 };
    },
    dispose() {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('pointermove', onPointer);
      draco.dispose();
      composer.dispose();
      renderer.dispose();
    },
  };
}
