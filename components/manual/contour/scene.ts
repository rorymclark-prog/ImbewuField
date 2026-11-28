import {
  ACESFilmicToneMapping, BackSide, BoxGeometry, CanvasTexture, Color, CylinderGeometry,
  DirectionalLight, DoubleSide, Fog, Group, HemisphereLight, IcosahedronGeometry, InstancedMesh,
  MathUtils, Mesh, MeshStandardMaterial, Object3D, PCFShadowMap, PerspectiveCamera,
  PlaneGeometry, RepeatWrapping, Scene, SphereGeometry, SRGBColorSpace, TextureLoader,
  TorusGeometry, Vector3, WebGLRenderer, BufferGeometry, Float32BufferAttribute, ShaderMaterial,
  type Material, type Texture,
} from 'three';
import { CROSSBAR_FRACTION, CROSSBAR_HALF_SPAN, FRAME_HEIGHT, TOTAL_PEGS, frameAtHeading, pegBesideFoot, practiceHeight, type FramePose, type GroundPoint } from '@/lib/contour-practice';

type RenderState = { pivot: GroundPoint; pose: FramePose | null; pegs: GroundPoint[] };

const up = new Vector3(0, 1, 0);
const fieldAssets = '/manual/exercises/contour/v1/';
const toVector = ({ x, y, z }: GroundPoint) => new Vector3(x, y, z);

function material(color: string, roughness = .9) {
  return new MeshStandardMaterial({ color, roughness });
}

function woodGrain() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.fillStyle = '#9d7352';
  context.fillRect(0, 0, 128, 256);
  for (let i = 0; i < 145; i++) {
    const x = (i * 43.19) % 128;
    context.strokeStyle = i % 2 ? '#50321d50' : '#eed3a857';
    context.lineWidth = .28 + i % 4 * .34;
    context.beginPath();
    context.moveTo(x, -8);
    context.bezierCurveTo(x + Math.sin(i * 2) * 8, 75, x - Math.cos(i) * 4, 154, x + 2, 265);
    context.stroke();
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function landscapeHeight(x: number, z: number) {
  const real = practiceHeight(x, z);
  const backdrop = .63 + Math.sin(x * .129 + z * .2) * 1.25 + Math.cos(x * .223) * .59;
  const distance = MathUtils.smoothstep(Math.abs(z), 4.5, 19);
  return MathUtils.lerp(real, backdrop, distance);
}

function groundMesh(columns: number, rows: number, xSize: number, zSize: number, surface: MeshStandardMaterial) {
  const geometry = new PlaneGeometry(xSize, zSize, columns, rows);
  geometry.rotateX(-Math.PI / 2);
  const positions = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  const colors: number[] = [];
  const base = new Color('#a5ad6d'), olive = new Color('#888f51'), straw = new Color('#b5a970');
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), z = positions.getZ(i);
    positions.setY(i, landscapeHeight(x, z));
    uv.setXY(i, x / 3.5, -z / 3.5);
    const mottling = Math.sin(x * .82 + z * .63) * Math.sin(z * 1.11 - x * .5);
    const tint = base.clone().lerp(mottling < 0 ? olive : straw, Math.abs(mottling) * .60);
    colors.push(tint.r, tint.g, tint.b);
  }
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const mesh = new Mesh(geometry, surface);
  mesh.receiveShadow = true;
  return mesh;
}

