/**
 * Asteroid Field — main.js
 *
 * Skybox textures  → /assets/textures/skybox
 * Asteroid model   → /assets/models/asteroid
 *
 * Controls: left-drag to orbit · scroll to zoom · right-drag to pan
 * Hover over an asteroid to highlight it (red emissive, forest-exercise style).
 * Click & drag to move it — orbit recalculates from the drop position.
 * 
 * npm run dev per eseguire
 * 
 */

import * as THREE from 'three'
import { OrbitControls }  from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader }     from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader }    from 'three/examples/jsm/loaders/DRACOLoader.js'
import GUI from 'lil-gui'

// ─── Loading UI helpers ───────────────────────────────────────────────────────
const loadingScreen = document.getElementById('loading-screen')
const loadingText   = document.getElementById('loading-text')
const loadingBar    = document.getElementById('loading-bar')

function setProgress(fraction, label = '') {
  loadingBar.style.width = `${Math.round(fraction * 100)}%`
  if (label) loadingText.textContent = label
}

function hideLoadingScreen() {
  loadingScreen.classList.add('hidden')
  setTimeout(() => loadingScreen.remove(), 700)
}

// ─── Renderer ─────────────────────────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.shadowMap.enabled   = true
renderer.shadowMap.type      = THREE.PCFSoftShadowMap
renderer.toneMapping         = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.2
document.body.appendChild(renderer.domElement)

// ─── Scene ────────────────────────────────────────────────────────────────────
const scene = new THREE.Scene()

// ─── Camera ───────────────────────────────────────────────────────────────────
const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  5000
)
camera.position.set(0, 40, 120)

// ─── Orbit controls ───────────────────────────────────────────────────────────
const controls = new OrbitControls(camera, renderer.domElement)
controls.target.set(0, 0, 0)
controls.enableDamping  = true
controls.dampingFactor  = 0.05
controls.minDistance    = 10
controls.maxDistance    = 600
controls.update()

// ─── Lights ───────────────────────────────────────────────────────────────────
const ambient = new THREE.AmbientLight(0xfff5e0, 1.2)
scene.add(ambient)

const sun = new THREE.DirectionalLight(0xfff5e0, 5)
sun.position.set(200, 150, 80)
sun.castShadow           = true
sun.shadow.mapSize.set(2048, 2048)
sun.shadow.camera.near   =   1
sun.shadow.camera.far    = 800
sun.shadow.camera.left   = -250
sun.shadow.camera.right  =  250
sun.shadow.camera.top    =  250
sun.shadow.camera.bottom = -250
sun.shadow.bias          = -0.001
scene.add(sun)
scene.add(sun.target)

const rimLight = new THREE.DirectionalLight(0x2244aa, 0.6)
rimLight.position.set(-150, -80, -120)
scene.add(rimLight)

// ─── Debug GUI ────────────────────────────────────────────────────────────────
const guiParams = {
  // Orbite
  orbitSpeedMultiplier: 1.0,
  spinSpeedMultiplier:  1.0,
  // Campo
  fieldRadius:    200,
  fieldThickness: 60,
  // Luci
  shadows:          true,
  ambientIntensity: 1.2,
  sunIntensity:     3.5,
  // Collisioni
  collisionsEnabled: true,
  // Esplosioni
  particleCount:     500,
  explosionDuration: 2.0,
  explosionSpeed:    40,
  particleSize:      4,
  // Navicella
  shipSpeed:      0.3,
  followShip:     false,
}

const gui = new GUI({ title: 'Asteroid Field' })

// ── Sezione: Orbite ───────────────────────────────────────────────────────────
const folderOrbits = gui.addFolder('Orbits')
folderOrbits.add(guiParams, 'orbitSpeedMultiplier', 0, 5, 0.01).name('Orbit Speed')
folderOrbits.add(guiParams, 'spinSpeedMultiplier',  0, 5, 0.01).name('Spin Speed')

// ── Sezione: Campo ────────────────────────────────────────────────────────────
const folderField = gui.addFolder('Field')

let prevFieldRadius = guiParams.fieldRadius

