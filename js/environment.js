import * as THREE from 'three';

export class CaveEnvironment {
  constructor(scene) {
    this.scene = scene;
    this.ashParticles = null;
    this.ashPositions = null;
    this.ashVelocities = null;
    this.ashCount = 450;
    this.fissureLights = [];
    this.brazierLights = [];
    this.runicRings = [];
    this.drippingDrops = [];
    this.waterRipples = [];
    this.hungerLevel = 0.55;

    this.createCaveTerrain();
    this.createCaveWallsAndCeiling();
    this.createStalagmites();
    this.createRuinedPillars();
    this.createSkeletalRemains();
    this.createVolcanicFissures();
    this.createOccultSacrificeCircle();
    this.createBraziers();
    this.createCavernDrips();
    this.createLowMist();
    this.create3DAshParticles();
  }

  // Exact procedural mathematical height query
  getTerrainHeight(x, z) {
    const distFromCenter = Math.hypot(x, z);

    // Rocky noise octaves
    let y = Math.sin(x * 0.25) * Math.cos(z * 0.25) * 0.45;
    y += Math.sin(x * 0.6 + 1.2) * Math.sin(z * 0.6) * 0.25;
    y += (Math.sin(x * 1.5) * Math.cos(z * 1.5)) * 0.08;

    // Center area (radius < 5.5m) is flattened for clean monster locomotion and feeding
    if (distFromCenter < 5.5) {
      y *= (distFromCenter / 5.5) * 0.25;
    } else {
      const wallFactor = Math.pow((distFromCenter - 5.5) / 34.5, 2.2);
      y += wallFactor * 13.0;
    }
    return y;
  }

