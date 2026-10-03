import * as THREE from 'three';

export class BloodSystem {
  constructor(scene, overlayCanvas, options = {}) {
    this.scene = scene;
    this.overlayCanvas = overlayCanvas;
    this.getTerrainHeight = options.getTerrainHeight || null;
    this.overlayCtx = overlayCanvas ? overlayCanvas.getContext('2d') : null;
    this.screenSplats = [];
    this.groundSplats = [];
    this.particles = [];
    this.maxGroundSplats = 45;

    // 3D particle pool geometry
    this.init3DParticles();
  }

  init3DParticles() {
    this.particleCount = 700;
    this.geom = new THREE.BufferGeometry();
    this.positions = new Float32Array(this.particleCount * 3);
    this.velocities = [];
    this.lifetimes = new Float32Array(this.particleCount);
    this.maxLifetimes = new Float32Array(this.particleCount);
    this.sizes = new Float32Array(this.particleCount);

    for (let i = 0; i < this.particleCount; i++) {
      this.positions[i * 3 + 1] = -999; // hide initially
      this.velocities.push(new THREE.Vector3());
      this.lifetimes[i] = 0;
      this.maxLifetimes[i] = 1;
      this.sizes[i] = 0.08;
    }

    this.geom.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geom.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1));

    // Blood particle material
    this.material = new THREE.PointsMaterial({
      color: 0x8a0505,
      size: 0.12,
      transparent: true,
      opacity: 0.92,
      blending: THREE.NormalBlending,
      depthWrite: false
    });

    this.pointCloud = new THREE.Points(this.geom, this.material);
    this.scene.add(this.pointCloud);
  }

  // Trigger visceral blood explosion at 3D world position
  triggerBiteGore(originPos, count = 140) {
    let spawned = 0;
    for (let i = 0; i < this.particleCount && spawned < count; i++) {
      if (this.lifetimes[i] <= 0) {
        // Spawn particle
        this.positions[i * 3] = originPos.x + (Math.random() - 0.5) * 0.25;
        this.positions[i * 3 + 1] = originPos.y + (Math.random() - 0.5) * 0.25;
        this.positions[i * 3 + 2] = originPos.z + (Math.random() - 0.5) * 0.25;

        // Arterial spray velocity
        const angle = Math.random() * Math.PI * 2;
        const elev = Math.random() * Math.PI * 0.45; // upwards spray
        const speed = Math.random() * 4.8 + 2.2;

        this.velocities[i].set(
          Math.cos(angle) * Math.cos(elev) * speed,
          Math.sin(elev) * speed + 1.8,
          Math.sin(angle) * Math.cos(elev) * speed
        );

        this.maxLifetimes[i] = Math.random() * 1.6 + 0.8;
        this.lifetimes[i] = this.maxLifetimes[i];
        this.sizes[i] = Math.random() * 0.16 + 0.08;
        spawned++;
      }
    }
    this.geom.attributes.position.needsUpdate = true;

    // Create 3D ground blood pool
    this.createGroundSplat(originPos.x, originPos.z);

    // Create visceral screen splatters
    this.triggerScreenSplatter();
  }

  createGroundSplat(x, z) {
    const radius = Math.random() * 0.7 + 0.55;
    const segments = 24;
    const geom = new THREE.CircleGeometry(radius, segments);
    geom.rotateX(-Math.PI / 2);

    // Deform vertices for irregular blood pool edge
    const pos = geom.attributes.position;
    for (let i = 1; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vz = pos.getZ(i);
      const noise = 0.75 + Math.random() * 0.5;
      pos.setX(i, vx * noise);
      pos.setZ(i, vz * noise);
    }
    geom.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      color: 0x4d0205,
      roughness: 0.15,
      metalness: 0.1,
      transparent: true,
      opacity: 0.94,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1
    });

    const mesh = new THREE.Mesh(geom, mat);
    const terrainY = this.getTerrainHeight ? this.getTerrainHeight(x, z) : 0;
    mesh.position.set(
      x + (Math.random() - 0.5) * 0.3,
      terrainY + 0.02 + this.groundSplats.length * 0.001,
      z + (Math.random() - 0.5) * 0.3
    );
    mesh.scale.set(0.1, 0.1, 0.1);
    this.scene.add(mesh);

    this.groundSplats.push({
      mesh,
      targetScale: 1.0,
      scale: 0.1,
      opacity: 0.94,
      age: 0
    });

    if (this.groundSplats.length > this.maxGroundSplats) {
      const old = this.groundSplats.shift();
      this.scene.remove(old.mesh);
      old.mesh.geometry.dispose();
      old.mesh.material.dispose();
    }
  }

  triggerScreenSplatter() {
    if (!this.overlayCanvas || !this.overlayCtx) return;
    const splatCount = Math.floor(Math.random() * 6) + 4;
    const w = this.overlayCanvas.width;
    const h = this.overlayCanvas.height;

    for (let i = 0; i < splatCount; i++) {
      const x = Math.random() * (w * 0.8) + w * 0.1;
      const y = Math.random() * (h * 0.8) + h * 0.1;
      const r = Math.random() * 24 + 10;

      const dots = [];
      const numDots = Math.floor(Math.random() * 9) + 4;
      for (let j = 0; j < numDots; j++) {
        const ang = Math.random() * Math.PI * 2;
        const d = r * (1.2 + Math.random() * 2.0);
        dots.push({
          x: x + Math.cos(ang) * d,
          y: y + Math.sin(ang) * d,
          r: Math.random() * 4.5 + 1.5
        });
      }

      this.screenSplats.push({
        x, y, r,
        dots,
        alpha: 0.88,
        dripLength: 0,
        maxDrip: Math.random() * 70 + 20,
        dripSpeed: Math.random() * 0.9 + 0.4,
        age: 0
      });
    }
  }

  update(delta) {
    // 1. Update 3D blood particles
    const pos = this.geom.attributes.position.array;
    let needsUpdate = false;

    for (let i = 0; i < this.particleCount; i++) {
      if (this.lifetimes[i] > 0) {
        this.lifetimes[i] -= delta;
        // Gravity
        this.velocities[i].y -= 9.8 * delta;

        // Position integration
        pos[i * 3] += this.velocities[i].x * delta;
        pos[i * 3 + 1] += this.velocities[i].y * delta;
        pos[i * 3 + 2] += this.velocities[i].z * delta;

        // Terrain collision
        const terrainY = this.getTerrainHeight ? this.getTerrainHeight(pos[i * 3], pos[i * 3 + 2]) : 0;
        if (pos[i * 3 + 1] <= terrainY + 0.02) {
          pos[i * 3 + 1] = terrainY + 0.02;
          this.velocities[i].x *= 0.2;
          this.velocities[i].z *= 0.2;
          this.velocities[i].y = 0;
          this.lifetimes[i] = Math.min(this.lifetimes[i], 0.35); // Fade fast once on terrain
        }
        needsUpdate = true;
      } else {
        pos[i * 3 + 1] = -999;
      }
    }
    if (needsUpdate) {
      this.geom.attributes.position.needsUpdate = true;
    }

    // 2. Expand ground blood pools
    for (let g of this.groundSplats) {
      if (g.scale < g.targetScale) {
        g.scale += (g.targetScale - g.scale) * 6 * delta;
        g.mesh.scale.set(g.scale, g.scale, g.scale);
      }
      g.age += delta;
      // Darken as blood coagulates
      if (g.age > 4) {
        g.mesh.material.color.lerp(new THREE.Color(0x220102), 0.05 * delta);
        g.mesh.material.roughness = Math.min(0.85, g.mesh.material.roughness + 0.02 * delta);
      }
    }

    // 3. Render 2D screen blood splatters
    if (this.overlayCanvas && this.overlayCtx && this.screenSplats.length > 0) {
      this.overlayCtx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);

      for (let i = this.screenSplats.length - 1; i >= 0; i--) {
        const s = this.screenSplats[i];
        s.age += delta;

        if (s.dripLength < s.maxDrip) {
          s.dripLength += s.dripSpeed;
        }

        // Fade out slowly after 5.5 seconds
        if (s.age > 5.5) {
          s.alpha -= 0.15 * delta;
        }

        if (s.alpha <= 0) {
          this.screenSplats.splice(i, 1);
          continue;
        }

        this.overlayCtx.save();
        this.overlayCtx.fillStyle = `rgba(115, 8, 14, ${s.alpha})`;

        // Main droplet
        this.overlayCtx.beginPath();
        this.overlayCtx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        this.overlayCtx.fill();

        // Drip tail
        if (s.dripLength > 2) {
          this.overlayCtx.beginPath();
          const dripW = s.r * 0.45;
          this.overlayCtx.moveTo(s.x - dripW, s.y);
          this.overlayCtx.lineTo(s.x + dripW, s.y);
          this.overlayCtx.lineTo(s.x + dripW * 0.5, s.y + s.dripLength);
          this.overlayCtx.arc(s.x, s.y + s.dripLength, dripW * 0.7, 0, Math.PI);
          this.overlayCtx.closePath();
          this.overlayCtx.fill();
        }

        // Satellite micro-droplets
        for (let d of s.dots) {
          this.overlayCtx.beginPath();
          this.overlayCtx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
          this.overlayCtx.fill();
        }

        this.overlayCtx.restore();
      }
    }
  }
}