folderField.add(guiParams, 'fieldRadius', 50, 500, 1).name('Radius').onChange((val) => {
  const ratio = val / FIELD_RADIUS   // sempre relativo al valore originale
  asteroidGroup.children.forEach((asteroid) => {
    asteroid.userData.orbitRadius = asteroid.userData.baseOrbitRadius * ratio
  })
  prevFieldRadius = val
})

let prevFieldThickness = guiParams.fieldThickness

folderField.add(guiParams, 'fieldThickness', 0, 200, 1).name('Thickness').onChange((val) => {
  const ratio = val / FIELD_THICKNESS   // sempre relativo al valore originale
  asteroidGroup.children.forEach((asteroid) => {
    asteroid.userData.orbitY = asteroid.userData.baseOrbitY * ratio
  })
  prevFieldThickness = val
})

// ── Sezione: Luci ─────────────────────────────────────────────────────────────
const folderLights = gui.addFolder('Lights')
folderLights.add(guiParams, 'shadows').name('Shadows').onChange((val) => {
  renderer.shadowMap.enabled = val
  scene.traverse((node) => {
    if (node.isMesh) node.material.needsUpdate = true
  })
})
folderLights.add(guiParams, 'ambientIntensity', 0, 20,  0.1).name('Ambient').onChange((val) => {
  ambient.intensity = val
})
folderLights.add(guiParams, 'sunIntensity',     0, 15, 0.1 ).name('Sun').onChange((val) => {
  sun.intensity = val
})

// ── Sezione: Collisioni ───────────────────────────────────────────────────────
const folderCollisions = gui.addFolder('Collisions')
folderCollisions.add(guiParams, 'collisionsEnabled').name('Enabled')

// ── Sezione: Esplosioni ───────────────────────────────────────────────────────
const folderExplosions = gui.addFolder('Explosions')
folderExplosions.add(guiParams, 'particleCount',     50, 2000, 10).name('Particles')
folderExplosions.add(guiParams, 'explosionDuration', 0.5, 8,  0.1).name('Duration (s)')
folderExplosions.add(guiParams, 'explosionSpeed',    5,  150,  1 ).name('Speed')
folderExplosions.add(guiParams, 'particleSize',      1,   20,  0.5).name('Particle Size')

// ── Sezione: Navicella ────────────────────────────────────────────────────────
const folderShip = gui.addFolder('Ship')
folderShip.add(guiParams, 'shipSpeed', 0.05, 2, 0.01).name('Speed')
folderShip.add(guiParams, 'followShip').name('Follow Camera').onChange((val) => {
  if (!val) {
    // Quando si disattiva, ripristina la camera alla posizione originale
    controls.enabled = true
    camera.position.set(0, 40, 120)
    controls.target.set(0, 0, 0)
    controls.update()
  }
})

// ─── Skybox ───────────────────────────────────────────────────────────────────
// PATH PLACEHOLDER
const SKYBOX_PATH  = '/textures/skybox/'
const SKYBOX_FILES = [
  'px.jpg',  // +X right
  'nx.jpg',  // −X left
  'py.jpg',  // +Y top
  'ny.jpg',  // −Y bottom
  'pz.jpg',  // +Z front
  'nz.jpg',  // −Z back
]

// ─── Asteroid constants ───────────────────────────────────────────────────────
const ASTEROID_COUNT  = 20
const FIELD_RADIUS    = 200
const FIELD_THICKNESS = 60
const SCALE_MIN       = 5
const SCALE_MAX       = 25

// ─── Asteroid group ───────────────────────────────────────────────────────────
const asteroidGroup = new THREE.Group()
scene.add(asteroidGroup)

// ─── Loaders ──────────────────────────────────────────────────────────────────
const manager     = new THREE.LoadingManager()
const cubeLoader  = new THREE.CubeTextureLoader(manager)
const gltfLoader  = new GLTFLoader(manager)
const dracoLoader = new DRACOLoader()
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/')
gltfLoader.setDRACOLoader(dracoLoader)

manager.onProgress = (_url, loaded, total) => {
  setProgress(loaded / total, `Loading assets… ${loaded}/${total}`)
}
manager.onLoad = () => {
  setProgress(1, 'Done!')
  hideLoadingScreen()
}

