import * as THREE from 'three';

export class OrganFactory {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.getTerrainHeight = options.getTerrainHeight || null;
    this.onBounce = options.onBounce || null;
    this.activeOrgans = [];
  }

  // Create 3D Heart with aorta and rhythmic pulse
  createHeartMesh() {
    const group = new THREE.Group();

    // Ventricles / main mass
    const heartGeo = new THREE.SphereGeometry(0.32, 24, 24);
    const pos = heartGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i);
      let y = pos.getY(i);
      let z = pos.getZ(i);

      // Taper bottom into conical apex
      if (y < 0) {
        x *= (1 + y * 0.7);
        z *= (1 + y * 0.7);
        y *= 1.35;
      }
      // Top bifurcated lobes
      if (y > 0.1) {
        x *= (1 + Math.abs(x) * 0.4);
      }
      pos.setXYZ(i, x, y, z);
    }
    heartGeo.computeVertexNormals();

    const heartMat = new THREE.MeshStandardMaterial({
      color: 0x6e0813,
      roughness: 0.12,
      metalness: 0.1,
      bumpScale: 0.05
    });

    const heartMesh = new THREE.Mesh(heartGeo, heartMat);
    heartMesh.castShadow = true;
    group.add(heartMesh);

    // Aortic arch
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.05, 0.25, 0),
      new THREE.Vector3(0.08, 0.45, 0.02),
      new THREE.Vector3(-0.06, 0.52, -0.05),
      new THREE.Vector3(-0.16, 0.38, -0.1)
    ]);
    const tubeGeo = new THREE.TubeGeometry(curve, 16, 0.06, 8, false);
    const arteryMat = new THREE.MeshStandardMaterial({
      color: 0x8a101d,
      roughness: 0.2,
      metalness: 0.05
    });
    const aorta = new THREE.Mesh(tubeGeo, arteryMat);
    aorta.castShadow = true;
    group.add(aorta);

    // Smaller pulmonary artery
    const pulmCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.08, 0.22, 0.05),
      new THREE.Vector3(-0.12, 0.38, 0.08),
      new THREE.Vector3(-0.18, 0.42, 0.15)
    ]);
    const pulmGeo = new THREE.TubeGeometry(pulmCurve, 12, 0.045, 8, false);
    const pulm = new THREE.Mesh(pulmGeo, arteryMat);
    pulm.castShadow = true;
    group.add(pulm);

    return { group, type: 'heart', baseScale: 1.0 };
  }

  // Create 3D Brain with cerebral hemispheres and cerebellum
  createBrainMesh() {
    const group = new THREE.Group();

    const brainMat = new THREE.MeshStandardMaterial({
      color: 0x8f4d5b,
      roughness: 0.25,
      metalness: 0.05
    });

    // Left hemisphere
    const leftGeo = new THREE.SphereGeometry(0.24, 20, 20);
    const lPos = leftGeo.attributes.position;
    for (let i = 0; i < lPos.count; i++) {
      let x = lPos.getX(i);
      let y = lPos.getY(i);
      let z = lPos.getZ(i);
      // Elongate and add gyri waviness
      z *= 1.35;
      y *= 0.95;
      const wave = Math.sin(x * 18) * Math.cos(z * 18) * 0.025;
      lPos.setXYZ(i, x + wave, y + wave, z);
    }
    leftGeo.computeVertexNormals();
    const leftHemi = new THREE.Mesh(leftGeo, brainMat);
    leftHemi.position.set(-0.13, 0, 0);
    leftHemi.castShadow = true;
    group.add(leftHemi);

    // Right hemisphere
    const rightGeo = leftGeo.clone();
    const rightHemi = new THREE.Mesh(rightGeo, brainMat);
    rightHemi.position.set(0.13, 0, 0);
    rightHemi.castShadow = true;
    group.add(rightHemi);

    // Cerebellum
    const cbGeo = new THREE.SphereGeometry(0.13, 14, 14);
    const cbMesh = new THREE.Mesh(cbGeo, new THREE.MeshStandardMaterial({
      color: 0x6e3640,
      roughness: 0.3
    }));
    cbMesh.position.set(0, -0.15, -0.22);
    cbMesh.scale.set(1.5, 0.8, 1.0);
    cbMesh.castShadow = true;
    group.add(cbMesh);

    return { group, type: 'brain', baseScale: 1.1 };
  }

  // Create 3D Severed Eyeball with optic nerve
  createEyeballMesh() {
    const group = new THREE.Group();

    // Sclera
    const eyeGeo = new THREE.SphereGeometry(0.22, 24, 24);
    const eyeMat = new THREE.MeshStandardMaterial({
      color: 0xe8e0d5,
      roughness: 0.08,
      metalness: 0.05
    });
    const eyeball = new THREE.Mesh(eyeGeo, eyeMat);
    eyeball.castShadow = true;
    group.add(eyeball);

    // Iris & Pupil (flattened circle on front)
    const irisGeo = new THREE.RingGeometry(0.04, 0.11, 24);
    const irisMat = new THREE.MeshBasicMaterial({ color: 0x1a4535, side: THREE.DoubleSide });
    const iris = new THREE.Mesh(irisGeo, irisMat);
    iris.position.set(0, 0, 0.222);
    group.add(iris);

    const pupilGeo = new THREE.CircleGeometry(0.05, 24);
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x050505, side: THREE.DoubleSide });
    const pupil = new THREE.Mesh(pupilGeo, pupilMat);
    pupil.position.set(0, 0, 0.223);
    group.add(pupil);

    // Bloody optic nerve cord trailing behind
    const nerveCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, -0.2),
      new THREE.Vector3(0.05, -0.1, -0.35),
      new THREE.Vector3(-0.04, -0.2, -0.5),
      new THREE.Vector3(0.02, -0.3, -0.65)
    ]);
    const nerveGeo = new THREE.TubeGeometry(nerveCurve, 16, 0.035, 8, false);
    const nerveMat = new THREE.MeshStandardMaterial({
      color: 0x7a0c18,
      roughness: 0.15
    });
    const nerve = new THREE.Mesh(nerveGeo, nerveMat);
    nerve.castShadow = true;
    group.add(nerve);

    return { group, type: 'eyeball', baseScale: 1.2 };
  }

  // Create 3D Viscera / Entrails coil
  createVisceraMesh() {
    const group = new THREE.Group();

    const visceraCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.25, 0, -0.15),
      new THREE.Vector3(0, 0.08, -0.25),
      new THREE.Vector3(0.25, 0, -0.1),
      new THREE.Vector3(0.15, -0.05, 0.15),
      new THREE.Vector3(-0.15, -0.02, 0.2),
      new THREE.Vector3(0, 0.05, 0.05)
    ]);

    const visceraGeo = new THREE.TubeGeometry(visceraCurve, 32, 0.09, 10, true);
    const visceraMat = new THREE.MeshStandardMaterial({
      color: 0x5a101b,
      roughness: 0.1,
      metalness: 0.15
    });

    const mesh = new THREE.Mesh(visceraGeo, visceraMat);
    mesh.castShadow = true;
    group.add(mesh);

    return { group, type: 'viscera', baseScale: 1.0 };
  }

  // Spawn an organ at given 3D coordinates
  spawnOrgan(type, startPos, initialVel = null) {
    let organData;
    if (type === 'heart') organData = this.createHeartMesh();
    else if (type === 'brain') organData = this.createBrainMesh();
    else if (type === 'eyeball') organData = this.createEyeballMesh();
    else organData = this.createVisceraMesh();

    const { group, baseScale } = organData;
    group.position.copy(startPos);
    group.scale.set(baseScale, baseScale, baseScale);

    this.scene.add(group);

    const organObj = {
      group,
      type,
      baseScale,
      velocity: initialVel || new THREE.Vector3(
        (Math.random() - 0.5) * 1.5,
        Math.random() * 2.5 + 1.0,
        (Math.random() - 0.5) * 1.5
      ),
      rotVel: new THREE.Vector3(
        (Math.random() - 0.5) * 4,
        (Math.random() - 0.5) * 4,
        (Math.random() - 0.5) * 4
      ),
      isGrounded: false,
      targeted: false,
      eaten: false,
      age: 0
    };

    this.activeOrgans.push(organObj);
    return organObj;
  }

  // Get closest active organ to a position
  getClosestOrgan(position) {
    let closest = null;
    let minDist = Infinity;
    for (let o of this.activeOrgans) {
      if (o.eaten) continue;
      const d = position.distanceTo(o.group.position);
      if (d < minDist) {
        minDist = d;
        closest = o;
      }
    }
    return { organ: closest, distance: minDist };
  }

  removeOrgan(organ) {
    organ.eaten = true;
    this.scene.remove(organ.group);
    const idx = this.activeOrgans.indexOf(organ);
    if (idx !== -1) {
      this.activeOrgans.splice(idx, 1);
    }
  }

  update(delta) {
    for (let i = this.activeOrgans.length - 1; i >= 0; i--) {
      const o = this.activeOrgans[i];
      o.age += delta;

      // Heartbeat pulse animation
      if (o.type === 'heart') {
        const pulse = 1.0 + Math.sin(o.age * 9.0) * 0.08 + Math.sin(o.age * 18.0) * 0.03;
        o.group.scale.set(o.baseScale * pulse, o.baseScale * pulse, o.baseScale * pulse);
      }

      // Physics integration (gravity + floor bounce on uneven terrain)
      if (!o.isGrounded) {
        o.velocity.y -= 9.8 * delta;
        o.group.position.addScaledVector(o.velocity, delta);

        o.group.rotation.x += o.rotVel.x * delta;
        o.group.rotation.y += o.rotVel.y * delta;
        o.group.rotation.z += o.rotVel.z * delta;

        // Ground level bounce on actual rocky cave floor
        const terrainY = this.getTerrainHeight ? this.getTerrainHeight(o.group.position.x, o.group.position.z) : 0;
        const groundY = terrainY + 0.22;

        if (o.group.position.y <= groundY) {
          o.group.position.y = groundY;
          o.velocity.y = -o.velocity.y * 0.35; // Wet fleshy dampening
          o.velocity.x *= 0.6;
          o.velocity.z *= 0.6;
          o.rotVel.multiplyScalar(0.5);

          if (this.onBounce) {
            this.onBounce(o.group.position.clone(), o.type);
          }

          if (Math.abs(o.velocity.y) < 0.2) {
            o.velocity.set(0, 0, 0);
            o.isGrounded = true;
          }
        }
      }
    }
  }
}
