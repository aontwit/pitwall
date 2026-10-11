// Hero scene: an F1 car in light. The paint is near-black and lit only by a matcap of bright strips
// that slowly turns, so streaks run along the car's real surfaces (the technique the reference uses).
// On the engine stage the body goes see-through and the power unit comes apart, one part per step of a lap.
// Drive mode: a chase camera behind the car, as in a racing game. The car stays at the centre of the world
// and the floor, dust and wind stream past it; an 8-speed seamless gearbox and carbon brakes give it its feel.
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

export type Telemetry = { kmh: number; gear: number; rpm: number; throttle: number; brake: number; shifts: number };
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
  uniform float uFlow;
  varying vec3 vN;
  varying vec3 vV;
  varying float vX;
  void main() {
    vec3 n = normalize(vN);
    float a = sin(uTime * 0.18) * 0.5;
    mat2 r = mat2(cos(a), -sin(a), sin(a), cos(a));
    vec2 uv = r * n.xy * 0.49 + 0.5;
    // bands of light travelling nose to tail; uFlow grows with speed
    float band = pow(0.5 + 0.5 * sin(vX * 1.7 + uFlow), 6.0);
    // capped, so a flat panel that faces a strip glows instead of turning into a white slab
    vec3 streak = min(texture2D(uMatcap, uv).rgb * (0.45 + 1.1 * band), vec3(0.75));
    float rim = pow(1.0 - max(dot(n, normalize(vV)), 0.0), 3.0);
    float shown = smoothstep(uReveal - 0.6, uReveal, vX);
    vec3 c = vec3(0.006, 0.006, 0.009) + streak * uStreak * shown + vec3(0.5, 0.52, 0.6) * rim * 0.07;
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
      uFlow: { value: 0 },
    },
    transparent: true,
  });
}

const setUniform = (m: THREE.ShaderMaterial, name: string, value: number): void => {
  const u = m.uniforms[name];
  if (u) u.value = value;
};

// ---------- scene ----------

/** Thin light rings on a tyre's outer edges, each with one brighter arc, so the spin can be seen. */
function rimLights(wheel: THREE.Object3D): THREE.Mesh[] {
  const ring = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false });
  const arc = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false });
  return [0.21, -0.21].flatMap((z) => {
    const full = new THREE.Mesh(new THREE.TorusGeometry(0.382, 0.004, 6, 72), ring);
    const bright = new THREE.Mesh(new THREE.TorusGeometry(0.382, 0.006, 6, 24, Math.PI * 0.55), arc);
    for (const m of [full, bright]) {
      m.position.z = z; // the axle runs along the wheel's local z
      m.userData['rim'] = true;
      wheel.add(m);
    }
    return [full, bright];
  });
}

/** Height and half-width of the body along its length, read from the mesh, so wind lines can hug it. */
type Profile = { x0: number; x1: number; top: number[]; side: number[] };
function bodyProfile(body: THREE.Object3D, bins = 48): Profile {
  body.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(body);
  const top = new Array<number>(bins).fill(0);
  const side = new Array<number>(bins).fill(0);
  const p = new THREE.Vector3();
  body.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const pos = o.geometry.getAttribute('position');
    for (let i = 0; i < pos.count; i += 3) {
      p.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      const b = Math.min(bins - 1, Math.max(0, Math.floor(((p.x - box.min.x) / (box.max.x - box.min.x)) * bins)));
      top[b] = Math.max(top[b] ?? 0, p.y);
      side[b] = Math.max(side[b] ?? 0, Math.abs(p.z));
    }
  });
  return { x0: box.min.x, x1: box.max.x, top, side };
}

/** Light lines that hug the body and stream off the back, the reference's sense of speed. */
class Wind {
  readonly object: THREE.Group = new THREE.Group();
  private readonly lines: { line: THREE.Line; pos: Float32Array; phase: number; len: number; lane: number; up: boolean; rate: number }[] = [];
  private readonly mat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  private profile: Profile | undefined;
  private static readonly POINTS = 14;

