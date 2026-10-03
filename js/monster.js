import * as THREE from 'three';
import { FBXLoader } from '../libs/FBXLoader.js';

export class CryWolfMonster {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.options = options;
    this.model = null;
    this.mixer = null;
    this.animations = new Map();
    this.currentAction = null;
    this.headBone = null;
    this.eyeLights = [];

    // Terrain & Locomotion
    this.getTerrainHeight = options.getTerrainHeight || null;
    this.onStep = options.onStep || null;
    this.stepTimer = 0;
    this.groundOffsetY = 0;

    // State machine
    this.state = 'IDLE'; // IDLE, STALK_CURSOR, CHASE_ORGAN, FEEDING
    this.hunger = 0.55; // 0 (Sated) to 1.0 (Ravenous)
    this.hungerRate = 0.015; // Hunger gained per second
    this.moveSpeed = 2.4;
    this.targetPosition = new THREE.Vector3(0, 0, 0);
    this.targetOrgan = null;
    this.feedTimer = 0;
    this.isBiting = false;

    // Callbacks
    this.onBite = options.onBite || null;
    this.onGrowl = options.onGrowl || null;
    this.onStateChange = options.onStateChange || null;

    this.loadTextures();
  }

  loadTextures() {
    const texLoader = new THREE.TextureLoader();

    this.texMainBase = texLoader.load('./textures/BODY PAINT_Cry_Wolf_Main_BaseColor.webp');
    this.texMainBase.encoding = THREE.sRGBEncoding;

    this.texMainNormal = texLoader.load('./textures/BODY PAINT_Cry_Wolf_Main_Normal_2k.webp');
    this.texMainRough = texLoader.load('./textures/BODY PAINT_Cry_Wolf_Main_Roughness.webp');

    this.texSecBase = texLoader.load('./textures/BODY PAINT_Cry_Wolf_SEC_BaseColor.webp');
    this.texSecBase.encoding = THREE.sRGBEncoding;

    this.texSecNormal = texLoader.load('./textures/BODY PAINT_Cry_Wolf_SEC_Normal.webp');
    this.texSecRough = texLoader.load('./textures/BODY PAINT_Cry_Wolf_SEC_Roughness.webp');
  }

  load(onProgress = null) {
    return new Promise((resolve, reject) => {
      const loader = new FBXLoader();
      loader.load(
        './CRY_WOLF/Cry+Wolf_FBX/Cry Wolf.fbx',
        (fbx) => {
          this.setupModel(fbx);
          resolve(this);
        },
        (xhr) => {
          if (onProgress) {
            const percent = xhr.total ? (xhr.loaded / xhr.total) * 100 : 0;
            onProgress(percent, xhr.loaded);
          }
        },
        (error) => {
          console.error('Failed to load Cry Wolf FBX:', error);
          reject(error);
        }
      );
    });
  }

  setupModel(fbx) {
    this.model = fbx;
    this.scene.add(this.model);

    // 1. Traverse and configure all SkinnedMeshes and bones
    this.model.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        child.frustumCulled = false; // Essential for animated skinned meshes

        const isSecondary = child.name.includes('.001') || (child.material && child.material.name && child.material.name.includes('SEC'));

        const mat = new THREE.MeshStandardMaterial({
          color: 0x666666,
          map: isSecondary ? this.texSecBase : this.texMainBase,
          normalMap: isSecondary ? this.texSecNormal : this.texMainNormal,
          normalScale: new THREE.Vector2(1.2, 1.2),
          roughnessMap: isSecondary ? this.texSecRough : this.texMainRough,
          roughness: 0.65,
          metalness: 0.15,
          skinning: child.isSkinnedMesh === true, // Critical for Three.js r128 SkinnedMesh!
          side: THREE.DoubleSide
        });

        // Ensure texture maps flag update
        if (mat.map) mat.map.needsUpdate = true;
        if (mat.normalMap) mat.normalMap.needsUpdate = true;

        child.material = mat;
      }

      if (child.isBone) {
        if (child.name.includes('Head') || child.name.includes('head')) {
          this.headBone = child;
        }
      }
    });

    // 2. Measure bounding box and auto-scale / ground properly
    const initialBox = new THREE.Box3().setFromObject(this.model);
    const size = initialBox.getSize(new THREE.Vector3());
    console.log('Cry Wolf Initial Size:', size, 'Box:', initialBox);

    // Desired height in world units (~2.2m imposing dire wolf)
    const targetHeight = 2.2;
    if (size.y > 0) {
      const scaleFactor = targetHeight / size.y;
      this.model.scale.set(scaleFactor, scaleFactor, scaleFactor);
      console.log(`Auto-scaled Cry Wolf by ${scaleFactor.toFixed(3)} to height ${targetHeight}`);
    } else {
      this.model.scale.set(1.0, 1.0, 1.0);
    }

    // Ground the feet cleanly on y = 0
    const scaledBox = new THREE.Box3().setFromObject(this.model);
    if (scaledBox.min.y < 0) {
      this.groundOffsetY = -scaledBox.min.y;
      this.model.position.y = this.groundOffsetY;
    } else {
      this.groundOffsetY = 0;
    }
    console.log('Cry Wolf Grounded Position:', this.model.position, 'Offset:', this.groundOffsetY);

    // 3. Attach eerie glowing crimson eye lights to head
    const eyeLightL = new THREE.PointLight(0xff0810, 2.5, 4.0);
    const eyeLightR = new THREE.PointLight(0xff0810, 2.5, 4.0);
    eyeLightL.position.set(-0.25, 1.8, 1.2);
    eyeLightR.position.set(0.25, 1.8, 1.2);
    if (this.headBone) {
      this.headBone.add(eyeLightL);
      this.headBone.add(eyeLightR);
    } else {
      this.model.add(eyeLightL);
      this.model.add(eyeLightR);
    }
    this.eyeLights = [eyeLightL, eyeLightR];

    // 4. Setup animations
    this.mixer = new THREE.AnimationMixer(this.model);

    if (fbx.animations && fbx.animations.length > 0) {
      for (let clip of fbx.animations) {
        const action = this.mixer.clipAction(clip);
        this.animations.set(clip.name, action);
        console.log('Loaded Animation Clip:', clip.name, `(${clip.duration.toFixed(2)}s)`);
      }
    }

    // Play default idle animation
    this.playAnimation('rig|IDDLE1', 0.2);
  }

  playAnimation(name, fadeDuration = 0.3, loop = THREE.LoopRepeat) {
    if (!this.mixer) return;
    let action = this.animations.get(name);
    if (!action) {
      // Fallback matching
      for (let [k, act] of this.animations) {
        if (k.toLowerCase().includes(name.toLowerCase())) {
          action = act;
          break;
        }
      }
    }

    if (!action || action === this.currentAction) return;

    action.reset();
    action.setLoop(loop);
    action.clampWhenFinished = (loop === THREE.LoopOnce);

    if (this.currentAction) {
      this.currentAction.crossFadeTo(action, fadeDuration, true);
    }
    action.play();
    this.currentAction = action;
  }

  setState(newState) {
    if (this.state === newState) return;
    this.state = newState;
    if (this.onStateChange) this.onStateChange(newState);
  }

  feed() {
    this.hunger = Math.max(0, this.hunger - 0.45);
    this.setState('FEEDING');
    this.feedTimer = 1.6;
    this.isBiting = true;

    // Play savage attack animation
    const atkClip = Math.random() > 0.5 ? 'rig|ATK 1' : 'rig|ATK 2';
    this.playAnimation(atkClip, 0.15, THREE.LoopOnce);

    // After bite delay, trigger blood splatter & crunch
    setTimeout(() => {
      if (this.onBite && this.targetOrgan) {
        this.onBite(this.targetOrgan.group.position.clone());
      } else if (this.onBite && this.model) {
        const mouthPos = this.model.position.clone().add(new THREE.Vector3(0, 0.8, 0.8));
        this.onBite(mouthPos);
      }
    }, 450);
  }

  update(delta, cursorGroundPos, closestOrganData) {
    if (!this.model || !this.mixer) return;

    this.mixer.update(delta);

    // Hunger progression
    this.hunger = Math.min(1.0, this.hunger + this.hungerRate * delta);

    // Update eye light intensity based on hunger
    const eyeIntensity = 0.6 + this.hunger * 3.0;
    for (let light of this.eyeLights) {
      light.intensity = eyeIntensity * (0.8 + Math.random() * 0.4); // flicker
    }

    // Determine State & Target
    const { organ, distance: organDist } = closestOrganData || { organ: null, distance: Infinity };

    if (this.state === 'FEEDING') {
      this.feedTimer -= delta;
      if (this.feedTimer <= 0) {
        this.isBiting = false;
        this.targetOrgan = null;
        this.setState(this.hunger > 0.6 ? 'STALK_CURSOR' : 'IDLE');
        this.playAnimation(this.hunger > 0.7 ? 'rig|IDDLE3' : 'rig|IDDLE1', 0.4);
      }
      return; // Locked in feeding action
    }

    // 1. Organ detected in scene
    let isMoving = false;
    if (organ && !organ.eaten) {
      this.targetOrgan = organ;
      this.setState('CHASE_ORGAN');
      this.targetPosition.copy(organ.group.position);

      // Check if within feeding distance
      const distToOrgan = this.model.position.distanceTo(organ.group.position);
      if (distToOrgan < 1.35) {
        this.feed();
        return;
      }
    }
    // 2. No organs: Stalk cursor if hungry
    else if (this.hunger > 0.45 && cursorGroundPos) {
      this.targetOrgan = null;
      this.setState('STALK_CURSOR');
      this.targetPosition.copy(cursorGroundPos);
      // Keep a small menacing distance from exact cursor
      const distToCursor = this.model.position.distanceTo(cursorGroundPos);
      if (distToCursor < 1.6 && Math.random() < 0.015 && this.onGrowl) {
        this.onGrowl();
      }
    }
    // 3. Otherwise Sated Idle
    else {
      this.targetOrgan = null;
      this.setState('IDLE');
    }

    // Handle Movement & Facing Target
    if (this.state === 'CHASE_ORGAN' || (this.state === 'STALK_CURSOR' && this.hunger > 0.55)) {
      const dist = this.model.position.distanceTo(this.targetPosition);

      if (dist > (this.state === 'CHASE_ORGAN' ? 1.0 : 1.6)) {
        isMoving = true;
        // Play walking animation
        this.playAnimation('rig|MOVE_Walk', 0.25);

        // Turn towards target
        const dir = new THREE.Vector3().subVectors(this.targetPosition, this.model.position);
        dir.y = 0;
        dir.normalize();

        const targetAngle = Math.atan2(dir.x, dir.z);
        // Smooth rotation slerp
        let currentAngle = this.model.rotation.y;
        let diff = targetAngle - currentAngle;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        this.model.rotation.y += diff * 4.5 * delta;

        // Move directly towards target along ground plane
        const currentSpeed = (this.state === 'CHASE_ORGAN' ? this.moveSpeed * 1.4 : this.moveSpeed * (0.6 + this.hunger * 0.6));
        this.model.position.addScaledVector(dir, currentSpeed * delta);

        // Footstep timing
        this.stepTimer += delta;
        if (this.stepTimer > 0.48) {
          this.stepTimer = 0;
          if (this.onStep) this.onStep();
        }
      } else {
        // Reached destination, hold idle
        this.stepTimer = 0;
        this.playAnimation(this.hunger > 0.7 ? 'rig|IDDLE3' : 'rig|IDDLE1', 0.3);
      }
    } else {
      // Idle
      this.stepTimer = 0;
      this.playAnimation('rig|IDDLE1', 0.4);
    }

    // Terrain height and slope pitch adaptation
    if (this.model) {
      const px = this.model.position.x;
      const pz = this.model.position.z;
      const groundY = this.getTerrainHeight ? this.getTerrainHeight(px, pz) : 0;
      const targetY = groundY + this.groundOffsetY;
      this.model.position.y = THREE.MathUtils.lerp(this.model.position.y, targetY, 0.22);

      // Pitch adjustment on uneven slopes
      if (this.getTerrainHeight) {
        const forwardDist = 0.7;
        const fx = px + Math.sin(this.model.rotation.y) * forwardDist;
        const fz = pz + Math.cos(this.model.rotation.y) * forwardDist;
        const bx = px - Math.sin(this.model.rotation.y) * forwardDist;
        const bz = pz - Math.cos(this.model.rotation.y) * forwardDist;
        const heightDiff = this.getTerrainHeight(fx, fz) - this.getTerrainHeight(bx, bz);
        const pitch = Math.atan2(heightDiff, forwardDist * 2);
        this.model.rotation.x = THREE.MathUtils.lerp(this.model.rotation.x, -pitch * 0.6, 0.15);
      }
    }
  }
}
