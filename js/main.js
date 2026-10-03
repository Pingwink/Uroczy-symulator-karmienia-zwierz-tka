import * as THREE from 'three';
import { OrbitControls } from '../libs/OrbitControls.js';
import { horrorAudio } from './audio.js';
import { DepressiveBackground } from './background.js';
import { BloodSystem } from './blood.js';
import { OrganFactory } from './organs.js';
import { CryWolfMonster } from './monster.js';
import { CaveEnvironment } from './environment.js';

class CryWolfExperience {
  constructor() {
    this.selectedOrgan = 'heart';
    this.organsFedCount = 0;
    this.bloodSpilledLiters = 0;
    this.cameraFollowBeast = false;
    this.diceTimer = null;

    this.whispers = [
      "The void does not fill. It only swallows.",
      "His ribs grind against his spine in the dark.",
      "Every mouthful is borrowed time.",
      "He smells your pulse through planar boundaries.",
      "Silence is only the space between hungers.",
      "Flesh withers. The beast remains.",
      "Cast another tribute into the abyssal crag.",
      "He remembers nothing but teeth and cold.",
      "The dungeon stones remember every drop spilled here.",
      "A bottomless hollow wrapped in fiendish wolfskin."
    ];

    this.initElements();
    this.initBackground();
    this.initThree();
    this.initSystems();
    this.setupEvents();
    this.loadMonster();
  }

  initElements() {
    this.bgCanvas = document.getElementById('bgCanvas');
    this.webglCanvas = document.getElementById('webglCanvas');
    this.bloodCanvas = document.getElementById('bloodCanvas');
    this.meterFill = document.getElementById('meterFill');
    this.hungerStateText = document.getElementById('hungerStateText');
    this.starvationPulse = document.getElementById('starvationPulse');
    this.whisperText = document.getElementById('whisperText');
    this.statOrgans = document.getElementById('statOrgans');
    this.statBlood = document.getElementById('statBlood');
    this.loadingScreen = document.getElementById('loadingScreen');
    this.loadingBar = document.getElementById('loadingBar');
    this.loadingStatus = document.getElementById('loadingStatus');
    this.enterBtn = document.getElementById('enterBtn');
    this.muteBtn = document.getElementById('muteBtn');
    this.camBtn = document.getElementById('camBtn');
    this.resetCamBtn = document.getElementById('resetCamBtn');
    this.rollD20Btn = document.getElementById('rollD20Btn');
    this.statBlockBtn = document.getElementById('statBlockBtn');
    this.statBlockModal = document.getElementById('statBlockModal');
    this.modalBackdrop = document.getElementById('modalBackdrop');
    this.closeStatBlockBtn = document.getElementById('closeStatBlockBtn');
    this.diceBanner = document.getElementById('diceBanner');
    this.d20RollNumber = document.getElementById('d20RollNumber');
    this.diceTitle = document.getElementById('diceTitle');
    this.diceDesc = document.getElementById('diceDesc');
    this.combatLogEntries = document.getElementById('combatLogEntries');
    this.clearLogBtn = document.getElementById('clearLogBtn');
    this.cursorReticle = document.getElementById('cursorReticle');

    this.resizeOverlays();
    window.addEventListener('resize', () => this.resizeOverlays());
  }