  constructor(count: number) {
    for (let i = 0; i < count; i++) {
      const pos = new Float32Array(Wind.POINTS * 3);
      const col = new Float32Array(Wind.POINTS * 3);
      const red = i % 7 === 0;
      for (let j = 0; j < Wind.POINTS; j++) {
        const f = (1 - j / (Wind.POINTS - 1)) ** 1.6; // bright head, fading tail
        col.set(red ? [f, f * 0.05, 0] : [f, f, f], j * 3);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const line = new THREE.Line(geo, this.mat);
      line.frustumCulled = false;
      this.object.add(line);
      this.lines.push({ line, pos, phase: Math.random(), len: 0, lane: 0, up: true, rate: 1 });
      this.respawn(this.lines[this.lines.length - 1]!);
    }
  }

  setProfile(p: Profile): void {
    this.profile = p;
  }

  private respawn(l: Wind['lines'][number]): void {
    l.len = 1.4 + Math.random() * 3.2;
    l.lane = Math.random() * 2 - 1;
    l.up = Math.random() < 0.55;
    l.rate = 0.7 + Math.random() * 0.6;
  }

  /** Surface point at x along the chosen lane (behind the car it keeps the tail's height). */
  private at(x: number, l: Wind['lines'][number], out: Float32Array, o: number): void {
    const p = this.profile;
    if (!p) return;
    const u = THREE.MathUtils.clamp((x - p.x0) / (p.x1 - p.x0), 0, 0.999);
    const b = Math.floor(u * p.top.length);
    const top = p.top[b] ?? 0.5;
    const side = p.side[b] ?? 0.5;
    const behind = Math.max(0, p.x0 - x); // past the tail the line drifts up and out a little
    if (l.up) out.set([x, top + 0.03 + behind * 0.06, l.lane * side * 0.7], o);
    else out.set([x, 0.25 + (l.lane * 0.5 + 0.5) * (top - 0.25) * 0.8, Math.sign(l.lane || 1) * (side + 0.04 + behind * 0.05)], o);
  }

  update(dt: number, flow: number, opacity: number): void {
    this.mat.opacity = opacity;
    this.object.visible = opacity > 0.01 && this.profile !== undefined;
    if (!this.object.visible || !this.profile) return;
    const { x0, x1 } = this.profile;
    const span = x1 - x0 + 2.5; // short tails: from the chase camera longer ones reach the lens
    for (const l of this.lines) {
      l.phase += dt * flow * l.rate;
      if (l.phase > 1) {
        l.phase -= 1;
        this.respawn(l);
      }
      const head = x1 + 0.2 - l.phase * span;
      // the tail trails toward where the head came from, but never past the nose
      for (let j = 0; j < Wind.POINTS; j++) this.at(Math.min(head + (j / (Wind.POINTS - 1)) * l.len, x1 + 0.05), l, l.pos, j * 3);
      l.line.geometry.getAttribute('position').needsUpdate = true;
    }
  }
}

export function mountCar(canvas: HTMLCanvasElement, opts: SceneOptions): Scene {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 400);

  const strips = stripMatcap();
  const bodyPaint = paint(strips, 1.4);
  const tyrePaint = paint(strips, 0.25);
  const mirrorPaint = paint(strips, 0.1);
  setUniform(mirrorPaint, 'uOpacity', 0.22);
  const paints = [bodyPaint, tyrePaint, mirrorPaint];