// ─── Skybox ───────────────────────────────────────────────────────────────────
setProgress(0, 'Loading skybox…')
const skyboxTexture = cubeLoader.load(
  SKYBOX_FILES.map(f => SKYBOX_PATH + f),
  () => {
    scene.background = skyboxTexture
    setProgress(0.3, 'Skybox loaded — loading asteroid mesh…')
  }
)

// ─── Asteroid model ───────────────────────────────────────────────────────────
// PATH PLACEHOLDER
const ASTEROID_MODEL_PATH = '/models/asteroid/scene.gltf'

gltfLoader.load(
  ASTEROID_MODEL_PATH,

  (gltf) => {
    const sourceScene = gltf.scene
    sourceScene.traverse((node) => {
      if (node.isMesh) {
        node.castShadow    = true
        node.receiveShadow = true
      }
    })

    const bbox = new THREE.Box3().setFromObject(sourceScene)
    const size = new THREE.Vector3()
    bbox.getSize(size)
    const maxDim    = Math.max(size.x, size.y, size.z)
    const normalise = maxDim > 0 ? 1 / maxDim : 1

    for (let i = 0; i < ASTEROID_COUNT; i++) {
      const clone  = sourceScene.clone(true)
      const angle  = Math.random() * Math.PI * 2
      const radius = FIELD_RADIUS * (0.5 + Math.random() * 0.5)
      const yOff   = (Math.random() - 0.5) * FIELD_THICKNESS * 2

      clone.position.set(Math.cos(angle) * radius, yOff, Math.sin(angle) * radius)

      const s = (SCALE_MIN + Math.random() * (SCALE_MAX - SCALE_MIN)) * normalise
      clone.scale.setScalar(s)
      clone.updateMatrixWorld(true)

      const sphere = new THREE.Sphere()
      new THREE.Box3()
        .setFromObject(clone)
        .getBoundingSphere(sphere)

      clone.userData.collisionRadius = sphere.radius

      clone.rotation.set(
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2
      )

      const axis = new THREE.Vector3(
        (Math.random() - 0.5) * 0.3,
        1,
        (Math.random() - 0.5) * 0.3
      ).normalize()

      // clone.userData.orbitAxis   = axis
      clone.userData.orbitAxis = new THREE.Vector3(0, 1, 0)
      clone.userData.orbitSpeed  = 0.005 + Math.random() * 0.025
      clone.userData.orbitAngle  = angle
      clone.userData.orbitRadius = radius
      clone.userData.orbitY      = yOff
      clone.userData.spinAxis    = new THREE.Vector3(
        Math.random() - 0.5,
        Math.random() - 0.5,
        Math.random() - 0.5
      ).normalize()
      clone.userData.spinSpeed   = 0.1 + Math.random() * 0.4
      // FIX: flag usato dall'animate loop per saltare l'orbita durante il drag.
      // Più robusto del confronto per riferimento (asteroid === draggedAsteroid)
      // perché funziona indipendentemente da quale livello della gerarchia
      // findRootAsteroid restituisce.
      clone.userData.isDragged   = false
      clone.userData.id = `asteroid-${i}`

      clone.userData.baseOrbitRadius = clone.userData.orbitRadius
      clone.userData.baseOrbitY      = clone.userData.orbitY


      // Ensure each clone has its own material instances so changing
      // `emissive` on one mesh doesn't affect all clones sharing the same
      // material reference from the original GLTF scene.
      clone.traverse((node) => {
        if (node.isMesh && node.material) {
          node.material = Array.isArray(node.material)
            ? node.material.map(m => m.clone())
            : node.material.clone()
          node.castShadow = true
          node.receiveShadow = true
        }
      })

      asteroidGroup.add(clone)
    }

    setProgress(0.9, 'Building scene…')
  },

  (xhr) => {
    if (xhr.total > 0) {
      const p = 0.3 + (xhr.loaded / xhr.total) * 0.6
      setProgress(p, `Loading model… ${Math.round(p * 100)}%`)
    }
  },

  (err) => {
    console.error('GLTFLoader error:', err)
    loadingText.textContent = 'Could not load asteroid model, check the path in main.js'
    loadingBar.style.background = '#c0392b'
  }
)