  // 1. Uneven, craggy rocky cave terrain
  createCaveTerrain() {
    const geo = new THREE.PlaneGeometry(80, 80, 80, 80);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const y = this.getTerrainHeight(x, z);
      pos.setY(i, y);

      // Vertex color painting: dark damp basalt floor, blood-scorched altar center
      const dist = Math.hypot(x, z);
      let r = 0.07, g = 0.06, b = 0.08;

      if (dist < 4.0) {
        // Sacrificial blood-soaked rock in the center
        const altarBlood = (1 - dist / 4.0) * 0.12;
        r += altarBlood * 1.8;
        g += altarBlood * 0.1;
        b += altarBlood * 0.15;
      } else if (y > 3.0) {
        // Cold grey crag stone on walls
        const crag = Math.min(0.08, (y - 3.0) * 0.015);
        r += crag;
        g += crag * 1.1;
        b += crag * 1.3;
      }

      colors[i * 3] = r;
      colors[i * 3 + 1] = g;
      colors[i * 3 + 2] = b;
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.42,
      metalness: 0.2,
      flatShading: true
    });

    this.terrainMesh = new THREE.Mesh(geo, mat);
    this.terrainMesh.name = 'CaveTerrain';
    this.terrainMesh.receiveShadow = true;
    this.scene.add(this.terrainMesh);
  }

  // 2. Surrounding massive cave walls and dark arched vaults
  createCaveWallsAndCeiling() {
    const wallGeo = new THREE.CylinderGeometry(36, 42, 32, 32, 14, true);
    const pos = wallGeo.attributes.position;

    // Distort cylinder into jagged cavern walls
    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i);
      let y = pos.getY(i);
      let z = pos.getZ(i);

      const angle = Math.atan2(z, x);
      const noise = Math.sin(angle * 7) * 2.8 + Math.cos(y * 0.35) * 2.2;
      x += (x / Math.hypot(x, z)) * noise;
      z += (z / Math.hypot(x, z)) * noise;

      pos.setXYZ(i, x, y + 12, z);
    }
    wallGeo.computeVertexNormals();

    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x09080c,
      roughness: 0.95,
      metalness: 0.08,
      side: THREE.BackSide,
      flatShading: true
    });

    const caveWalls = new THREE.Mesh(wallGeo, wallMat);
    this.scene.add(caveWalls);
  }

  // 3. Jagged stalagmites and rock spires
  createStalagmites() {
    this.stalagmitesGroup = new THREE.Group();

    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x16141a,
      roughness: 0.82,
      metalness: 0.15,
      flatShading: true
    });

    // Spawn 26 craggy stalagmites around outer circle
    for (let i = 0; i < 28; i++) {
      const angle = (i / 28) * Math.PI * 2 + (Math.random() - 0.5) * 0.25;
      const radius = 7.0 + Math.random() * 17.0;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const groundY = this.getTerrainHeight(x, z);

      const height = Math.random() * 5.5 + 3.2;
      const baseR = Math.random() * 0.85 + 0.45;

      const coneGeo = new THREE.ConeGeometry(baseR, height, 7, 6);
      const pos = coneGeo.attributes.position;
      // Deform cone to make it jagged
      for (let j = 0; j < pos.count; j++) {
        const px = pos.getX(j);
        const py = pos.getY(j);
        const pz = pos.getZ(j);
        const jitter = (Math.random() - 0.5) * 0.22;
        pos.setXYZ(j, px + jitter, py, pz + jitter);
      }
      coneGeo.computeVertexNormals();

      const mesh = new THREE.Mesh(coneGeo, rockMat);
      mesh.position.set(x, groundY + height * 0.45, z);
      mesh.rotation.y = Math.random() * Math.PI * 2;
      mesh.rotation.z = (Math.random() - 0.5) * 0.22;
      mesh.rotation.x = (Math.random() - 0.5) * 0.22;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.stalagmitesGroup.add(mesh);
    }

    this.scene.add(this.stalagmitesGroup);
  }

  // 4. Broken apocalyptic gothic ruins (crumbling pillars & cracked stone slabs)
  createRuinedPillars() {
    const pillarMat = new THREE.MeshStandardMaterial({
      color: 0x1a1820,
      roughness: 0.85,
      metalness: 0.12,
      flatShading: true
    });

    const positions = [
      { x: -6.5, z: -5.0, h: 5.2, rot: 0.15 },
      { x: 7.2, z: -6.0, h: 4.0, rot: -0.25 },
      { x: -8.0, z: 4.5, h: 3.5, rot: 0.3 },
      { x: 8.5, z: 3.5, h: 4.8, rot: -0.18 },
      { x: 0.0, z: -9.5, h: 6.5, rot: 0.05 }
    ];

    positions.forEach(p => {
      const groundY = this.getTerrainHeight(p.x, p.z);
      const geo = new THREE.CylinderGeometry(0.7, 0.95, p.h, 8);
      // Crack the top
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        if (pos.getY(i) > p.h * 0.3) {
          pos.setX(i, pos.getX(i) + (Math.random() - 0.5) * 0.35);
          pos.setZ(i, pos.getZ(i) + (Math.random() - 0.5) * 0.35);
        }
      }
      geo.computeVertexNormals();

      const pillar = new THREE.Mesh(geo, pillarMat);
      pillar.position.set(p.x, groundY + p.h * 0.5, p.z);
      pillar.rotation.z = p.rot;
      pillar.castShadow = true;
      pillar.receiveShadow = true;
      this.scene.add(pillar);

      // Base stone block
      const baseGeo = new THREE.BoxGeometry(2.1, 0.6, 2.1);
      const base = new THREE.Mesh(baseGeo, pillarMat);
      base.position.set(p.x, groundY + 0.3, p.z);
      base.rotation.y = Math.random() * Math.PI;
      base.receiveShadow = true;
      this.scene.add(base);
    });
  }

  // 5. Giant ribcages and charred horned beast skulls
  createSkeletalRemains() {
    const boneMat = new THREE.MeshStandardMaterial({
      color: 0x948b7d,
      roughness: 0.65,
      metalness: 0.05,
      flatShading: true
    });

    // Ancient behemoth ribcage protruding from the mud
    const ribcageGroup = new THREE.Group();
    const ribGroundY = this.getTerrainHeight(-4.0, -2.5);
    ribcageGroup.position.set(-4.0, ribGroundY + 0.2, -2.5);
    ribcageGroup.rotation.y = 0.5;
    ribcageGroup.rotation.z = -0.15;

    for (let r = 0; r < 6; r++) {
      const ribGeo = new THREE.TorusGeometry(1.2 + r * 0.1, 0.09, 6, 16, Math.PI * 0.75);
      const rib = new THREE.Mesh(ribGeo, boneMat);
      rib.position.set(r * 0.55, 0.4, 0);
      rib.rotation.x = Math.PI / 2 + 0.3;
      rib.castShadow = true;
      ribcageGroup.add(rib);
    }
    this.scene.add(ribcageGroup);

    // Second smaller shattered ribcage
    const ribcage2 = ribcageGroup.clone();
    const rib2Y = this.getTerrainHeight(5.5, 2.0);
    ribcage2.position.set(5.5, rib2Y + 0.1, 2.0);
    ribcage2.scale.set(0.75, 0.75, 0.75);
    ribcage2.rotation.y = -1.2;
    this.scene.add(ribcage2);

    // Horned beast skull half buried in ash
    const skullGroup = new THREE.Group();
    const skullY = this.getTerrainHeight(3.5, -3.2);
    skullGroup.position.set(3.5, skullY + 0.35, -3.2);
    skullGroup.rotation.set(0.4, -0.6, 0.2);

    // Cranium
    const craniumGeo = new THREE.DodecahedronGeometry(0.55, 1);
    const cranium = new THREE.Mesh(craniumGeo, boneMat);
    cranium.scale.set(1.0, 0.8, 1.4);
    cranium.castShadow = true;
    skullGroup.add(cranium);

    // Snout / Maxilla
    const snoutGeo = new THREE.BoxGeometry(0.45, 0.4, 0.8);
    const snout = new THREE.Mesh(snoutGeo, boneMat);
    snout.position.set(0, -0.2, 0.8);
    snout.castShadow = true;
    skullGroup.add(snout);

    // Curved beast horns
    const hornCurveL = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.35, 0.3, -0.1),
      new THREE.Vector3(-0.85, 0.8, -0.3),
      new THREE.Vector3(-1.1, 1.2, 0.1),
      new THREE.Vector3(-0.95, 1.6, 0.4)
    ]);
    const hornGeoL = new THREE.TubeGeometry(hornCurveL, 12, 0.08, 6, false);
    const hornL = new THREE.Mesh(hornGeoL, boneMat);
    hornL.castShadow = true;
    skullGroup.add(hornL);

    const hornCurveR = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.35, 0.3, -0.1),
      new THREE.Vector3(0.85, 0.8, -0.3),
      new THREE.Vector3(1.1, 1.2, 0.1),
      new THREE.Vector3(0.95, 1.6, 0.4)
    ]);
    const hornGeoR = new THREE.TubeGeometry(hornCurveR, 12, 0.08, 6, false);
    const hornR = new THREE.Mesh(hornGeoR, boneMat);
    hornR.castShadow = true;
    skullGroup.add(hornR);

    this.scene.add(skullGroup);
  }

  // 6. Glowing volcanic fissures / abyssal cracks in the stone
  createVolcanicFissures() {
    const fissureMat = new THREE.MeshBasicMaterial({
      color: 0xff1e00
    });

    const fissurePaths = [
      [
        new THREE.Vector3(-8, 0, -2),
        new THREE.Vector3(-5, 0, -1.2),
        new THREE.Vector3(-2.5, 0, -1.8),
        new THREE.Vector3(-0.5, 0, -3.5)
      ],
      [
        new THREE.Vector3(1.5, 0, 1.0),
        new THREE.Vector3(4.0, 0, 1.8),
        new THREE.Vector3(6.5, 0, 0.8),
        new THREE.Vector3(9.0, 0, 2.2)
      ]
    ];

    fissurePaths.forEach((pts) => {
      // Align points to terrain height
      const alignedPts = pts.map(p => new THREE.Vector3(p.x, this.getTerrainHeight(p.x, p.z) + 0.03, p.z));
      const curve = new THREE.CatmullRomCurve3(alignedPts);
      const tubeGeo = new THREE.TubeGeometry(curve, 32, 0.065, 6, false);
      const tube = new THREE.Mesh(tubeGeo, fissureMat);
      this.scene.add(tube);

      // Flickering subterranean glow light
      const fissureLight = new THREE.PointLight(0xff2200, 1.8, 6.5, 2.0);
      const midPoint = alignedPts[Math.floor(alignedPts.length / 2)];
      fissureLight.position.set(midPoint.x, midPoint.y + 0.35, midPoint.z);
      this.scene.add(fissureLight);
      this.fissureLights.push(fissureLight);
    });
  }

  // 7. Occult Runic Altar Circle at Arena Center
  createOccultSacrificeCircle() {
    const altarGroup = new THREE.Group();
    const altarY = this.getTerrainHeight(0, 0);
    altarGroup.position.set(0, altarY + 0.025, 0);

    // Outer occult ring
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x8a0b16,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide
    });

    const outerRingGeo = new THREE.RingGeometry(3.6, 3.75, 48);
    outerRingGeo.rotateX(-Math.PI / 2);
    const outerRing = new THREE.Mesh(outerRingGeo, ringMat);
    altarGroup.add(outerRing);
    this.runicRings.push(outerRing);

    // Inner rune circle
    const innerRingGeo = new THREE.RingGeometry(2.3, 2.42, 48);
    innerRingGeo.rotateX(-Math.PI / 2);
    const innerRing = new THREE.Mesh(innerRingGeo, ringMat.clone());
    altarGroup.add(innerRing);
    this.runicRings.push(innerRing);

    // Runic spokes / star of starvation
    const starMat = new THREE.MeshBasicMaterial({
      color: 0x5a0710,
      transparent: true,
      opacity: 0.45
    });

    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const spokeGeo = new THREE.PlaneGeometry(0.08, 1.3);
      spokeGeo.rotateX(-Math.PI / 2);
      const spoke = new THREE.Mesh(spokeGeo, starMat);
      spoke.position.set(Math.cos(angle) * 3.0, 0, Math.sin(angle) * 3.0);
      spoke.rotation.y = -angle;
      altarGroup.add(spoke);
      this.runicRings.push(spoke);
    }

    this.scene.add(altarGroup);
  }

  // 8. Rusted Iron Skull Braziers with Flickering Embers
  createBraziers() {
    const brazierMat = new THREE.MeshStandardMaterial({
      color: 0x1f1b20,
      roughness: 0.7,
      metalness: 0.5
    });

    const emberMat = new THREE.MeshBasicMaterial({
      color: 0xff3810
    });

    const brazierPositions = [
      { x: -3.8, z: 3.5 },
      { x: 3.8, z: 3.5 }
    ];

    brazierPositions.forEach(b => {
      const groundY = this.getTerrainHeight(b.x, b.z);
      const brazier = new THREE.Group();
      brazier.position.set(b.x, groundY, b.z);

      // Tripod legs
      for (let i = 0; i < 3; i++) {
        const ang = (i / 3) * Math.PI * 2;
        const legGeo = new THREE.CylinderGeometry(0.04, 0.05, 1.2, 6);
        const leg = new THREE.Mesh(legGeo, brazierMat);
        leg.position.set(Math.cos(ang) * 0.35, 0.6, Math.sin(ang) * 0.35);
        leg.rotation.z = Math.cos(ang) * 0.15;
        leg.rotation.x = Math.sin(ang) * 0.15;
        leg.castShadow = true;
        brazier.add(leg);
      }

      // Iron bowl
      const bowlGeo = new THREE.SphereGeometry(0.45, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
      bowlGeo.rotateX(Math.PI);
      const bowl = new THREE.Mesh(bowlGeo, brazierMat);
      bowl.position.set(0, 1.2, 0);
      bowl.castShadow = true;
      brazier.add(bowl);

      // Hot coals
      const coalGeo = new THREE.DodecahedronGeometry(0.3, 1);
      const coal = new THREE.Mesh(coalGeo, emberMat);
      coal.position.set(0, 1.22, 0);
      brazier.add(coal);

      // Warm dynamic flickering light
      const fireLight = new THREE.PointLight(0xe84a1a, 1.6, 9.0, 1.8);
      fireLight.position.set(0, 1.5, 0);
      fireLight.castShadow = true;
      fireLight.shadow.bias = -0.002;
      brazier.add(fireLight);
      this.brazierLights.push(fireLight);

      this.scene.add(brazier);
    });
  }

  // 9. Ceiling water/blood drips that splash onto the cavern floor
  createCavernDrips() {
    this.drippingDrops = [];
    this.waterRipples = [];

    const dripGeo = new THREE.SphereGeometry(0.035, 6, 6);
    const dripMat = new THREE.MeshBasicMaterial({
      color: 0x8a1820,
      transparent: true,
      opacity: 0.85
    });

    const dripOrigins = [
      { x: -2.2, z: 1.5 },
      { x: 3.1, z: -1.8 },
      { x: 0.5, z: 3.8 }
    ];

    dripOrigins.forEach(d => {
      const mesh = new THREE.Mesh(dripGeo, dripMat);
      const groundY = this.getTerrainHeight(d.x, d.z);
      mesh.position.set(d.x, 10.0, d.z);
      this.scene.add(mesh);

      this.drippingDrops.push({
        mesh,
        x: d.x,
        z: d.z,
        groundY,
        y: 8.0 + Math.random() * 4.0,
        speed: 5.5 + Math.random() * 2.0
      });
    });

    // Ripple pools
    const rippleGeo = new THREE.RingGeometry(0.02, 0.05, 16);
    rippleGeo.rotateX(-Math.PI / 2);
    const rippleMat = new THREE.MeshBasicMaterial({
      color: 0x75101a,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide
    });

    for (let i = 0; i < 6; i++) {
      const rMesh = new THREE.Mesh(rippleGeo, rippleMat.clone());
      rMesh.visible = false;
      this.scene.add(rMesh);
      this.waterRipples.push({
        mesh: rMesh,
        scale: 0.1,
        maxScale: 2.5,
        alpha: 0.7,
        active: false
      });
    }
  }

  triggerRipple(x, y, z) {
    const ripple = this.waterRipples.find(r => !r.active);
    if (!ripple) return;
    ripple.mesh.position.set(x, y + 0.015, z);
    ripple.scale = 0.1;
    ripple.alpha = 0.75;
    ripple.mesh.visible = true;
    ripple.active = true;
  }

  // 10. Atmospheric Low-Lying Cavern Mist / Fog Planes
  createLowMist() {
    const mistGeo = new THREE.PlaneGeometry(35, 35);
    mistGeo.rotateX(-Math.PI / 2);

    const mistMat = new THREE.MeshBasicMaterial({
      color: 0x140a12,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    this.mistMesh = new THREE.Mesh(mistGeo, mistMat);
    this.mistMesh.position.set(0, 0.45, 0);
    this.scene.add(this.mistMesh);
  }

  // 11. Swirling 3D ash flakes and abyssal ember motes
  create3DAshParticles() {
    const geo = new THREE.BufferGeometry();
    this.ashPositions = new Float32Array(this.ashCount * 3);
    this.ashVelocities = [];

    for (let i = 0; i < this.ashCount; i++) {
      this.ashPositions[i * 3] = (Math.random() - 0.5) * 40;
      this.ashPositions[i * 3 + 1] = Math.random() * 12 + 0.2;
      this.ashPositions[i * 3 + 2] = (Math.random() - 0.5) * 40;

      this.ashVelocities.push(new THREE.Vector3(
        (Math.random() - 0.5) * 0.4,
        -(Math.random() * 0.6 + 0.3),
        (Math.random() - 0.5) * 0.4
      ));
    }

    geo.setAttribute('position', new THREE.BufferAttribute(this.ashPositions, 3));

    const mat = new THREE.PointsMaterial({
      color: 0x9a8f98,
      size: 0.08,
      transparent: true,
      opacity: 0.75,
      blending: THREE.NormalBlending,
      depthWrite: false
    });

    this.ashParticles = new THREE.Points(geo, mat);
    this.scene.add(this.ashParticles);
  }

  setHunger(hunger) {
    this.hungerLevel = Math.max(0, Math.min(1, hunger));

    // Cavern occult runes glow brighter with hunger
    const runeGlow = 0.25 + this.hungerLevel * 0.65;
    this.runicRings.forEach(mesh => {
      if (mesh.material) {
        mesh.material.opacity = runeGlow;
      }
    });

    // Mist shifts to subtle crimson haze
    if (this.mistMesh && this.mistMesh.material) {
      this.mistMesh.material.opacity = 0.15 + this.hungerLevel * 0.15;
    }
  }

  update(delta, time) {
    // 1. Update 3D ash motes drifting downwards
    if (this.ashParticles && this.ashPositions) {
      const pos = this.ashParticles.geometry.attributes.position.array;
      const speedMultiplier = 1.0 + this.hungerLevel * 0.8;

      for (let i = 0; i < this.ashCount; i++) {
        pos[i * 3] += (this.ashVelocities[i].x + Math.sin(time * 0.8 + i) * 0.18) * delta * speedMultiplier;
        pos[i * 3 + 1] += this.ashVelocities[i].y * delta * speedMultiplier;
        pos[i * 3 + 2] += (this.ashVelocities[i].z + Math.cos(time * 0.8 + i) * 0.18) * delta * speedMultiplier;

        // Reset when reaching ground
        if (pos[i * 3 + 1] <= 0.1) {
          pos[i * 3 + 1] = 12.0;
          pos[i * 3] = (Math.random() - 0.5) * 40;
          pos[i * 3 + 2] = (Math.random() - 0.5) * 40;
        }
      }
      this.ashParticles.geometry.attributes.position.needsUpdate = true;
    }

    // 2. Fissure lights volcanic pulsation
    this.fissureLights.forEach((light, idx) => {
      light.intensity = 1.4 + Math.sin(time * 2.5 + idx * 2.0) * 0.6 + (Math.random() - 0.5) * 0.15;
    });

    // 3. Brazier fire flicker
    this.brazierLights.forEach((light, idx) => {
      light.intensity = 1.5 + Math.sin(time * 6.0 + idx * 3.1) * 0.35 + (Math.random() - 0.5) * 0.15;
    });

    // 4. Subtle rotation on mist layer
    if (this.mistMesh) {
      this.mistMesh.rotation.z = time * 0.02;
    }

    // 5. Cavern drips falling & splashing
    this.drippingDrops.forEach(d => {
      d.y -= d.speed * delta;
      if (d.y <= d.groundY) {
        this.triggerRipple(d.x, d.groundY, d.z);
        d.y = 8.5 + Math.random() * 3.0;
      }
      d.mesh.position.y = d.y;
    });

    // 6. Expanding water/blood ripples
    this.waterRipples.forEach(r => {
      if (r.active) {
        r.scale += 2.2 * delta;
        r.alpha -= 0.8 * delta;
        r.mesh.scale.set(r.scale, r.scale, r.scale);
        r.mesh.material.opacity = Math.max(0, r.alpha);

        if (r.alpha <= 0) {
          r.active = false;
          r.mesh.visible = false;
        }
      }
    });

    // 7. Pulse Runic Circle
    const runePulse = 0.5 + Math.sin(time * 2.0) * 0.2;
    if (this.runicRings.length > 0 && this.runicRings[0].material) {
      this.runicRings[0].material.opacity = (0.3 + runePulse * 0.4) * (0.6 + this.hungerLevel * 0.6);
    }
  }
}