  // carRoot turns on the spot when driving; it holds the car, its reflection and the wind
  const carRoot = new THREE.Group();
  scene.add(carRoot);
  const wheels: THREE.Object3D[] = [];
  const mirrorWheels: THREE.Object3D[] = [];
  const wind = new Wind(44);
  const brakeGlow = new THREE.MeshBasicMaterial({ color: 0xff5a1f, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const mirrorGlow = brakeGlow.clone();
  carRoot.add(wind.object);

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
    const body = car.getObjectByName('body');
    if (body) wind.setProfile(bodyProfile(body));
    for (const name of ['wheel_fl', 'wheel_fr', 'wheel_rl', 'wheel_rr']) {
      const w = car.getObjectByName(name);
      if (!w) continue;
      rimLights(w);
      // carbon brake discs, glowing through the wheel face: dark until heat makes them glow
      for (const z of [0.205, -0.205]) {
        const disc = new THREE.Mesh(new THREE.RingGeometry(0.07, 0.17, 40), brakeGlow);
        disc.position.z = z;
        disc.userData['disc'] = true;
        w.add(disc);
      }
    }
    const mirror = car.clone(true);
    const dimRim = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.05, blending: THREE.AdditiveBlending, depthWrite: false });
    mirror.traverse((o) => {
      if (o instanceof THREE.Mesh) o.material = o.userData['disc'] ? mirrorGlow : o.userData['rim'] ? dimRim : mirrorPaint;
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

  // the stage: an elliptical platform line, and a dotted floor that streams under the car at speed
  const platform = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(
      Array.from({ length: 128 }, (_, i) => v(Math.cos((i / 128) * Math.PI * 2) * 4.2, 0, Math.sin((i / 128) * Math.PI * 2) * 2.7)),
    ),
    new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.12 }),
  );
  const GAP = 0.45;
  const dots: number[] = [];
  for (let x = -14; x <= 14; x += GAP) for (let z = -9; z <= 9; z += GAP) if ((x / 14) ** 2 + (z / 9) ** 2 < 1) dots.push(x, 0.002, z);
  const floorGeo = new THREE.BufferGeometry();
  floorGeo.setAttribute('position', new THREE.Float32BufferAttribute(dots, 3));
  const floorMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.016, transparent: true, opacity: 0, depthWrite: false });
  const floorDots = new THREE.Points(floorGeo, floorMat);

  // dust fills the whole view (not one patch) and streams past when moving
  const DUST = { n: 2600, x: 70, y: 26, z: 70 };
  const dustPos = new Float32Array(DUST.n * 3);
  for (let i = 0; i < DUST.n; i++) dustPos.set([(Math.random() - 0.5) * DUST.x, Math.random() * DUST.y - 4, (Math.random() - 0.5) * DUST.z], i * 3);
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.03, transparent: true, opacity: 0.32, depthWrite: false }));
  dust.frustumCulled = false;
  scene.add(platform, floorDots, dust);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.55, 0.4, 0.16);
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
  let flow = 0; // integrated speed: drives the paint bands, the floor and the dust
  const controls: Controls = { throttle: 0, brake: 0, steer: 0 };
  const car = { speed: 0, heading: 0, steer: 0, spin: 0, roll: 0, pitch: 0 };
  // gearbox and brakes: gear, engine rpm, time left in a shift, the camera kick of the last shift,
  // a shift counter for the HUD, brake heat 0..1, and the deceleration felt (m/s2, smoothed)
  const box = { gear: 1, rpm: 4000, shift: 0, kick: 0, shifts: 0, heat: 0, decel: 0 };
  let camHeading = 0;
  const pose = (n: number): Pose => POSES[n % POSES.length] ?? { pos: v(8, 3, 8), look: v(0, 0.4, 0) };
  const camPos = pose(0).pos.clone().multiplyScalar(1.5);
  const camLook = pose(0).look.clone();
  const target = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const up = THREE.Object3D.DEFAULT_UP;
  const start = performance.now();
  let last = start;
  let frame = 0;

  const TOP = 94; // m/s, about 340 km/h
  const RADIUS = 0.395;
  // top speed of each of the 8 gears at the limiter, m/s
  const GEAR_TOP = [80, 115, 150, 185, 220, 255, 295, 345].map((kmh) => kmh / 3.6);
  const LIMIT = 12000;
  const IDLE = 4000;
  const UPSHIFT = 11600;
  const DOWNSHIFT = 7200;
  const rpmIn = (gear: number, speed: number): number => Math.max(IDLE, (speed / (GEAR_TOP[gear - 1] ?? TOP)) * LIMIT);
  const tick = (now: number): void => {
    const t = (now - start) / 1000;
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    const k = 1 - Math.exp(-dt * 1.8);

    // ---- drive: speed and steering; the car turns on the spot and the world streams past ----
    if (driving) {
      // power falls off toward top speed; a seamless shift barely cuts it, so there is no lurch, only a nudge
      let push = controls.throttle * 14 * (1 - (car.speed / TOP) ** 1.8) * (box.shift > 0 ? 0.85 : 1);
      if (box.gear === 8 && box.rpm >= LIMIT) push = Math.min(push, 0); // on the limiter
      // carbon brakes with downforce: about 1.1 g when slow, near 5 g at top speed
      const brake = controls.brake * (11 + 0.0042 * car.speed * car.speed);
      const drag = 0.25 + 0.00042 * car.speed * car.speed;
      car.speed = THREE.MathUtils.clamp(car.speed + (push - brake - drag) * dt, 0, TOP);
      box.decel += (brake - box.decel) * Math.min(1, dt * 10);
      box.heat = THREE.MathUtils.clamp(box.heat + controls.brake * car.speed * dt * 0.03 - dt * 0.25, 0, 1);

      box.shift = Math.max(0, box.shift - dt);
      box.rpm = rpmIn(box.gear, car.speed);
      if (controls.throttle > 0 && box.rpm >= UPSHIFT && box.gear < 8 && box.shift === 0) {
        box.gear += 1;
        box.shift = 0.05;
        box.kick = 1;
        box.shifts += 1;
      } else if (box.rpm < DOWNSHIFT && box.gear > 1 && box.shift === 0) {
        box.gear -= 1; // the rpm jumps up in the lower gear: the blip on the way down
        box.shift = 0.05;
        box.kick = -0.4;
        box.shifts += 1;
      }
      box.rpm = rpmIn(box.gear, car.speed);

      car.steer += (controls.steer * 0.38 - car.steer) * Math.min(1, dt * 7);
      // the car turns only when it moves, and less sharply the faster it goes
      car.heading += car.steer * Math.min(1, car.speed / 20) * (2.6 / (1 + car.speed / 60)) * dt;
    } else {
      car.speed *= 1 - Math.min(1, dt * 1.5);
      car.steer *= 1 - Math.min(1, dt * 4);
      car.heading += Math.atan2(Math.sin(-car.heading), Math.cos(-car.heading)) * k;
      box.gear = 1;
      box.decel *= 1 - Math.min(1, dt * 4);
      box.heat = Math.max(0, box.heat - dt * 0.25);
    }
    box.kick *= Math.exp(-dt * 9);
    const sn = car.speed / TOP; // 0..1
    car.roll += (-car.steer * sn * 0.08 - car.roll) * Math.min(1, dt * 4);
    // the nose dips under braking and lifts a touch under power
    car.pitch += (-box.decel * 0.0011 + controls.throttle * sn * 0.004 - car.pitch) * Math.min(1, dt * 6);
    car.spin -= (car.speed / RADIUS) * dt * 0.25; // slowed down, or the eye reads a blur as standing still
    flow += dt * (0.35 + car.speed * 0.22);
    carRoot.rotation.set(car.roll, car.heading, driving ? car.pitch : 0, 'YXZ');
    brakeGlow.opacity = box.heat * 0.95;
    brakeGlow.color.setRGB(1, 0.18 + box.heat * 0.3, 0.05);
    mirrorGlow.opacity = brakeGlow.opacity * 0.15;
    for (const set of [wheels, mirrorWheels]) {
      set.forEach((w, i) => {
        w.rotation.z = car.spin;
        w.rotation.y = i < 2 ? car.steer : 0;
      });
    }
    engineRoot.position.copy(ENGINE_AT).applyAxisAngle(up, car.heading);
    engineRoot.rotation.y = car.heading;

    // ---- camera ----
    if (driving) {
      // chase camera: behind the car, swinging round a beat after it turns, as in a racing game
      camHeading += Math.atan2(Math.sin(car.heading - camHeading), Math.cos(car.heading - camHeading)) * Math.min(1, dt * 2.6);
      const behind = 5.6 + sn * 0.8 + box.kick * 0.3 - box.decel * 0.012; // a shift pushes the car away, braking lets the camera close in
      target.set(-behind * fit, 1.55 - sn * 0.2, 0).applyAxisAngle(up, camHeading);
      target.y += (Math.random() - 0.5) * 0.02 * sn * sn; // road buzz at speed
      tmp.set(5, 0.6, 0).applyAxisAngle(up, camHeading);
      camPos.lerp(target, 1 - Math.exp(-dt * 8));
      camLook.lerp(tmp, 1 - Math.exp(-dt * 8));
    } else {
      camHeading = car.heading;
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
    const fov = driving ? 48 + sn * 10 : 30;
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov += (fov - camera.fov) * Math.min(1, dt * 3);
      camera.updateProjectionMatrix();
    }

    // ---- paint, x-ray and the engine ----
    const xray = active === ENGINE_STAGE && !driving;
    const reveal = revealStart < 0 ? 3.2 : 3.2 - Math.min(1, (now - revealStart) / 2600) * 7;
    for (const m of paints) {
      setUniform(m, 'uTime', t);
      setUniform(m, 'uReveal', reveal);
      setUniform(m, 'uFlow', flow);
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
    for (const part of parts.values()) part.node.position.copy(part.home).addScaledVector(part.out, e);

    // ---- labels follow their parts on screen ----
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    for (const [key, el] of opts.labels) {
      const part = parts.get(key);
      if (!part) continue;
      part.node.getWorldPosition(tmp).project(camera);
      el.style.transform = `translate(${((tmp.x + 1) / 2) * w}px, ${((1 - tmp.y) / 2) * h}px)`;
      el.style.opacity = String(Math.max(0, explode * 1.4 - 0.4));
    }

    // ---- what streams past: wind lines on the body, floor dots, dust ----
    wind.update(dt, 0.12 + sn * 1.8, xray || !driving ? 0 : 0.1 + sn * 0.8);
    const back = tmp.set(-Math.cos(car.heading), 0, Math.sin(car.heading)); // the car's rear, in world space
    const travel = car.speed * dt;
    floorDots.position.addScaledVector(back, travel);
    floorDots.position.x = ((floorDots.position.x % GAP) + GAP) % GAP;
    floorDots.position.z = ((floorDots.position.z % GAP) + GAP) % GAP;
    floorMat.opacity += ((driving ? 0.12 + sn * 0.25 : 0) - floorMat.opacity) * k;
    platform.visible = !driving || sn < 0.05;
    for (let i = 0; i < DUST.n; i++) {
      const o = i * 3;
      let x = (dustPos[o] ?? 0) + back.x * travel * 0.6;
      let z = (dustPos[o + 2] ?? 0) + back.z * travel * 0.6;
      if (x < -DUST.x / 2) x += DUST.x;
      else if (x > DUST.x / 2) x -= DUST.x;
      if (z < -DUST.z / 2) z += DUST.z;
      else if (z > DUST.z / 2) z -= DUST.z;
      dustPos[o] = x;
      dustPos[o + 2] = z;
    }
    dustGeo.getAttribute('position').needsUpdate = travel > 0;
    if (!driving) dust.rotation.y = t * 0.008;

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
      const stopped = car.speed < 0.3 && controls.throttle === 0;
      return {
        kmh: car.speed * 3.6,
        gear: stopped ? 0 : box.gear,
        rpm: stopped ? IDLE : box.rpm,
        throttle: controls.throttle,
        brake: controls.brake,
        shifts: box.shifts,
      };
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