// ─── Ship model ───────────────────────────────────────────────────────────────
const SHIP_MODEL_PATH = '/models/spaceship/scene.gltf'

gltfLoader.load(
  SHIP_MODEL_PATH,

  (gltf) => {
    ship = gltf.scene

    // Normalizza dimensione
    const bbox = new THREE.Box3().setFromObject(ship)
    const size = new THREE.Vector3()
    bbox.getSize(size)
    const maxDim = Math.max(size.x, size.y, size.z)
    const norm   = maxDim > 0 ? 1 / maxDim : 1
    ship.scale.setScalar(norm * 25)

    ship.traverse((node) => {
      if (node.isMesh) {
        node.castShadow    = true
        node.receiveShadow = true
      }
    })

    // Posizione iniziale sull'orbita
    ship.position.set(SHIP_ORBIT_RADIUS, SHIP_ORBIT_Y, 0)

    // Bounding sphere per collisioni
    const sphere = new THREE.Sphere()
    new THREE.Box3().setFromObject(ship).getBoundingSphere(sphere)
    ship.userData.collisionRadius = sphere.radius

    scene.add(ship)
  },

  undefined,

  (err) => {
    console.error('Ship GLTFLoader error:', err)
  }
)

// ─────────────────────────────────────────────────────────────────────────────
//  INTERACTION SYSTEM
//
//  Highlight — forest-exercise pattern (intersectNaiveGeometry):
//    • Every frame, cast a ray from pointer → intersectObjects on asteroidGroup
//    • If we land on a new mesh: restore emissive of previous, store currentHex
//      of the new one, set its emissive to 0xff0000
//    • intersected tracks the single currently-red mesh (the deepest Mesh node
//      hit by the ray, not the root Group — exactly like the forest exercise)
//
//  Drag:
//    • mousedown: build a camera-facing drag plane passante per hits[0].point
//      (il punto esatto sulla superficie, non il pivot del root Group)
//    • mousemove: intersect ray with plane → converti _hit in local space di
//      asteroidGroup prima di assegnarlo a .position
//    • mouseup: leggi la world position con getWorldPosition() per ricalcolare
//      i parametri orbitali (orbitRadius, orbitAngle, orbitY)
// ─────────────────────────────────────────────────────────────────────────────

const raycaster = new THREE.Raycaster()
const pointer   = new THREE.Vector2(-999, -999)   // NDC, starts off-screen

const dragPlane = new THREE.Plane()
const _hit      = new THREE.Vector3()

let draggedAsteroid = null   // root Group being dragged
let dragOffset      = null   // offset da pivot a hit point, in world space

// ── Navicella ─────────────────────────────────────────────────────────────────
let ship = null          // THREE.Object3D, assegnato dopo il caricamento del modello
let shipAngle = 0        // angolo corrente sull'orbita
let shipDead  = false    // true dopo collisione → blocca update

// Raggio orbita navicella: appena fuori dal bordo esterno del campo
const SHIP_ORBIT_RADIUS = FIELD_RADIUS * 1.15
const SHIP_ORBIT_Y      = 0

// Offset camera in modalità follow (world space relativo alla navicella)
const CAM_OFFSET = new THREE.Vector3(0, 15, -40)

// ── Highlight state ───────────────────────────────────────────────────────────
let intersected = null
let hoveredRoot = null

// ── Helper: risale la gerarchia fino al figlio diretto di asteroidGroup ───────
function findRootAsteroid(object) {
  let current = object
  while (current.parent && current.parent !== asteroidGroup) {
    current = current.parent
  }
  return current.parent === asteroidGroup ? current : null
}