  resizeOverlays() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (this.bloodCanvas) {
      this.bloodCanvas.width = w;
      this.bloodCanvas.height = h;
    }
  }

  initBackground() {
    this.background = new DepressiveBackground(this.bgCanvas);
  }

  initThree() {
    // Scene with dense subterranean abyssal fog
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x060509, 0.048);

    // Camera
    this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 120);
    this.defaultCamPos = new THREE.Vector3(0, 3.2, 7.8);
    this.defaultCamTarget = new THREE.Vector3(0, 1.2, 0);
    this.camera.position.copy(this.defaultCamPos);

    // WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.webglCanvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;

    // Controls: Right-click rotates, Wheel zooms
    this.controls = new OrbitControls(this.camera, this.webglCanvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.02;
    this.controls.minDistance = 2.2;
    this.controls.maxDistance = 18;
    this.controls.target.copy(this.defaultCamTarget);
    this.controls.mouseButtons = {
      LEFT: null,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.ROTATE
    };

    // Ambient light
    const ambientLight = new THREE.AmbientLight(0x1a1518, 0.65);
    this.scene.add(ambientLight);

    // Moon / Upper Light
    this.moonLight = new THREE.DirectionalLight(0x7585a0, 1.6);
    this.moonLight.position.set(7, 14, 6);
    this.moonLight.castShadow = true;
    this.moonLight.shadow.mapSize.width = 2048;
    this.moonLight.shadow.mapSize.height = 2048;
    this.moonLight.shadow.camera.near = 0.5;
    this.moonLight.shadow.camera.far = 28;
    this.moonLight.shadow.bias = -0.0005;
    this.scene.add(this.moonLight);

    // Key light
    this.keyLight = new THREE.DirectionalLight(0xd5dcee, 1.1);
    this.keyLight.position.set(0, 5, 8);
    this.scene.add(this.keyLight);

    // Crimson rim light
    this.rimLight = new THREE.DirectionalLight(0xad1624, 1.5);
    this.rimLight.position.set(-6, 7, -6);
    this.scene.add(this.rimLight);

    // Torch light
    this.torchLight = new THREE.PointLight(0xdc4518, 1.2, 14, 1.5);
    this.torchLight.position.set(-2.5, 1.8, 2.5);
    this.scene.add(this.torchLight);

    // Raycaster
    this.raycaster = new THREE.Raycaster();
    this.mouseNDC = new THREE.Vector2();
    this.groundHitPos = new THREE.Vector3(0, 0, 0);

    // Clock
    this.clock = new THREE.Clock();
  }

  initSystems() {
    // 1. 3D Cavern Environment
    this.caveEnvironment = new CaveEnvironment(this.scene);
    this.groundMesh = this.caveEnvironment.terrainMesh;

    // 2. Blood Gore System
    this.bloodSystem = new BloodSystem(this.scene, this.bloodCanvas, {
      getTerrainHeight: (x, z) => this.caveEnvironment.getTerrainHeight(x, z)
    });

    // 3. Anatomical Relics
    this.organFactory = new OrganFactory(this.scene, {
      getTerrainHeight: (x, z) => this.caveEnvironment.getTerrainHeight(x, z),
      onBounce: (pos, type) => {
        horrorAudio.playSquelch();
        this.bloodSystem.createGroundSplat(pos.x, pos.z);
      }
    });
  }

  loadMonster() {
    this.loadingStatus.textContent = 'AWAKENING CRY WOLF... (LOADING 3D FBX)';

    this.monster = new CryWolfMonster(this.scene, {
      getTerrainHeight: (x, z) => this.caveEnvironment.getTerrainHeight(x, z),
      onStep: () => horrorAudio.playFootstep(),
      onBite: (pos) => this.handleMonsterBite(pos),
      onGrowl: () => {
        horrorAudio.playMonsterGrowl();
        this.addCombatLog('lore', 'Cry Wolf lets out a guttural, sorrowful growl.');
      },
      onStateChange: (state) => this.handleMonsterStateChange(state)
    });

    this.monster.load((percent, bytes) => {
      const mb = (bytes / 1024 / 1024).toFixed(1);
      this.loadingBar.style.width = `${percent}%`;
      this.loadingStatus.textContent = `SUMMONING 3D ENTITY... ${percent.toFixed(0)}% (${mb} MB)`;
    }).then(() => {
      this.loadingBar.style.width = '100%';
      this.loadingStatus.textContent = 'THE BEAST HAS AWOKEN';
      this.enterBtn.style.display = 'inline-block';

      if (this.monster && this.monster.model) {
        const box = new THREE.Box3().setFromObject(this.monster.model);
        const center = box.getCenter(new THREE.Vector3());
        this.defaultCamTarget.copy(center);
        this.defaultCamPos.set(center.x, center.y + 1.2, center.z + 5.5);
        this.controls.target.copy(this.defaultCamTarget);
        this.camera.position.copy(this.defaultCamPos);
        this.controls.update();
      }
    }).catch((err) => {
      console.error('Monster loading failed:', err);
      this.loadingStatus.textContent = 'FAILED TO SUMMON: ' + err.message;
    });
  }

  addCombatLog(type, message) {
    if (!this.combatLogEntries) return;
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    const timeTag = document.createElement('span');
    timeTag.className = 'log-time';
    const d = new Date();
    timeTag.textContent = `[${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}]`;
    entry.appendChild(timeTag);
    entry.appendChild(document.createTextNode(' ' + message));
    this.combatLogEntries.appendChild(entry);
    this.combatLogEntries.scrollTop = this.combatLogEntries.scrollHeight;
  }

  rollD20(context = 'Skill Check') {
    horrorAudio.init();
    horrorAudio.playDiceRoll();

    const roll = Math.floor(Math.random() * 20) + 1;
    if (this.d20RollNumber) this.d20RollNumber.textContent = roll;

    let desc = '';
    let isCrit = false;

    if (roll === 20) {
      desc = 'NATURAL 20! Critical Triumph! The beast feasts in awe!';
      isCrit = true;
      horrorAudio.playCritical();
      this.bloodSystem.triggerScreenSplatter();
    } else if (roll === 1) {
      desc = 'NATURAL 1! Critical Fumble! The beast snaps in fury!';
      horrorAudio.playMonsterGrowl();
    } else if (roll >= 15) {
      desc = `Rolled ${roll} + 4 = ${roll + 4}. High Success! Frenzy placated.`;
    } else if (roll >= 10) {
      desc = `Rolled ${roll} + 2 = ${roll + 2}. Moderate Success. Feast accepted.`;
    } else {
      desc = `Rolled ${roll}. Check Failed! The void gnaws deeper.`;
    }

    if (this.diceTitle) this.diceTitle.textContent = `D20 ROLL: ${context.toUpperCase()}`;
    if (this.diceDesc) this.diceDesc.textContent = desc;

    if (this.diceBanner) {
      this.diceBanner.classList.remove('hidden');
      clearTimeout(this.diceTimer);
      this.diceTimer = setTimeout(() => {
        this.diceBanner.classList.add('hidden');
      }, 4000);
    }

    this.addCombatLog('dice', `🎲 D20 [${context}]: Rolled ${roll}! ${desc}`);
    return roll;
  }

  handleMonsterBite(pos) {
    // 1. Spurt visceral 3D blood & ground pool & screen splatter
    this.bloodSystem.triggerBiteGore(pos, 150);

    // 2. Play brutal crunch bite audio
    horrorAudio.playCrunchBite();

    // 3. Remove targeted organ
    if (this.monster.targetOrgan) {
      this.organFactory.removeOrgan(this.monster.targetOrgan);
    }

    // 4. Update stats & combat log
    this.organsFedCount++;
    const spilled = parseFloat((Math.random() * 0.8 + 0.6).toFixed(1));
    this.bloodSpilledLiters += spilled;
    if (this.statOrgans) this.statOrgans.textContent = this.organsFedCount;
    if (this.statBlood) this.statBlood.textContent = this.bloodSpilledLiters.toFixed(1);

    const dmg = Math.floor(Math.random() * 24 + 20);
    this.addCombatLog('damage', `Cry Wolf executes Abyssal Bite for ${dmg} necrotic damage! (${spilled} L blood spilled)`);

    // 5. Trigger aphorism whisper
    this.triggerWhisper();
  }

  handleMonsterStateChange(state) {
    if (state === 'CHASE_ORGAN') {
      horrorAudio.playMonsterGrowl();
      this.addCombatLog('system', 'Cry Wolf locks onto the organ offering and charges!');
    } else if (state === 'STALK_CURSOR') {
      this.addCombatLog('lore', 'Cry Wolf enters Stalk Cursor mode, pacing toward your reticle.');
    }
  }

  triggerWhisper(forceText = null) {
    const text = forceText || this.whispers[Math.floor(Math.random() * this.whispers.length)];
    if (!this.whisperText) return;
    this.whisperText.textContent = text;
    this.whisperText.style.opacity = '1';
    this.addCombatLog('lore', `"${text}"`);

    clearTimeout(this.whisperTimer);
    this.whisperTimer = setTimeout(() => {
      this.whisperText.style.opacity = '0';
    }, 4500);
  }

  resetCamera() {
    this.cameraFollowBeast = false;
    if (this.camBtn) {
      this.camBtn.textContent = '👁 Scrying Cam';
      this.camBtn.classList.remove('active');
    }

    if (this.monster && this.monster.model) {
      const box = new THREE.Box3().setFromObject(this.monster.model);
      const center = box.getCenter(new THREE.Vector3());
      this.controls.target.copy(center);
      this.camera.position.set(center.x, center.y + 1.2, center.z + 5.5);
    } else {
      this.controls.target.copy(this.defaultCamTarget);
      this.camera.position.copy(this.defaultCamPos);
    }
    this.controls.update();
    this.addCombatLog('system', 'Camera view recentered upon Cry Wolf.');
  }

  setupEvents() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // Enter / Start Experience
    this.enterBtn.addEventListener('click', () => {
      horrorAudio.init();
      this.loadingScreen.classList.add('hidden');
      this.triggerWhisper("He breathes in the cold silence. Cast an offering.");
      this.addCombatLog('system', 'Encounter initiated. The cavern awaits your tribute.');
    });

    // Mute Button
    if (this.muteBtn) {
      this.muteBtn.addEventListener('click', () => {
        horrorAudio.init();
        const muted = horrorAudio.toggleMute();
        this.muteBtn.innerHTML = muted ? '🔇 Muted' : '🔊 Bardsong';
      });
    }

    // Scrying Camera Follow Toggle
    if (this.camBtn) {
      this.camBtn.addEventListener('click', () => {
        horrorAudio.init();
        this.cameraFollowBeast = !this.cameraFollowBeast;
        this.camBtn.textContent = this.cameraFollowBeast ? '👁 Free View' : '👁 Scrying Cam';
        this.camBtn.classList.toggle('active', this.cameraFollowBeast);
        this.addCombatLog('system', this.cameraFollowBeast ? 'Scrying lens attached to the beast.' : 'Free camera unlocked.');
      });
    }

    // Reset Camera
    if (this.resetCamBtn) {
      this.resetCamBtn.addEventListener('click', () => {
        horrorAudio.init();
        this.resetCamera();
      });
    }

    // Roll D20 Button
    if (this.rollD20Btn) {
      this.rollD20Btn.addEventListener('click', () => {
        this.rollD20('Offering Potency');
      });
    }

    // Stat Block Modal
    const openStatBlock = () => {
      if (this.statBlockModal) this.statBlockModal.classList.remove('hidden');
    };
    const closeStatBlock = () => {
      if (this.statBlockModal) this.statBlockModal.classList.add('hidden');
    };

    if (this.statBlockBtn) this.statBlockBtn.addEventListener('click', openStatBlock);
    if (this.closeStatBlockBtn) this.closeStatBlockBtn.addEventListener('click', closeStatBlock);
    if (this.modalBackdrop) this.modalBackdrop.addEventListener('click', closeStatBlock);

    // Clear Combat Log
    if (this.clearLogBtn) {
      this.clearLogBtn.addEventListener('click', () => {
        if (this.combatLogEntries) this.combatLogEntries.innerHTML = '';
      });
    }

    // Mouse Move -> Arcane Reticle & Cavern Raycasting
    window.addEventListener('mousemove', (e) => {
      if (this.cursorReticle) {
        this.cursorReticle.style.left = `${e.clientX}px`;
        this.cursorReticle.style.top = `${e.clientY}px`;
      }

      this.mouseNDC.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouseNDC.y = -(e.clientY / window.innerHeight) * 2 + 1;

      this.raycaster.setFromCamera(this.mouseNDC, this.camera);
      if (this.groundMesh) {
        const intersects = this.raycaster.intersectObject(this.groundMesh);
        if (intersects.length > 0) {
          this.groundHitPos.copy(intersects[0].point);
        }
      }
    });

    // Left Click on 3D scene -> Cast Spell Offering
    this.webglCanvas.addEventListener('pointerdown', (e) => {
      if (e.button === 0) {
        horrorAudio.init();
        this.dropOrganAtCursor();
      }
    });

    // Organ Tray Selection
    const organCards = document.querySelectorAll('.spell-slot-card');
    organCards.forEach(card => {
      card.addEventListener('click', (e) => {
        e.stopPropagation();
        horrorAudio.init();
        horrorAudio.playSquelch();

        organCards.forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        this.selectedOrgan = card.dataset.organ;
        this.addCombatLog('system', `Equipped [${this.selectedOrgan.toUpperCase()}] component in spell slot.`);
      });
    });

    // Keyboard controls
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Digit1') this.selectOrganIndex(0);
      else if (e.code === 'Digit2') this.selectOrganIndex(1);
      else if (e.code === 'Digit3') this.selectOrganIndex(2);
      else if (e.code === 'Digit4') this.selectOrganIndex(3);
      else if (e.code === 'Space') {
        e.preventDefault();
        horrorAudio.init();
        this.dropOrganAtCursor();
      }
      else if (e.key === 'b' || e.key === 'B') {
        if (this.statBlockModal) {
          if (this.statBlockModal.classList.contains('hidden')) openStatBlock();
          else closeStatBlock();
        }
      }
      else if (e.key === 'd' || e.key === 'D') {
        this.rollD20('Skill Check');
      }
      else if (e.key === 'c' || e.key === 'C') {
        if (this.camBtn) this.camBtn.click();
      }
      else if (e.key === 'r' || e.key === 'R') {
        if (this.resetCamBtn) this.resetCamBtn.click();
      }
      else if (e.key === 'm' || e.key === 'M') {
        if (this.muteBtn) this.muteBtn.click();
      }
      else if (e.key === 'Escape') {
        closeStatBlock();
      }
      else if (e.key === 'f' || e.key === 'F') {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen();
        } else {
          document.exitFullscreen();
        }
      }
    });

    // Start render loop
    requestAnimationFrame((t) => this.render(t));
  }

  selectOrganIndex(index) {
    const cards = document.querySelectorAll('.spell-slot-card');
    if (cards[index]) {
      cards[index].click();
    }
  }

  dropOrganAtCursor() {
    this.raycaster.setFromCamera(this.mouseNDC, this.camera);
    let target = new THREE.Vector3(0, 0, 0);

    if (this.groundMesh) {
      const intersects = this.raycaster.intersectObject(this.groundMesh);
      if (intersects.length > 0) {
        target.copy(intersects[0].point);
      } else {
        target.copy(this.groundHitPos);
      }
    } else {
      target.copy(this.groundHitPos);
    }

    // Spawn above ground
    const spawnPos = new THREE.Vector3(target.x, target.y + 2.5, target.z);
    this.organFactory.spawnOrgan(this.selectedOrgan, spawnPos);
    horrorAudio.playFleshDrop();

    this.addCombatLog('system', `Cast ${this.selectedOrgan.toUpperCase()} into the circle at (${target.x.toFixed(1)}, ${target.z.toFixed(1)}).`);

    // 25% chance to roll an automatic feed check on drop
    if (Math.random() < 0.35) {
      this.rollD20('Tribute DC');
    }
  }

  render(timestamp) {
    requestAnimationFrame((t) => this.render(t));

    const delta = Math.min(this.clock.getDelta(), 0.1);
    const time = timestamp * 0.001;

    // 1. Update 2D depressive background
    if (this.background) {
      const hunger = this.monster ? this.monster.hunger : 0.5;
      this.background.setHunger(hunger);
      this.background.update();
    }

    // 2. Torch light flicker
    if (this.torchLight) {
      this.torchLight.intensity = 0.75 + Math.sin(timestamp * 0.007) * 0.18 + (Math.random() - 0.5) * 0.08;
    }

    // 3. Update Cave Environment
    if (this.caveEnvironment) {
      this.caveEnvironment.update(delta, time);
      if (this.monster) {
        this.caveEnvironment.setHunger(this.monster.hunger);
      }
    }

    // 4. Subterranean cavern water drip
    if (Math.random() < 0.004) {
      horrorAudio.playCavernDrip();
    }

    // 5. Update organ physics
    this.organFactory.update(delta);

    // 6. Update monster AI & animation
    if (this.monster) {
      const closest = this.organFactory.getClosestOrgan(this.monster.model ? this.monster.model.position : new THREE.Vector3());
      this.monster.update(delta, this.groundHitPos, closest);

      // Audio engine hunger sync
      horrorAudio.setHunger(this.monster.hunger);

      // UI Hunger Gauge
      const hPercent = (this.monster.hunger * 100).toFixed(0);
      if (this.meterFill) {
        this.meterFill.style.width = `${hPercent}%`;
      }

      if (this.hungerStateText) {
        if (this.monster.hunger < 0.3) {
          this.hungerStateText.textContent = 'DORMANT / SATED (DC 10)';
          this.hungerStateText.style.color = 'var(--dnd-gold-bright)';
        } else if (this.monster.hunger < 0.65) {
          this.hungerStateText.textContent = 'RESTLESS GNAWING (DC 15)';
          this.hungerStateText.style.color = '#ff9d42';
        } else {
          this.hungerStateText.textContent = 'ABYSSAL FRENZY (DC 20)';
          this.hungerStateText.style.color = 'var(--dnd-red-bright)';
        }
      }

      // Starvation screen pulse
      if (this.starvationPulse) {
        if (this.monster.hunger > 0.65) {
          const pulse = (this.monster.hunger - 0.65) / 0.35;
          this.starvationPulse.style.opacity = (0.35 + Math.sin(timestamp * 0.005) * 0.25) * pulse;
        } else {
          this.starvationPulse.style.opacity = '0';
        }
      }

      // Dynamic Scrying Follow Camera
      if (this.cameraFollowBeast && this.monster.model) {
        const beastPos = this.monster.model.position;
        const beastTarget = beastPos.clone().add(new THREE.Vector3(0, 1.2, 0));
        this.controls.target.lerp(beastTarget, 0.08);

        const camOffset = new THREE.Vector3(
          -Math.sin(this.monster.model.rotation.y) * 4.8,
          2.6,
          -Math.cos(this.monster.model.rotation.y) * 4.8
        );
        const desiredCamPos = beastPos.clone().add(camOffset);
        this.camera.position.lerp(desiredCamPos, 0.05);
      }
    }

    // 7. Update blood gore FX
    this.bloodSystem.update(delta);

    // 8. Camera controls
    this.controls.update();

    // 9. Render 3D Scene
    this.renderer.render(this.scene, this.camera);
  }
}

// Instantiate on DOM load
window.addEventListener('DOMContentLoaded', () => {
  new CryWolfExperience();
});
