/**
 * Asteroid Field - main.js
 *
 * Skybox textures: /assets/textures/skybox
 * Asteroid model:  /assets/models/asteroid
 * Spaceship model: /assets/models/spaceship
 *
 * Controls: left-drag to orbit / scroll to zoom / right-drag to pan
 * Hover over an asteroid to highlight it (red emissive).
 * Click & drag to move it, orbit recalculates from the drop position.
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
renderer.shadowMap.enabled   = true                             // abilita ombre
renderer.shadowMap.type      = THREE.PCFSoftShadowMap           // ombre morbide
renderer.toneMapping         = THREE.ACESFilmicToneMapping      // colore più naturale
renderer.toneMappingExposure = 1.2
document.body.appendChild(renderer.domElement)                  // aggiungere canvas a pagina html

// ─── Scene ────────────────────────────────────────────────────────────────────
const scene = new THREE.Scene()

// ─── Camera ───────────────────────────────────────────────────────────────────
const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,    // near clipping
  5000    // far clipping
)
camera.position.set(0, 40, 120)

// ─── Orbit controls ───────────────────────────────────────────────────────────
const controls = new OrbitControls(camera, renderer.domElement)
controls.target.set(0, 0, 0)
controls.enableDamping  = true    // attiva movimenti fluidi
controls.dampingFactor  = 0.05
controls.minDistance    = 10
controls.maxDistance    = 400
controls.update()

// ─── Lights ───────────────────────────────────────────────────────────────────
const ambient = new THREE.AmbientLight(0xfff5e0, 1.2)             // luce ambiente
scene.add(ambient)

const sun = new THREE.DirectionalLight(0xfff5e0, 5)               // luce principale (sole)
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

// ─── Debug GUI ────────────────────────────────────────────────────────────────
const guiParams = {
  // Orbite
  orbitSpeedMultiplier: 1.0,
  spinSpeedMultiplier:  1.0,
  // Campo
  fieldRadius:    200,
  fieldThickness: 100,
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
  // scorre tutti gli oggetti della scena e aggiorna i materiali
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
const FIELD_THICKNESS = 100
const SCALE_MIN       = 5
const SCALE_MAX       = 25

// ─── Asteroid group ───────────────────────────────────────────────────────────
const asteroidGroup = new THREE.Group() // tutti gli asteroidi sono figli di questo gruppo
scene.add(asteroidGroup)

// ─── Loaders ──────────────────────────────────────────────────────────────────
const manager     = new THREE.LoadingManager()              // gestore barra caricamento
const cubeLoader  = new THREE.CubeTextureLoader(manager)    // loader skybox
const gltfLoader  = new GLTFLoader(manager)
const dracoLoader = new DRACOLoader()                       // loader per mesh compresse in DRACO
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/')
gltfLoader.setDRACOLoader(dracoLoader)

manager.onProgress = (_url, loaded, total) => {
  setProgress(loaded / total, `Loading assets… ${loaded}/${total}`) // aggiorna barra progresso
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
    const sourceScene = gltf.scene  // recupera scena dalla mesh
    sourceScene.traverse((node) => {
      if (node.isMesh) {
        node.castShadow    = true // ombre proiettate
        node.receiveShadow = true // ombre ricevute
      }
    })

    // normalizzazione modello GLTF
    const bbox = new THREE.Box3().setFromObject(sourceScene)    // parallelepipedo che racchiude la mesh
    const size = new THREE.Vector3()
    bbox.getSize(size)
    const maxDim    = Math.max(size.x, size.y, size.z)
    const normalise = maxDim > 0 ? 1 / maxDim : 1

    for (let i = 0; i < ASTEROID_COUNT; i++) {
      const clone  = sourceScene.clone(true)

      // posizione iniziale casuale nell'orbita
      const angle  = Math.random() * Math.PI * 2
      const radius = FIELD_RADIUS * (0.5 + Math.random() * 0.5)
      const yOff   = (Math.random() - 0.5) * FIELD_THICKNESS * 2

      clone.position.set(Math.cos(angle) * radius, yOff, Math.sin(angle) * radius)

      // scala casuale
      const s = (SCALE_MIN + Math.random() * (SCALE_MAX - SCALE_MIN)) * normalise
      clone.scale.setScalar(s)
      clone.updateMatrixWorld(true)

      // bounding sphere per le collisioni (sfera minima che contiene l'intera mesh)
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

      // flag usato dall'animate loop per saltare l'orbita durante il drag
      clone.userData.isDragged   = false
      clone.userData.id = `asteroid-${i}`

      clone.userData.baseOrbitRadius = clone.userData.orbitRadius
      clone.userData.baseOrbitY      = clone.userData.orbitY


      // Clonazione materiali:
      // sourceScene.clone(true) condivide i materiali tra tutti i cloni,
      // impostare emissive.setHex(0xff0000) su un mesh cambierebbe il colore
      // di tutti gli asteroidi contemporaneamente.
      // Clonando ogni materiale ogni clone ha istanze proprie e indipendenti.
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

  // callback progresso
  (xhr) => {
    if (xhr.total > 0) {
      const p = 0.3 + (xhr.loaded / xhr.total) * 0.6
      setProgress(p, `Loading model… ${Math.round(p * 100)}%`)
    }
  },

  // callback errore
  (err) => {
    console.error('GLTFLoader error:', err)
    loadingText.textContent = 'Could not load asteroid model, check the path in main.js'
    loadingBar.style.background = '#c0392b'
  }
)

// ─── Ship model ───────────────────────────────────────────────────────────────
const SHIP_MODEL_PATH = '/models/spaceship/scene.gltf'
let ship = null          // THREE.Object3D, assegnato dopo il caricamento del modello
let shipAngle = 0        // angolo corrente sull'orbita
let shipDead  = false    // true dopo collisione

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

  // callback errore
  (err) => {
    console.error('Ship GLTFLoader error:', err)
  }
)

// ─────────────────────────────────────────────────────────────────────────────
//  INTERACTION SYSTEM
// ─────────────────────────────────────────────────────────────────────────────

const raycaster = new THREE.Raycaster()
const pointer   = new THREE.Vector2(-999, -999)   // punta fuori schermo all'inizio (evitare highlight involontari)

const dragPlane = new THREE.Plane()
const _hit      = new THREE.Vector3() //punto di intersezione raggio-piano (riutilizzato
                                      // ogni frame per evitare allocazioni in animate)

let draggedAsteroid = null   // root Group being dragged
let dragOffset      = null   // offset da pivot a hit point, in world space

// ── Navicella ─────────────────────────────────────────────────────────────────
// Raggio orbita navicella: appena fuori dal bordo esterno del campo
const SHIP_ORBIT_RADIUS = FIELD_RADIUS * 1.5
const SHIP_ORBIT_Y      = 0

// Offset camera in modalità follow (world space relativo alla navicella)
const CAM_OFFSET = new THREE.Vector3(0, 15, -40)

// ── Highlight state ───────────────────────────────────────────────────────────
let intersected = null  // singolo Mesh attualmente evidenziato in rosso
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
    const mesh = intersects[0].object     // mesh foglia più vicina alla camera
    const root = findRootAsteroid(mesh)   // root group corrispondente

    // Aggiorna l'highlight solo se il mesh colpito è cambiato rispetto al frame precedente
    if (intersected !== mesh) {
      if (intersected) intersected.material.emissive.setHex(intersected.currentHex)
      intersected = mesh
      intersected.currentHex = intersected.material.emissive.getHex()
      intersected.material.emissive.setHex(0xff0000)
    }

    // Log dell'id del root Group solo quando cambia l'asteroide puntato
    if (root !== hoveredRoot) {
      hoveredRoot = root
      if (hoveredRoot) console.log('Hover asteroid id:', hoveredRoot.userData.id)
    }
  } else {
    // Nessuna intersezione: ripristina l'emissive e azzera lo stato hover
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
      // recuperare posizioni globali degli asteroidi
      a.getWorldPosition(posA)
      b.getWorldPosition(posB)
      const distance = posA.distanceTo(posB)

      // collisione se somma dei raggi > distanza tra i centri
      if (distance < a.userData.collisionRadius + b.userData.collisionRadius) {

        // Centro dell'esplosione = punto medio tra i due pivot in local space
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

  // BufferGeometry con un attributo 'position' per le particelle:
  // tutte partono dallo stesso punto (posizione dell'esplosione) e si
  // disperdono in direzioni casuali aggiornate nell'animate loop
  const geometry  = new THREE.BufferGeometry()
  const positions = new Float32Array(particleCount * 3)
  const velocities = []

  for (let i = 0; i < particleCount; i++) {
    // Posizione iniziale di tutte le particelle
    positions[i * 3]     = position.x
    positions[i * 3 + 1] = position.y
    positions[i * 3 + 2] = position.z

    // Direzione casuale uniforme sulla sfera unitaria
    const dir = new THREE.Vector3(
      Math.random() - 0.5,
      Math.random() - 0.5,
      Math.random() - 0.5
    ).normalize()

    // velocità scalare casuale tra [explosionSpeed, explosionSpeed/2]
    dir.multiplyScalar(guiParams.explosionSpeed * 0.5 + Math.random() * guiParams.explosionSpeed * 0.5)
    velocities.push(dir)
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))

  const material = new THREE.PointsMaterial({
    size:        guiParams.particleSize,
    color:       0xffdd66,
    transparent: true,
    opacity:     1,                             // calata linearmente a 0 in animate in base a life/maxLife
    depthWrite:  false,
    blending:    THREE.AdditiveBlending,        // somma colori (particelle sovrappposte diventano più luminose)
  })

  // PointLight temporanea per l'esplosione
  const light = new THREE.PointLight(0xffaa33, 250, 300)
  light.position.copy(position)
  scene.add(light)

  const points = new THREE.Points(geometry, material)
  scene.add(points)

  explosions.push({
    points,
    light,
    velocities,
    life:    guiParams.explosionDuration,   // tempo rimanente in secondi
    maxLife: guiParams.explosionDuration,   // durata totale
  })
}

// ─── Ship update ──────────────────────────────────────────────────────────────
const _shipPos    = new THREE.Vector3() // posizione globale navicella
const _camTarget  = new THREE.Vector3() // direzione vista camera in 'follow mode'
const _camDesired = new THREE.Vector3() // posizione desiderata della camera in 'follow mode'

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
    // Reset del target verso il centro
    if (controls.enabled) {
      controls.target.set(0, 0, 0)
      controls.update()
    }
    controls.enabled = false

    // Posizione desiderata: CAM_OFFSET (dietro/sopra la prua) ruotato secondo
    // l'orientamento corrente della navicella, poi traslato alla sua posizione.
    
    // applyQuaternion trasforma l'offset da spazio locale navicella a world space.
    _camDesired.copy(CAM_OFFSET).applyQuaternion(ship.quaternion).add(ship.position)
    camera.position.lerp(_camDesired, 0.08)

    _camTarget.copy(ship.position)
    camera.lookAt(_camTarget)
  } else {
    controls.enabled = true
  }
}

// ── Event handler ─────────────────────────────────────────
// { capture: true }: listener che gira nella fase di CATTURA (PRIMA
// che l'evento scenda ai listener di OrbitControls registrati sul domElement).
// Senza capture, OrbitControls vedrebbe il pointerdown e inizierebbe il proprio
// drag prima che noi potessimo bloccarlo.

// 1) pointermove
window.addEventListener('pointermove', (e) => {
  pointer.x =  (e.clientX / window.innerWidth)  * 2 - 1
  pointer.y = -(e.clientY / window.innerHeight) * 2 + 1

  if (!draggedAsteroid) return

  e.stopPropagation()

  // crea raggio da camera verso puntatore
  raycaster.setFromCamera(pointer, camera)
  if (!raycaster.ray.intersectPlane(dragPlane, _hit)) return  // creca intersezione tra raggio e piano in cui muovere l'oggetto

  // _hit è in world space, ma .position è in local space di asteroidGroup.
  // worldToLocal converte il punto prima di assegnarlo, altrimenti l'asteroide
  // finisce in una posizione sbagliata.
  const worldTarget = new THREE.Vector3().copy(_hit).add(dragOffset)
  asteroidGroup.worldToLocal(worldTarget)
  draggedAsteroid.position.copy(worldTarget)

  // console.log('hit', _hit)
  // console.log('asteroid', draggedAsteroid.position)
  // console.log(
  //   'distance mouse->plane',
  //   camera.position.distanceTo(_hit)
  // )
}, { capture: true })

// 2) pointerdown
renderer.domElement.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return

  // Converte le coordinate pixel in NDC (Normalized Device Coordinates)
  pointer.x =  (e.clientX / window.innerWidth)  * 2 - 1
  pointer.y = -(e.clientY / window.innerHeight) * 2 + 1

  raycaster.setFromCamera(pointer, camera)
  const hits = raycaster.intersectObjects(asteroidGroup.children, true)

  if (hits.length === 0) return   // click nel vuoto: nessun drag da iniziare

  // risalire alla radice del clone perché il drag deve spostare l'intero asteroide, non un sotto-nodo
  const root = findRootAsteroid(hits[0].object)
  if (!root) return

  draggedAsteroid = root  // asteroide da trascinare

  draggedAsteroid.userData.isDragged = true

  // Crea il piano del drag
  const camDir = new THREE.Vector3()
  camera.getWorldDirection(camDir)
  dragPlane.setFromNormalAndCoplanarPoint(camDir.negate(), hits[0].point)

  const worldPos = new THREE.Vector3()
  draggedAsteroid.getWorldPosition(worldPos)
  console.log('Rilascio - inizio posizione (world):', worldPos.toArray())
  dragOffset = new THREE.Vector3().subVectors(worldPos, hits[0].point)

  controls.enabled = false

  const cancel = new PointerEvent('pointercancel', { pointerId: e.pointerId })
  renderer.domElement.dispatchEvent(cancel)

  e.stopPropagation()

  // console.log('root', worldPos)
  // console.log('hit', hits[0].point)
  // console.log(
  //   'distance',
  //   worldPos.distanceTo(hits[0].point)
  // )
}, { capture: true })

// 3) pointerup
window.addEventListener('pointerup',   () =>  {
  if (!draggedAsteroid) return

  const worldPos = new THREE.Vector3()
  draggedAsteroid.getWorldPosition(worldPos)
  console.log('Rilascio - fine posizione (world):', worldPos.toArray())

  draggedAsteroid.userData.orbitRadius = Math.sqrt(worldPos.x * worldPos.x + worldPos.z * worldPos.z)
  draggedAsteroid.userData.orbitAngle  = -Math.atan2(worldPos.z, worldPos.x)
  draggedAsteroid.userData.orbitY      = worldPos.y
  draggedAsteroid.userData.orbitAxis = new THREE.Vector3(0, 1, 0)
  
  draggedAsteroid.userData.isDragged = false
  draggedAsteroid = null
  dragOffset      = null

  // Riabilita DOPO un frame, così il pointerup non viene letto da OrbitControls
  // come inizio di una nuova interazione
  requestAnimationFrame(() => {
    controls.enabled = true
  })
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

  const dt = clock.getDelta() // secondi trascorsi dall'ultimo frame

  updateHoverHighlight()

  asteroidGroup.children.forEach((asteroid) => {
    // Salta l'aggiornamento orbitale mentre l'utente trascina questo asteroide
    if (asteroid.userData.isDragged) return

    const ud = asteroid.userData

    ud.orbitAngle += ud.orbitSpeed * guiParams.orbitSpeedMultiplier * dt
    // Costruisce la nuova posizione orbitale con un quaternione
    _axis.copy(ud.orbitAxis)
    _quat.setFromAxisAngle(_axis, ud.orbitAngle)
    const worldPos = new THREE.Vector3(ud.orbitRadius, ud.orbitY, 0)
    worldPos.applyQuaternion(_quat)
    asteroidGroup.worldToLocal(worldPos)  // da world space a local space di asteroidGroup
    asteroid.position.copy(worldPos)

    // Ruota l'asteroide attorno al proprio asse di spin
    asteroid.rotateOnAxis(ud.spinAxis, ud.spinSpeed * guiParams.spinSpeedMultiplier * dt)
  })

  if (guiParams.collisionsEnabled) checkCollisions()
  updateShip(dt)

  // Aggiornamento esplosioni attive.
  // N.B. : splice(e, 1) rimuove l'elemento all'indice e,
  // iterando in avanti la rimozione sposterebbe gli indici saltando l'elemento successivo.
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

    // pulisce esplosione finita
    if (explosion.life <= 0) {
      scene.remove(explosion.points)
      scene.remove(explosion.light)
      explosion.points.geometry.dispose()
      explosion.points.material.dispose()
      explosions.splice(e, 1)
    }
  }

  controls.update()
  renderer.render(scene, camera)  // renderizzare scena
}

animate()
