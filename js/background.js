// Interactive Depressive Background System
export class DepressiveBackground {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.particles = [];
    this.streaks = [];
    this.maxParticles = 120;
    this.maxStreaks = 40;
    this.mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2, vx: 0, vy: 0, lastX: 0, lastY: 0 };
    this.targetMouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    this.hungerFactor = 0.5;
    this.width = 0;
    this.height = 0;

    this.resize();
    this.initEntities();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('mousemove', (e) => this.onMouseMove(e));
  }

  resize() {
    this.width = this.canvas.width = window.innerWidth;
    this.height = this.canvas.height = window.innerHeight;
  }

  onMouseMove(e) {
    this.targetMouse.x = e.clientX;
    this.targetMouse.y = e.clientY;
  }

  initEntities() {
    this.particles = [];
    for (let i = 0; i < this.maxParticles; i++) {
      this.particles.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        size: Math.random() * 2.5 + 0.8,
        speedX: (Math.random() - 0.5) * 0.4,
        speedY: Math.random() * 0.7 + 0.3,
        opacity: Math.random() * 0.4 + 0.1,
        drift: Math.random() * Math.PI * 2,
        decay: Math.random() * 0.005 + 0.002,
        colorType: Math.random() > 0.85 ? 'crimson' : 'ash'
      });
    }

    this.streaks = [];
    for (let i = 0; i < this.maxStreaks; i++) {
      this.streaks.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        length: Math.random() * 50 + 20,
        speed: Math.random() * 2 + 1.2,
        opacity: Math.random() * 0.2 + 0.05
      });
    }
  }

  setHunger(hunger) {
    this.hungerFactor = Math.max(0, Math.min(1, hunger));
  }

  update() {
    // Smooth mouse follow & velocity calculation
    const dx = this.targetMouse.x - this.mouse.x;
    const dy = this.targetMouse.y - this.mouse.y;
    this.mouse.vx = dx * 0.1;
    this.mouse.vy = dy * 0.1;
    this.mouse.x += this.mouse.vx;
    this.mouse.y += this.mouse.vy;

    // Clear with dark abyssal fade
    this.ctx.fillStyle = 'rgba(6, 6, 8, 0.3)';
    this.ctx.fillRect(0, 0, this.width, this.height);

    // 1. Draw weeping streaks (depressive rain/tears)
    this.ctx.lineWidth = 1;
    for (let s of this.streaks) {
      s.y += s.speed;
      if (s.y > this.height) {
        s.y = -s.length;
        s.x = Math.random() * this.width;
      }

      // Cursor deflection
      const distToCursor = Math.hypot(s.x - this.mouse.x, s.y - this.mouse.y);
      if (distToCursor < 120) {
        const angle = Math.atan2(s.y - this.mouse.y, s.x - this.mouse.x);
        s.x += Math.cos(angle) * (120 - distToCursor) * 0.03;
      }

      const grad = this.ctx.createLinearGradient(s.x, s.y, s.x, s.y + s.length);
      grad.addColorStop(0, `rgba(20, 20, 25, 0)`);
      grad.addColorStop(0.7, `rgba(40, 30, 35, ${s.opacity})`);
      grad.addColorStop(1, `rgba(70, 20, 25, ${s.opacity * 1.5})`);

      this.ctx.strokeStyle = grad;
      this.ctx.beginPath();
      this.ctx.moveTo(s.x, s.y);
      this.ctx.lineTo(s.x, s.y + s.length);
      this.ctx.stroke();
    }

    // 2. Draw swirling ash / miasma particles
    for (let p of this.particles) {
      p.drift += 0.015;
      p.x += p.speedX + Math.sin(p.drift) * 0.3;
      p.y += p.speedY;

      // Mouse interaction: repulsive vortex
      const dist = Math.hypot(p.x - this.mouse.x, p.y - this.mouse.y);
      if (dist < 180) {
        const force = (180 - dist) / 180;
        const angle = Math.atan2(p.y - this.mouse.y, p.x - this.mouse.x);
        // Swirling tangential + outward force
        p.x += Math.cos(angle + 0.3) * force * 3.5;
        p.y += Math.sin(angle + 0.3) * force * 3.5;
      }

      if (p.y > this.height) {
        p.y = -5;
        p.x = Math.random() * this.width;
      }
      if (p.x < 0) p.x = this.width;
      if (p.x > this.width) p.x = 0;

      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      if (p.colorType === 'crimson') {
        this.ctx.fillStyle = `rgba(${140 + this.hungerFactor * 80}, 20, 30, ${p.opacity * (0.8 + this.hungerFactor * 0.5)})`;
      } else {
        this.ctx.fillStyle = `rgba(160, 160, 170, ${p.opacity})`;
      }
      this.ctx.fill();
    }

    // 3. Dynamic oppressive darkness around mouse (vignette halo)
    const cursorGlow = this.ctx.createRadialGradient(
      this.mouse.x, this.mouse.y, 10,
      this.mouse.x, this.mouse.y, 350 + this.hungerFactor * 150
    );
    // Dark core with sickly faint crimson rim
    const rimAlpha = 0.08 + this.hungerFactor * 0.15;
    cursorGlow.addColorStop(0, 'rgba(15, 5, 8, 0)');
    cursorGlow.addColorStop(0.5, `rgba(50, 10, 18, ${rimAlpha})`);
    cursorGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    this.ctx.fillStyle = cursorGlow;
    this.ctx.fillRect(0, 0, this.width, this.height);
  }
}
