/**
 * Asteroid Field — main.js
 *
 * Skybox textures  → /assets/textures/skybox
 * Asteroid model   → /assets/models/asteroid
 *
 * Controls: left-drag to orbit · scroll to zoom · right-drag to pan
 * Hover over an asteroid to highlight it (red emissive, forest-exercise style).
 * Click & drag to move it — orbit recalculates from the drop position.
 */

import * as THREE from 'three'
import { OrbitControls }  from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader }     from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader }    from 'three/examples/jsm/loaders/DRACOLoader.js'

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
const ambient = new THREE.AmbientLight(0x111133, 1.2)
scene.add(ambient)

const sun = new THREE.DirectionalLight(0xfff5e0, 3.5)
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
const FIELD_RADIUS    = 180
const FIELD_THICKNESS = 60
const SCALE_MIN       = 10
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
    // FIX: flag isDragged invece di confronto per riferimento.
    // asteroid === draggedAsteroid fallisce se findRootAsteroid restituisce
    // un nodo diverso da quello che itera il forEach.
    if (asteroid.userData.isDragged) return

    const ud = asteroid.userData

    // FIX: il loop calcolava la posizione orbitale in world space e la scriveva
    // direttamente su .position (local space). Ora converte esplicitamente con
    // worldToLocal prima di assegnare.
    ud.orbitAngle += ud.orbitSpeed * dt
    _axis.copy(ud.orbitAxis)
    _quat.setFromAxisAngle(_axis, ud.orbitAngle)
    const worldPos = new THREE.Vector3(ud.orbitRadius, ud.orbitY, 0)
    worldPos.applyQuaternion(_quat)
    asteroidGroup.worldToLocal(worldPos)
    asteroid.position.copy(worldPos)

    asteroid.rotateOnAxis(ud.spinAxis, ud.spinSpeed * dt)
  })

  controls.update()
  renderer.render(scene, camera)
}

animate()