// ── Hover highlight (chiamata ogni frame) ─────────────────────────────────────
function updateHoverHighlight() {
  raycaster.setFromCamera(pointer, camera)
  const intersects = raycaster.intersectObjects(asteroidGroup.children, true)

  if (intersects.length > 0) {
    const mesh = intersects[0].object
    const root = findRootAsteroid(mesh)

    if (intersected !== mesh) {
      if (intersected) intersected.material.emissive.setHex(intersected.currentHex)
      intersected = mesh
      intersected.currentHex = intersected.material.emissive.getHex()
      intersected.material.emissive.setHex(0xff0000)
    }

    if (root !== hoveredRoot) {
      hoveredRoot = root
      if (hoveredRoot) console.log('Hover asteroid id:', hoveredRoot.userData.id)
    }
  } else {
    if (intersected) intersected.material.emissive.setHex(intersected.currentHex)
    intersected = null
    hoveredRoot = null
  }
}

// ── Collision detection ─────────────────────────────────────
function checkCollisions() {
  const toRemove = new Set()

  const asteroids = asteroidGroup.children

  for (let i = 0; i < asteroids.length; i++) {
    for (let j = i + 1; j < asteroids.length; j++) {

      const a = asteroids[i]
      const b = asteroids[j]

      const posA = new THREE.Vector3()
      const posB = new THREE.Vector3()
      a.getWorldPosition(posA)
      b.getWorldPosition(posB)
      const distance = posA.distanceTo(posB)

      if (distance < a.userData.collisionRadius + b.userData.collisionRadius) {

        const center = new THREE.Vector3()
          .addVectors(a.position, b.position)
          .multiplyScalar(0.5)

        console.log('Collision between:', a.userData.id, b.userData.id)
        createExplosion(center)

        toRemove.add(a)
        toRemove.add(b)
      }
    }
  }

  toRemove.forEach(obj => asteroidGroup.remove(obj))
}

// ── Explosion effect ─────────────────────────────────────────
const explosions = []

function createExplosion(position) {
  const particleCount = guiParams.particleCount

  const geometry  = new THREE.BufferGeometry()
  const positions = new Float32Array(particleCount * 3)
  const velocities = []

  for (let i = 0; i < particleCount; i++) {
    positions[i * 3]     = position.x
    positions[i * 3 + 1] = position.y
    positions[i * 3 + 2] = position.z

    const dir = new THREE.Vector3(
      Math.random() - 0.5,
      Math.random() - 0.5,
      Math.random() - 0.5
    ).normalize()

    // explosionSpeed è la velocità massima — minimo è metà
    dir.multiplyScalar(guiParams.explosionSpeed * 0.5 + Math.random() * guiParams.explosionSpeed * 0.5)
    velocities.push(dir)
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))

  const material = new THREE.PointsMaterial({
    size:        guiParams.particleSize,
    color:       0xffdd66,
    transparent: true,
    opacity:     1,
    depthWrite:  false,
    blending:    THREE.AdditiveBlending,
  })

  const light = new THREE.PointLight(0xffaa33, 250, 300)
  light.position.copy(position)
  scene.add(light)

  const points = new THREE.Points(geometry, material)
  scene.add(points)

  explosions.push({
    points,
    light,
    velocities,
    life:    guiParams.explosionDuration,   // ← usa GUI
    maxLife: guiParams.explosionDuration,   // ← usa GUI
  })
}

// ─── Ship update ──────────────────────────────────────────────────────────────
const _shipPos    = new THREE.Vector3()
const _camTarget  = new THREE.Vector3()
const _camDesired = new THREE.Vector3()