function addSky(scene: Scene) {
  const sky = new Mesh(new SphereGeometry(95, 20, 12), new ShaderMaterial({
    side: BackSide, depthWrite: false, fog: false,
    uniforms: {
      top: { value: new Color('#7ba0a8') }, horizon: { value: new Color('#f0e2c7') },
    },
    vertexShader: 'varying vec3 ray; void main() { ray=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `uniform vec3 top; uniform vec3 horizon; varying vec3 ray;
      void main() {
        vec3 dir=normalize(ray);
        float blend=smoothstep(-0.04,0.59,dir.y);
        float wisps=pow(max(0.0,sin(dir.x*23.0+sin(dir.z*13.0)*2.2+dir.y*40.0)),6.0);
        float cloud=wisps*smoothstep(0.05,0.18,dir.y)*(1.0-smoothstep(0.24,0.48,dir.y))*.25;
        gl_FragColor=vec4(mix(mix(horizon,top,blend),horizon,cloud),1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  sky.renderOrder = -5;
  scene.add(sky);
}

function vegetation(scene: Scene) {
  let seed = 797392;
  const random = () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const helper = new Object3D();
  const bladeGeometry = new BufferGeometry();
  bladeGeometry.setAttribute('position', new Float32BufferAttribute([
    -.015,0,0,.015,0,0,.009,.13,.035, -.015,0,0,.009,.13,.035,-.007,.13,.035,
    -.007,.13,.035,.009,.13,.035,.049,.239,.077,
    -.012,0,0,.012,0,0,-.08,.18,.04,
    -.012,0,0,.014,0,0,.018,.222,-.069,
  ], 3));
  bladeGeometry.computeVertexNormals();
  const blades = new InstancedMesh(bladeGeometry,
    new MeshStandardMaterial({ color: '#ffffff', roughness: .87, side: DoubleSide }), 4700);
  const palette = ['#a1a858', '#77925c', '#8b9b5c', '#c1aa69', '#9d965b'].map(hex => new Color(hex));
  let planted = 0;
  while (planted < blades.count) {
    const x = random() * 27 - 13.5, z = random() * 23 - 14;
    const near = x > -5 && x < 4.25 && Math.abs(z) < 1.25;
    if (near && random() < .89) continue;
    const patch = .74 + .26 * Math.sin(x * 1.21 + Math.sin(z * 1.2));
    if (random() > patch) continue;
    helper.position.set(x, landscapeHeight(x, z) - .012, z);
    helper.rotation.set(0, random() * Math.PI * 2, 0);
    const size = (near ? .57 : .91) * (.45 + random() * 1.85);
    helper.scale.set(size, size * (.61 + random() * .50), size);
    helper.updateMatrix();
    blades.setMatrixAt(planted, helper.matrix);
    blades.setColorAt(planted++, palette[Math.floor(random() * palette.length)]);
  }
  blades.receiveShadow = true;
  scene.add(blades);

  const stones = new InstancedMesh(new IcosahedronGeometry(1, 1), material('#e1d4b0'), 210);
  for (let i = 0; i < stones.count; i++) {
    const x = random() * 23 - 12, z = random() * 15 - 8;
    const size = .022 + random() ** 4 * .15;
    helper.position.set(x, landscapeHeight(x, z) + size * .17, z);
    helper.rotation.set(.08, random() * Math.PI * 2, .03);
    helper.scale.set(size * 1.48, size * .49, size);
    helper.updateMatrix();
    stones.setMatrixAt(i, helper.matrix);
    stones.setColorAt(i, new Color(i % 3 === 0 ? '#c1a78a' : '#a4a18b'));
  }
  stones.castShadow = stones.receiveShadow = true;
  scene.add(stones);

  const trunkShape = new CylinderGeometry(.05, .083, 1, 7);
  const crownShape = new IcosahedronGeometry(1, 2);
  const bark = material('#5d4932');
  const leaf = ['#535d30', '#677744', '#7c8951'].map(hex => material(hex));
  for (const [x, z, height] of [[-8.18, -4.73, 1.43], [5.58, -3.7, 1.74], [1.4, -10.8, 1.81],
    [-9.3, -14.2, 2.16], [10.7, -8.3, 1.83], [-3.2, -8.2, 1.10]]) {
    const tree = new Group();
    tree.position.set(x, landscapeHeight(x, z), z);
    tree.scale.setScalar(height);
    const trunk = new Mesh(trunkShape, bark);
    trunk.position.y = .48;
    trunk.rotation.z = .11;
    trunk.castShadow = true;
    tree.add(trunk);
    for (let i = 0; i < 10; i++) {
      const chunk = new Mesh(crownShape, leaf[i % leaf.length]);
      const angle = i * 2.39;
      const radius = i === 0 ? 0 : .21 + random() * .4;
      chunk.position.set(Math.cos(angle) * radius, .91 + random() * .36, Math.sin(angle) * radius * .82);
      chunk.scale.set(.28 + random() * .26, .15 + random() * .16, .29 + random() * .22);
      chunk.castShadow = true;
      chunk.receiveShadow = true;
      tree.add(chunk);
    }
    scene.add(tree);
  }
}

export async function createContourScene(canvas: HTMLCanvasElement, signal: AbortSignal) {
  const loader = new TextureLoader();
  // Loading starts only after opening the exercise. An aborted launch releases what arrived.
  const queue = await Promise.allSettled(['ground.webp', 'ground-normal.webp', 'soil.webp'].map(name => loader.loadAsync(fieldAssets + name)));
  const loaded = queue.flatMap(result => result.status === 'fulfilled' ? [result.value] : []);
  if (signal.aborted || loaded.length !== queue.length) {
    loaded.forEach(texture => texture.dispose());
    throw new Error('Contour assets did not load.');
  }
  const [photo, normal, soil] = loaded;
  photo.colorSpace = soil.colorSpace = SRGBColorSpace;
  for (const texture of loaded) texture.wrapS = texture.wrapT = RepeatWrapping;
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ canvas, alpha: false, antialias: true, powerPreference: 'low-power' });
  } catch (error) {
    loaded.forEach(texture => texture.dispose());
    throw error;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.65));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.type = PCFShadowMap;
  renderer.shadowMap.enabled = true;
  const camera = new PerspectiveCamera(40, 1, .05, 120);
  const scene = new Scene();
  scene.fog = new Fog('#dcd9bf', 13, 39);
  addSky(scene);
  const sun = new DirectionalLight('#ffdeae', 2.3);
  sun.position.set(-6, 10, 4);
  sun.castShadow = true;
  const shadowSize = canvas.clientWidth < 500 ? 1024 : 1536;
  sun.shadow.mapSize.set(shadowSize, shadowSize);
  Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 8, bottom: -8, near: .5, far: 28 });
  sun.shadow.normalBias = .018;
  sun.shadow.bias = -.00026;
  scene.add(new HemisphereLight('#e6f0ed', '#93845d', 2.0), sun);
  const surface = new MeshStandardMaterial({ map: photo, normalMap: normal, vertexColors: true, roughness: .94 });
  surface.normalScale.set(.70,.70);
  scene.add(groundMesh(127, 119, 46, 37, surface));
  vegetation(scene);

  const timber = material('#fff0d7', .77);
  timber.map = woodGrain();
  const twine = material('#c0a17a', 1);
  const cord = material('#201a18');
  const chalk = material('#f9e7b8');
  const bobMaterial = material('#65584a');
  const clay = new MeshStandardMaterial({ color: '#f3d5a4', map: soil, roughness: .98, side: DoubleSide });
  const activeColor = material('#ffda74', .63);
  const levelColor = material('#bde393', .58);
  const routeMaterial = material('#dec177');
  const position = new Vector3();
  const direction = new Vector3();
  const target = new Vector3();
  const woodCylinder = new CylinderGeometry(1, .89, 1, 10);
  const thinCylinder = new CylinderGeometry(1, 1, 1, 7);
  const frame = new Group();
  scene.add(frame);

  function rod(group: Group, surface: Material, geometry = thinCylinder) {
    const mesh = new Mesh(geometry, surface);
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  }
  function connect(mesh: Mesh, a: Vector3, b: Vector3, radius: number) {
    direction.subVectors(b, a);
    mesh.position.copy(a).lerp(b, .5);
    mesh.scale.set(radius, direction.length(), radius);
    mesh.quaternion.setFromUnitVectors(up, direction.normalize());
  }
  const legs = [rod(frame, timber, woodCylinder), rod(frame, timber, woodCylinder)];
  const bar = rod(frame, timber, woodCylinder);
  const string = rod(frame, cord);
  const bob = new Mesh(new IcosahedronGeometry(.077, 1), bobMaterial);
  bob.scale.set(.82, 1.11, .70);
  bob.castShadow = true;
  frame.add(bob);
  const middleMark = rod(frame, chalk);
  const bindings = new TorusGeometry(.058, .0095, 6, 18);
  bindings.rotateX(Math.PI / 2);
  const lashes = Array.from({ length: 9 }, () => {
    const mesh = new Mesh(bindings, twine);
    mesh.castShadow = true;
    frame.add(mesh);
    return mesh;
  });

  const pegShape = new BoxGeometry(.074, .40, .07);
  const stripeShape = new BoxGeometry(.08, .07, .077);
  const marker = material('#cf733e', .83);
  const bankMarker = material('#f6db9c', .84);
  const posts = Array.from({ length: TOTAL_PEGS }, () => {
    const post = new Group();
    const stake = new Mesh(pegShape, marker);
    stake.position.y = .14;
    stake.castShadow = stake.receiveShadow = true;
    const stripe = new Mesh(stripeShape, bankMarker);
    stripe.position.y = .257;
    post.add(stake, stripe);
    scene.add(post);
    return post;
  });

  const guideShape = new TorusGeometry(.16, .014, 7, 38);
  guideShape.rotateX(-Math.PI / 2);
  const guide = new Mesh(guideShape, activeColor);
  scene.add(guide);
  const footprint = new Mesh(new CylinderGeometry(.18, .18, .009, 40), clay);
  scene.add(footprint);
  const route = new Group();
  const line = Array.from({ length: TOTAL_PEGS - 1 }, () => rod(route, routeMaterial));
  scene.add(route);
  let state: RenderState | undefined;
  let animation = 0;
  let disposed = false;
  let viewportWidth = 0, viewportHeight = 0;
  let swing: { start: number; from: number; turn: number } | null = null;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function draw(timestamp: number) {
    animation = 0;
    if (!state || disposed || canvas.clientWidth === 0 || canvas.clientHeight === 0) return;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (viewportWidth !== width || viewportHeight !== height) {
      viewportWidth = width;
      viewportHeight = height;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    }

    const { pivot, pegs } = state;
    let pose = state.pose;
    let settle = 1;
    if (swing && pose) {
      const elapsed = Math.max(0, timestamp - swing.start);
      if (elapsed < 490) {
        settle = MathUtils.smoothstep(elapsed, 0, 490);
        pose = frameAtHeading(pivot, swing.from + swing.turn * settle);
        requestDraw();
      } else {
        swing = null;
      }
    }
    const markers = pegs.map(pegBesideFoot);
    posts.forEach((post, index) => {
      const peg = markers[index];
      post.visible = Boolean(peg);
      if (peg) {
        const drop = index === pegs.length - 1 ? .28 * (1 - settle) : 0;
        post.position.set(peg.x, peg.y + drop, peg.z);
      }
    });
    line.forEach((segment, index) => {
      const a = markers[index], b = markers[index + 1];
      segment.visible = Boolean(b);
      if (b) {
        connect(segment, position.set(a.x, a.y + .142, a.z), target.set(b.x, b.y + .142, b.z), .013);
      }
    });
    frame.visible = guide.visible = footprint.visible = Boolean(pose);

    if (pose) {
      const fixed = toVector(pivot);
      const free = toVector(pose.free);
      const across = new Vector3().subVectors(free, fixed).normalize();
      const vertical = new Vector3().copy(up).addScaledVector(across, -across.y).normalize();
      const front = new Vector3().crossVectors(across, vertical);
      const middle = fixed.clone().lerp(free, .5);
      const apex = middle.clone().addScaledVector(vertical, FRAME_HEIGHT);
      const barMiddle = middle.clone().addScaledVector(vertical, FRAME_HEIGHT * CROSSBAR_FRACTION);
      const left = barMiddle.clone().addScaledVector(across, -CROSSBAR_HALF_SPAN - .046);
      const right = barMiddle.clone().addScaledVector(across, CROSSBAR_HALF_SPAN + .046);
      connect(legs[0], fixed, apex, .044);
      connect(legs[1], free, apex, .052);
      connect(bar, left, right, .036);
      middleMark.material = pose.aligned ? levelColor : chalk;
      const notch = barMiddle.clone().addScaledVector(front, .040);
      connect(middleMark, notch.clone().addScaledVector(vertical, -.043), notch.clone().addScaledVector(vertical, .043), .011);

      // Hang from the front edge of the frame so the string stays visible across the crossbar.
      const attachment = apex.clone().addScaledVector(front, .061);
      bob.position.copy(attachment).addScaledVector(up, -FRAME_HEIGHT * .68);
      connect(string, attachment, bob.position, .009);
      lashes.forEach((binding, index) => {
        const bundle = Math.floor(index / 3);
        const shift = ((index % 3) - 1) * .019;
        const joint = bundle === 0 ? apex : bundle === 1 ? left : right;
        binding.position.copy(joint);
        if (bundle !== 0) binding.position.addScaledVector(across, bundle === 1 ? .05 : -.05);
        binding.position.addScaledVector(vertical, bundle === 0 ? shift - .043 : shift);
        binding.quaternion.setFromUnitVectors(up, vertical);
      });

      guide.material = pose.aligned ? levelColor : activeColor;
      guide.position.copy(free).addScaledVector(up, .042);
      footprint.position.copy(free).addScaledVector(up, .019);
      const portrait = Math.max(1, 1.09 / camera.aspect);
      camera.position.set(middle.x + .56 * portrait, 2.10 * portrait, middle.z + 4.50 * portrait);
      camera.lookAt(middle.x, .76, middle.z - .30);
    } else {
      const first = pegs[0], last = pegs[pegs.length - 1];
      const center = (first.x + last.x) / 2;
      const distance = Math.max(1, 1.61 / camera.aspect);
      camera.position.set(center + .92, 4.8 * distance, 6.7 * distance);
      camera.lookAt(center, -.06, -.19);
    }
    renderer.render(scene, camera);
  }
  function requestDraw() {
    if (!disposed && !animation) animation = requestAnimationFrame(draw);
  }
  const observer = new ResizeObserver(requestDraw);
  observer.observe(canvas);

  return {
    update(next: RenderState) {
      swing = null;
      if (state && next.pose && next.pegs.length > state.pegs.length && !reducedMotion.matches) {
        const from = Math.atan2(state.pivot.z - next.pivot.z, state.pivot.x - next.pivot.x);
        const to = Math.atan2(next.pose.free.z - next.pivot.z, next.pose.free.x - next.pivot.x);
        const turn = MathUtils.euclideanModulo(to - from + Math.PI, Math.PI * 2) - Math.PI;
        swing = { from, turn, start: performance.now() };
      }
      state = next;
      requestDraw();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      observer.disconnect();
      cancelAnimationFrame(animation);
      const textures = new Set<Texture>(loaded);
      if (timber.map) textures.add(timber.map);
      const materials = new Set<Material>();
      const geometries = new Set<BufferGeometry>();
      scene.traverse(obj => {
        if (obj instanceof Mesh) {
          geometries.add(obj.geometry);
          for (const entry of Array.isArray(obj.material) ? obj.material : [obj.material]) materials.add(entry);
        }
        if (obj instanceof InstancedMesh) obj.dispose();
      });
      geometries.forEach(geometry => geometry.dispose());
      materials.forEach(surface => surface.dispose());
      textures.forEach(texture => texture.dispose());
      sun.shadow.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