function updateShip(dt) {
  if (!ship || shipDead) return

  // ── Orbita ──────────────────────────────────────────────────────────────────
  shipAngle += guiParams.shipSpeed * dt
  const sx = Math.cos(shipAngle) * SHIP_ORBIT_RADIUS
  const sz = Math.sin(shipAngle) * SHIP_ORBIT_RADIUS
  ship.position.set(sx, SHIP_ORBIT_Y, sz)

  // Orienta la prua nella direzione del moto (tangente all'orbita)
  const tangent = new THREE.Vector3(-Math.sin(shipAngle), 0, Math.cos(shipAngle))
  ship.lookAt(ship.position.clone().sub(tangent))

  // ── Collisione con asteroidi ─────────────────────────────────────────────────
  ship.getWorldPosition(_shipPos)

  for (const asteroid of asteroidGroup.children) {
    const aPos = new THREE.Vector3()
    asteroid.getWorldPosition(aPos)
    const dist = _shipPos.distanceTo(aPos)

    if (guiParams.collisionsEnabled && dist < ship.userData.collisionRadius + asteroid.userData.collisionRadius) {
      // Esplosione al centro tra navicella e asteroide
      const center = new THREE.Vector3().addVectors(_shipPos, aPos).multiplyScalar(0.5)
      createExplosion(center)
      scene.remove(ship)
      shipDead = true
      console.log('SHIP DESTROYED! Collision with asteroid id:', asteroid.userData.id)
      return
    }
  }

  // ── Camera follow ────────────────────────────────────────────────────────────
  if (guiParams.followShip) {
    // Azzera il pan di OrbitControls al momento dell'attivazione —
    // controls.target spostato dal pan combatterebbe con il nostro lookAt.
    // Resettiamo target → origin una sola volta per evitare il lerp che
    // "tira" la camera verso il vecchio target ad ogni frame.
    if (controls.enabled) {
      controls.target.set(0, 0, 0)
      controls.update()
    }
    controls.enabled = false

    _camDesired.copy(CAM_OFFSET).applyQuaternion(ship.quaternion).add(ship.position)
    camera.position.lerp(_camDesired, 0.08)

    _camTarget.copy(ship.position)
    camera.lookAt(_camTarget)
  } else {
    controls.enabled = true
  }
}

// ── mousemove ─────────────────────────────────────────────────────────────────
window.addEventListener('mousemove', (e) => {
  pointer.x =  (e.clientX / window.innerWidth)  * 2 - 1
  pointer.y = -(e.clientY / window.innerHeight) * 2 + 1

  if (!draggedAsteroid) return

  raycaster.setFromCamera(pointer, camera)
  if (!raycaster.ray.intersectPlane(dragPlane, _hit)) return

  // FIX: _hit è in world space, ma .position è in local space di asteroidGroup.
  // worldToLocal converte il punto prima di assegnarlo, altrimenti l'asteroide
  // finisce in una posizione sbagliata se asteroidGroup ha una matrice non-identity.
  const worldTarget = new THREE.Vector3().copy(_hit).add(dragOffset)
  asteroidGroup.worldToLocal(worldTarget)
  draggedAsteroid.position.copy(worldTarget)

  // console.log('hit', _hit)
  // console.log('asteroid', draggedAsteroid.position)
  // console.log(
  //   'distance mouse->plane',
  //   camera.position.distanceTo(_hit)
  // )
})

// ── mousedown ─────────────────────────────────────────────────────────────────
renderer.domElement.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return

  pointer.x =  (e.clientX / window.innerWidth)  * 2 - 1
  pointer.y = -(e.clientY / window.innerHeight) * 2 + 1

  raycaster.setFromCamera(pointer, camera)
  const hits = raycaster.intersectObjects(asteroidGroup.children, true)

  if (hits.length === 0) return

  const root = findRootAsteroid(hits[0].object)
  if (!root) return

  draggedAsteroid = root
  // FIX: flag sul clone invece di confronto per riferimento nell'animate loop.
  draggedAsteroid.userData.isDragged = true

  // FIX: drag plane passante per hits[0].point (punto esatto sulla superficie),
  // non per draggedAsteroid.position (pivot del root Group).
  // Evita il "salto" al primo movimento quando il click non è sul centro del mesh.
  const camDir = new THREE.Vector3()
  camera.getWorldDirection(camDir)
  dragPlane.setFromNormalAndCoplanarPoint(camDir.negate(), hits[0].point)

  // Offset = world position del root − hits[0].point.
  // Usiamo direttamente hits[0].point invece di fare una seconda intersezione
  // col piano: è lo stesso valore (il piano passa esattamente per quel punto)
  // ma evita qualsiasi drift numerico da una doppia chiamata al raycaster.
  const worldPos = new THREE.Vector3()
  draggedAsteroid.getWorldPosition(worldPos)
  console.log('Rilascio - inizio posizione (world):', worldPos.toArray())
  dragOffset = new THREE.Vector3().subVectors(worldPos, hits[0].point)

  controls.enabled = false
  e.stopPropagation()

  // console.log('root', worldPos)
  // console.log('hit', hits[0].point)
  // console.log(
  //   'distance',
  //   worldPos.distanceTo(hits[0].point)
  // )
})

// ── mouseup ───────────────────────────────────────────────────────────────────
window.addEventListener('mouseup', () => {
  if (!draggedAsteroid) return

  // FIX: .position è in local space → getWorldPosition() per i parametri orbitali.
  const worldPos = new THREE.Vector3()
  draggedAsteroid.getWorldPosition(worldPos)
  console.log('Rilascio - fine posizione (world):', worldPos.toArray())

  draggedAsteroid.userData.orbitRadius = Math.sqrt(worldPos.x * worldPos.x + worldPos.z * worldPos.z)
  draggedAsteroid.userData.orbitAngle  = -Math.atan2(worldPos.z, worldPos.x)
  draggedAsteroid.userData.orbitY      = worldPos.y
  // draggedAsteroid.userData.orbitAxis   = new THREE.Vector3(
  //   (Math.random() - 0.5) * 0.3,
  //   1,
  //   (Math.random() - 0.5) * 0.3
  // ).normalize()
  draggedAsteroid.userData.orbitAxis = new THREE.Vector3(0, 1, 0)

  console.log('prima', worldPos.toArray())
  
  const test = new THREE.Vector3(
    draggedAsteroid.userData.orbitRadius,
    draggedAsteroid.userData.orbitY,
    0
  )
  
  const q = new THREE.Quaternion().setFromAxisAngle(
    draggedAsteroid.userData.orbitAxis,
    draggedAsteroid.userData.orbitAngle
  )
  
  test.applyQuaternion(q)
  
  console.log('ricostruita', test.toArray())

  draggedAsteroid.userData.isDragged = false
  draggedAsteroid  = null
  dragOffset       = null
  controls.enabled = true
})

// ─── Resize handler ───────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
})

// ─── Animation loop ───────────────────────────────────────────────────────────
const clock = new THREE.Clock()
const _quat = new THREE.Quaternion()
const _axis = new THREE.Vector3()

function animate() {
  requestAnimationFrame(animate)

  const dt = clock.getDelta()

  updateHoverHighlight()

  asteroidGroup.children.forEach((asteroid) => {
    if (asteroid.userData.isDragged) return

    const ud = asteroid.userData

    ud.orbitAngle += ud.orbitSpeed * guiParams.orbitSpeedMultiplier * dt
    _axis.copy(ud.orbitAxis)
    _quat.setFromAxisAngle(_axis, ud.orbitAngle)
    const worldPos = new THREE.Vector3(ud.orbitRadius, ud.orbitY, 0)
    worldPos.applyQuaternion(_quat)
    asteroidGroup.worldToLocal(worldPos)
    asteroid.position.copy(worldPos)

    asteroid.rotateOnAxis(ud.spinAxis, ud.spinSpeed * guiParams.spinSpeedMultiplier * dt)
  })

  if (guiParams.collisionsEnabled) checkCollisions()
  updateShip(dt)

  for (let e = explosions.length - 1; e >= 0; e--) {

    const explosion = explosions[e]

    const positions =
      explosion.points.geometry.attributes.position.array

    for (let i = 0; i < explosion.velocities.length; i++) {

      positions[i * 3]     += explosion.velocities[i].x * dt
      positions[i * 3 + 1] += explosion.velocities[i].y * dt
      positions[i * 3 + 2] += explosion.velocities[i].z * dt
    }

    explosion.points.geometry.attributes.position.needsUpdate = true

    explosion.life -= dt
    const alpha = explosion.life / explosion.maxLife

    explosion.points.material.opacity = alpha
    explosion.light.intensity = alpha * 250

    if (explosion.life <= 0) {
      scene.remove(explosion.points)
      scene.remove(explosion.light)
      explosion.points.geometry.dispose()
      explosion.points.material.dispose()
      explosions.splice(e, 1)
    }
  }

  controls.update()
  renderer.render(scene, camera)
}

animate()