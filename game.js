
"use strict";

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const $ = id => document.getElementById(id);

const ui = {
  score: $("score"),
  lives: $("lives"),
  gems: $("gems"),
  timer: $("timer"),
  bossHud: $("bossHud"),
  bossHealth: $("bossHealth"),
  specialCount: $("specialCount"),
  message: $("messageScreen"),
  description: $("menuDescription"),
  pauseScreen: $("pauseScreen"),
  start: $("startBtn"),
  pause: $("pauseBtn"),
  resume: $("resumeBtn"),
  restart: $("restartBtn"),
  joystick: $("joystick"),
  knob: $("joyKnob"),
  special: $("specialBtn"),
  shield: $("shieldBtn"),
  notice: $("notice")
};

let W = innerWidth;
let H = innerHeight;
let DPR = 1;
let running = false;
let paused = false;
let gameOver = false;
let lastTime = 0;
let elapsed = 0;
let score = 0;
let gems = 0;
let kills = 0;
let lives = 3;
let specialCharges = 2;
let shootTimer = 0;
let spawnTimer = 0;
let powerTimer = 0;
let boss = null;
let noticeTimer = 0;
let shieldTime = 0;
let damageFlash = 0;
let screenShake = 0;
let nextBossTime = 24;
let lastBossTime = 0;

const stars = [];
const bullets = [];
const enemyBullets = [];
const enemies = [];
const pickups = [];
const particles = [];

const input = {
  x: 0,
  y: 0,
  active: false,
  pointerId: null
};

const player = {
  x: 0,
  y: 0,
  radius: 17,
  speed: 255,
  invincible: 0,
  power: 0
};

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function resize() {
  W = innerWidth;
  H = innerHeight;
  DPR = Math.min(devicePixelRatio || 1, 2);

  canvas.width = Math.floor(W * DPR);
  canvas.height = Math.floor(H * DPR);
  canvas.style.width = W + "px";
  canvas.style.height = H + "px";

  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

  if (!running && !paused) {
    player.x = W * 0.2;
    player.y = H * 0.5;
  }

  player.x = clamp(player.x, 25, W - 25);
  player.y = clamp(player.y, 55, H - 45);

  createStars();
}

function createStars() {
  stars.length = 0;
  const count = Math.min(170, Math.floor(W * H / 4300));

  for (let i = 0; i < count; i++) {
    stars.push({
      x: Math.random() * W,
      y: Math.random() * H,
      size: rand(0.5, 2.2),
      speed: rand(12, 95),
      alpha: rand(0.2, 0.95),
      phase: rand(0, 6.28)
    });
  }
}

function resetGame() {
  score = 0;
  gems = 0;
  kills = 0;
  lives = 3;
  elapsed = 0;
  shootTimer = 0;
  spawnTimer = 0.5;
  powerTimer = 0;
  specialCharges = 2;
  shieldTime = 0;
  damageFlash = 0;
  screenShake = 0;
  nextBossTime = 24;
  lastBossTime = 0;
  boss = null;

  bullets.length = 0;
  enemyBullets.length = 0;
  enemies.length = 0;
  pickups.length = 0;
  particles.length = 0;

  player.x = W * 0.19;
  player.y = H * 0.5;
  player.invincible = 2;
  player.power = 0;

  input.x = 0;
  input.y = 0;
  resetJoystick();
  updateHUD();
}

function updateHUD() {
  ui.score.textContent = Math.floor(score);
  ui.gems.textContent = gems;
  ui.timer.textContent =
    String(Math.floor(elapsed / 60)).padStart(2, "0") + ":" +
    String(Math.floor(elapsed % 60)).padStart(2, "0");

  ui.lives.innerHTML = [0, 1, 2].map(i =>
    `<span style="opacity:${i < lives ? 1 : 0.18}">♥</span>`
  ).join("");

  ui.specialCount.textContent = specialCharges + "/2";
  ui.bossHud.classList.toggle("hidden", !boss);

  if (boss) {
    ui.bossHealth.style.width =
      Math.max(0, boss.hp / boss.maxHp * 100) + "%";
  }
}

function showNotice(message) {
  ui.notice.textContent = message;
  ui.notice.classList.add("show");
  noticeTimer = 1.5;
}

function startGame() {
  resetGame();
  ui.message.classList.add("hidden");
  ui.pauseScreen.classList.add("hidden");
  running = true;
  paused = false;
  gameOver = false;
  lastTime = performance.now();
  requestAnimationFrame(loop);
}

function pauseGame() {
  if (!running || gameOver) return;
  paused = true;
  running = false;
  ui.pauseScreen.classList.remove("hidden");
  resetJoystick();
}

function resumeGame() {
  if (gameOver) return;
  paused = false;
  running = true;
  ui.pauseScreen.classList.add("hidden");
  lastTime = performance.now();
  requestAnimationFrame(loop);
}

function endGame(won = false) {
  running = false;
  paused = false;
  gameOver = true;
  resetJoystick();

  ui.message.classList.remove("hidden");
  ui.description.textContent = won
    ? `Victory, Guardian! Final score: ${Math.floor(score)}. The Void Dragon has fallen.`
    : `Your journey ends here. Final score: ${Math.floor(score)}. Defeated ${kills} enemies and collected ${gems} gems.`;

  ui.start.textContent = "PLAY AGAIN";
}

function spawnParticles(x, y, color, amount = 10) {
  for (let i = 0; i < amount; i++) {
    const a = rand(0, Math.PI * 2);
    const speed = rand(35, 180);

    particles.push({
      x, y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      life: rand(0.25, 0.8),
      maxLife: 0.8,
      size: rand(1.5, 4),
      color
    });
  }
}

function spawnEnemy() {
  const roll = Math.random();
  const isHeavy = roll > 0.77;
  const isShooter = roll > 0.52 && !isHeavy;

  enemies.push({
    x: W + 40,
    y: rand(65, H - 65),
    r: isHeavy ? 23 : 15,
    hp: isHeavy ? 4 : isShooter ? 2 : 1,
    maxHp: isHeavy ? 4 : isShooter ? 2 : 1,
    speed: rand(75, 135) + Math.min(elapsed * 0.65, 65),
    phase: rand(0, 6.28),
    shooter: isShooter,
    heavy: isHeavy,
    fire: rand(0.8, 2.3)
  });
}

function spawnBoss() {
  boss = {
    x: W + 110,
    y: H * 0.48,
    targetY: H * 0.48,
    r: 57,
    hp: 90 + Math.floor(elapsed * 1.1),
    maxHp: 90 + Math.floor(elapsed * 1.1),
    phase: 0,
    fire: 1.1,
    entered: false
  };

  ui.bossHud.classList.remove("hidden");
  showNotice("⚠ VOID DRAGON APPROACHING!");
  screenShake = 0.35;
  lastBossTime = elapsed;
}

function firePlayerBullet() {
  const powered = player.power > 0;

  bullets.push({
    x: player.x + 23,
    y: player.y,
    vx: 520,
    vy: 0,
    r: powered ? 6 : 4,
    damage: powered ? 2 : 1,
    color: powered ? "#fff4a3" : "#7cf6ff"
  });

  if (powered) {
    bullets.push({
      x: player.x + 12,
      y: player.y - 11,
      vx: 470,
      vy: -45,
      r: 4,
      damage: 1,
      color: "#ff9eed"
    });

    bullets.push({
      x: player.x + 12,
      y: player.y + 11,
      vx: 470,
      vy: 45,
      r: 4,
      damage: 1,
      color: "#ff9eed"
    });
  }

  spawnParticles(player.x + 23, player.y, "#8cfaff", 2);
}

function fireEnemyBullet(x, y, speed = 190) {
  const dx = player.x - x;
  const dy = player.y - y;
  const length = Math.hypot(dx, dy) || 1;

  enemyBullets.push({
    x, y,
    vx: dx / length * speed,
    vy: dy / length * speed,
    r: 6,
    color: "#ff725c"
  });
}

function damageEnemy(enemy, damage) {
  enemy.hp -= damage;
  spawnParticles(enemy.x, enemy.y, "#9beaff", 3);

  if (enemy.hp <= 0) {
    score += enemy.heavy ? 100 : enemy.shooter ? 65 : 35;
    kills++;
    spawnParticles(enemy.x, enemy.y, enemy.heavy ? "#ff9d52" : "#6edfff", 16);

    if (Math.random() < 0.24) {
      spawnPickup(enemy.x, enemy.y);
    }

    return true;
  }

  return false;
}

function spawnPickup(x = W + 20, y = rand(75, H - 75)) {
  const types = ["gem", "heal", "power", "special"];
  const weights = [0.45, 0.18, 0.25, 0.12];
  let r = Math.random();
  let type = "gem";

  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) {
      type = types[i];
      break;
    }
  }

  pickups.push({
    x, y,
    type,
    r: 12,
    phase: rand(0, 6.28),
    speed: 105
  });
}

function collectPickup(p) {
  spawnParticles(p.x, p.y, "#ffe1a0", 12);

  if (p.type === "gem") {
    gems++;
    score += 50;
    showNotice("✦ GEM COLLECTED +50");
  } else if (p.type === "heal") {
    lives = Math.min(3, lives + 1);
    score += 25;
    showNotice("♥ LIFE RESTORED");
  } else if (p.type === "power") {
    player.power = 9;
    showNotice("✧ STARSHOT POWER!");
  } else {
    specialCharges = Math.min(2, specialCharges + 1);
    showNotice("✦ SPECIAL CHARGED");
  }
}

function useSpecial() {
  if (!running || paused || gameOver) return;

  if (specialCharges <= 0) {
    showNotice("NO SPECIAL CHARGES!");
    return;
  }

  specialCharges--;
  screenShake = 0.45;

  spawnParticles(player.x + 50, player.y, "#ffda83", 35);

  // A screen-clearing magical star blast.
  for (let i = enemies.length - 1; i >= 0; i--) {
    score += 20;
    spawnParticles(enemies[i].x, enemies[i].y, "#ffb7f8", 8);
  }

  enemies.length = 0;
  enemyBullets.length = 0;

  for (let i = bullets.length - 1; i >= 0; i--) {
    if (boss) boss.hp -= 8;
  }

  if (boss) {
    boss.hp -= 24;
    if (boss.hp <= 0) defeatBoss();
  }

  showNotice("✦ CELESTIAL NOVA!");
  updateHUD();
}

function useShield() {
  if (!running || paused || gameOver) return;

  shieldTime = Math.max(shieldTime, 3);
  player.invincible = Math.max(player.invincible, 3);
  showNotice("◈ SHIELD ACTIVATED");
  spawnParticles(player.x, player.y, "#78eaff", 14);
}

function defeatBoss() {
  if (!boss) return;

  spawnParticles(boss.x, boss.y, "#ff8b58", 60);
  score += 1000;
  boss = null;
  enemyBullets.length = 0;
  showNotice("★ VOID DRAGON DEFEATED! +1000");
  screenShake = 0.6;
  nextBossTime = elapsed + 30;
  lastBossTime = elapsed;

  if (kills >= 8 && gems >= 10) {
    setTimeout(() => {
      if (gameOver) return;
      endGame(true);
    }, 900);
  }
}

function hitPlayer() {
  if (player.invincible > 0 || shieldTime > 0) return;

  lives--;
  player.invincible = 1.8;
  damageFlash = 0.3;
  screenShake = 0.3;
  spawnParticles(player.x, player.y, "#ff9bdc", 20);
  updateHUD();

  if (lives <= 0) {
    endGame(false);
  }
}

function update(dt) {
  elapsed += dt;

  player.invincible = Math.max(0, player.invincible - dt);
  player.power = Math.max(0, player.power - dt);
  shieldTime = Math.max(0, shieldTime - dt);
  damageFlash = Math.max(0, damageFlash - dt);
  screenShake = Math.max(0, screenShake - dt);

  if (noticeTimer > 0) {
    noticeTimer -= dt;
    if (noticeTimer <= 0) ui.notice.classList.remove("show");
  }

  // Joystick movement.
  player.x += input.x * player.speed * dt;
  player.y += input.y * player.speed * dt;

  player.x = clamp(player.x, 25, W - 25);
  player.y = clamp(player.y, 55, H - 40);

  // Automatic starshot.
  shootTimer -= dt;
  if (shootTimer <= 0) {
    firePlayerBullet();
    shootTimer = player.power > 0 ? 0.15 : 0.29;
  }

  // Enemy waves.
  spawnTimer -= dt;
  if (spawnTimer <= 0 && !boss) {
    spawnEnemy();
    spawnTimer = Math.max(0.42, 1.05 - elapsed * 0.008);
  }

  // Periodic boss arrival.
  if (!boss && elapsed >= nextBossTime) {
    spawnBoss();
  }

  // Background stars.
  for (const s of stars) {
    s.x -= s.speed * dt;
    s.phase += dt * 2;
    if (s.x < -3) {
      s.x = W + 3;
      s.y = Math.random() * H;
    }
  }

  // Player bullets.
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;

    if (b.x > W + 30 || b.y < -20 || b.y > H + 20) {
      bullets.splice(i, 1);
    }
  }

  // Enemy behavior.
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    e.x -= e.speed * dt;
    e.y += Math.sin(elapsed * 2.2 + e.phase) * 38 * dt;
    e.y = clamp(e.y, 45, H - 35);
    e.fire -= dt;

    if (e.shooter && e.fire <= 0 && e.x < W - 30) {
      fireEnemyBullet(e.x, e.y);
      e.fire = rand(1.6, 2.8);
    }

    if (e.x < -55) {
      enemies.splice(i, 1);
      continue;
    }

    if (Math.hypot(player.x - e.x, player.y - e.y) < player.radius + e.r * 0.65) {
      hitPlayer();
      enemies.splice(i, 1);
    }
  }

  // Boss movement and attacks.
  if (boss) {
    boss.phase += dt;
    boss.y = H * 0.5 + Math.sin(boss.phase * 1.5) * H * 0.22;

    if (!boss.entered) {
      boss.x -= 180 * dt;
      if (boss.x <= W * 0.79) boss.entered = true;
    }

    boss.fire -= dt;

    if (boss.fire <= 0) {
      fireEnemyBullet(boss.x - 35, boss.y - 22, 220);
      fireEnemyBullet(boss.x - 35, boss.y + 22, 220);
      fireEnemyBullet(boss.x - 35, boss.y, 170);
      boss.fire = 1.15;
    }

    if (Math.hypot(player.x - boss.x, player.y - boss.y) < player.radius + boss.r * 0.7) {
      hitPlayer();
    }
  }

  // Enemy bullets.
  for (let i = enemyBullets.length - 1; i >= 0; i--) {
    const b = enemyBullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;

    if (Math.hypot(player.x - b.x, player.y - b.y) < player.radius + b.r) {
      hitPlayer();
      enemyBullets.splice(i, 1);
      continue;
    }

    if (b.x < -30 || b.x > W + 30 || b.y < -30 || b.y > H + 30) {
      enemyBullets.splice(i, 1);
    }
  }

  // Bullet-to-enemy collisions.
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    let destroyed = false;

    for (let j = bullets.length - 1; j >= 0; j--) {
      const b = bullets[j];

      if (Math.hypot(b.x - e.x, b.y - e.y) < e.r + b.r) {
        bullets.splice(j, 1);
        destroyed = damageEnemy(e, b.damage);
        if (destroyed) break;
      }
    }

    if (destroyed) enemies.splice(i, 1);
  }

  // Bullet-to-boss collisions.
  if (boss) {
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];

      if (Math.hypot(b.x - boss.x, b.y - boss.y) < boss.r + b.r) {
        boss.hp -= b.damage;
        bullets.splice(i, 1);
        spawnParticles(b.x, b.y, "#ffc5a0", 3);

        if (boss.hp <= 0) {
          defeatBoss();
          break;
        }
      }
    }
  }

  // Power-ups.
  powerTimer -= dt;

  if (powerTimer <= 0) {
    spawnPickup();
    powerTimer = rand(7, 11);
  }

  for (let i = pickups.length - 1; i >= 0; i--) {
    const p = pickups[i];
    p.x -= p.speed * dt;
    p.phase += dt * 3;
    p.y += Math.sin(p.phase) * 15 * dt;

    if (Math.hypot(player.x - p.x, player.y - p.y) < player.radius + p.r) {
      collectPickup(p);
      pickups.splice(i, 1);
      continue;
    }

    if (p.x < -30) pickups.splice(i, 1);
  }

  // Particle effects.
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= Math.pow(0.04, dt);
    p.vy *= Math.pow(0.04, dt);
    p.life -= dt;

    if (p.life <= 0) particles.splice(i, 1);
  }

  updateHUD();
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, W, H);
  gradient.addColorStop(0, "#090d3d");
  gradient.addColorStop(0.48, "#173d91");
  gradient.addColorStop(1, "#090d35");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, W, H);

  const glow = ctx.createRadialGradient(W * 0.35, H * 0.48, 5, W * 0.35, H * 0.48, W * 0.6);
  glow.addColorStop(0, "#6544ce44");
  glow.addColorStop(1, "#1428a000");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  for (const s of stars) {
    const alpha = s.alpha * (0.7 + Math.sin(s.phase) * 0.3);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "#d8eaff";
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
    ctx.fill();

    if (s.size > 1.6) {
      ctx.strokeStyle = "#a9d9ff";
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(s.x - 4, s.y);
      ctx.lineTo(s.x + 4, s.y);
      ctx.moveTo(s.x, s.y - 4);
      ctx.lineTo(s.x, s.y + 4);
      ctx.stroke();
    }
  }

  ctx.globalAlpha = 1;

  // Nebula streaks.
  for (let i = 0; i < 5; i++) {
    const y = H * (0.15 + i * 0.18);
    ctx.strokeStyle = i % 2 ? "#678dff15" : "#db9aff18";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y + Math.sin(elapsed + i) * 12);
    ctx.lineTo(W, y - 20);
    ctx.stroke();
  }
}

function drawPlayer() {
  if (player.invincible > 0 && Math.floor(elapsed * 12) % 2 === 0) return;

  ctx.save();
  ctx.translate(player.x, player.y);

  // Flying magical trail.
  ctx.shadowBlur = 22;
  ctx.shadowColor = "#69eaff";
  const trail = ctx.createLinearGradient(-65, 0, 12, 0);
  trail.addColorStop(0, "#69bfff00");
  trail.addColorStop(1, "#73eaffbb");
  ctx.fillStyle = trail;
  ctx.beginPath();
  ctx.moveTo(-58, -5);
  ctx.lineTo(-12, -10);
  ctx.lineTo(15, 0);
  ctx.lineTo(-12, 10);
  ctx.lineTo(-58, 5);
  ctx.fill();

  ctx.shadowBlur = 12;
  ctx.shadowColor = "#ff91e9";

  // Magical flying board.
  ctx.fillStyle = "#d9b7ff";
  ctx.beginPath();
  ctx.moveTo(-33, 11);
  ctx.lineTo(2, 16);
  ctx.lineTo(37, 8);
  ctx.lineTo(10, 22);
  ctx.lineTo(-27, 18);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#ffdc93";
  ctx.beginPath();
  ctx.moveTo(-29, 8);
  ctx.lineTo(25, 5);
  ctx.lineTo(43, 2);
  ctx.lineTo(5, 13);
  ctx.lineTo(-27, 13);
  ctx.closePath();
  ctx.fill();

  // Hair flowing behind.
  ctx.fillStyle = "#ff86d9";
  ctx.beginPath();
  ctx.moveTo(-7, -15);
  ctx.quadraticCurveTo(-32, -35, -38, -17);
  ctx.quadraticCurveTo(-25, -8, -30, 0);
  ctx.quadraticCurveTo(-10, -4, 1, 4);
  ctx.fill();

  ctx.fillStyle = "#79e9ff";
  ctx.beginPath();
  ctx.moveTo(-9, -10);
  ctx.quadraticCurveTo(-31, -23, -37, -9);
  ctx.quadraticCurveTo(-21, -4, -26, 4);
  ctx.quadraticCurveTo(-9, -2, 5, 5);
  ctx.fill();

  // Body and costume.
  ctx.fillStyle = "#fff0fb";
  ctx.beginPath();
  ctx.moveTo(-12, -8);
  ctx.lineTo(1, -16);
  ctx.lineTo(12, -4);
  ctx.lineTo(6, 10);
  ctx.lineTo(-10, 8);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#d18aff";
  ctx.beginPath();
  ctx.moveTo(-10, 1);
  ctx.lineTo(7, 0);
  ctx.lineTo(14, 9);
  ctx.lineTo(-5, 11);
  ctx.closePath();
  ctx.fill();

  // Face.
  ctx.fillStyle = "#ffd7d8";
  ctx.beginPath();
  ctx.ellipse(4, -13, 9, 10, 0.15, 0, Math.PI * 2);
  ctx.fill();

  // Large anime eyes.
  ctx.fillStyle = "#a747d8";
  ctx.beginPath();
  ctx.ellipse(8, -13, 2.2, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(8.5, -14.5, 0.9, 0, Math.PI * 2);
  ctx.fill();

  // Crown.
  ctx.fillStyle = "#ffe6a0";
  ctx.beginPath();
  ctx.moveTo(-4, -21);
  ctx.lineTo(-9, -30);
  ctx.lineTo(0, -24);
  ctx.lineTo(5, -32);
  ctx.lineTo(9, -23);
  ctx.lineTo(15, -27);
  ctx.lineTo(12, -17);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#ff80df";
  ctx.beginPath();
  ctx.arc(4, -23, 3, 0, Math.PI * 2);
  ctx.fill();

  // Shield aura.
  if (shieldTime > 0) {
    ctx.strokeStyle = "#78f4ff";
    ctx.lineWidth = 2.5;
    ctx.shadowColor = "#78f4ff";
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.ellipse(0, 0, 38, 34, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

function drawEnemy(e) {
  ctx.save();
  ctx.translate(e.x, e.y);

  ctx.shadowBlur = 16;
  ctx.shadowColor = e.heavy ? "#ff733c" : "#7e72ff";

  // Rear thruster.
  ctx.fillStyle = e.heavy ? "#ff6d29" : "#5a6fff";
  ctx.beginPath();
  ctx.moveTo(13, -5);
  ctx.lineTo(31 + Math.sin(elapsed * 18) * 4, 0);
  ctx.lineTo(13, 5);
  ctx.fill();

  const grad = ctx.createLinearGradient(-18, -14, 20, 12);
  grad.addColorStop(0, e.heavy ? "#ffac60" : "#8fbbff");
  grad.addColorStop(0.4, e.heavy ? "#5b2940" : "#292d63");
  grad.addColorStop(1, "#11162f");

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(-24, 0);
  ctx.lineTo(-7, -e.r * 0.65);
  ctx.lineTo(8, -e.r * 0.8);
  ctx.lineTo(19, -6);
  ctx.lineTo(26, 0);
  ctx.lineTo(14, 7);
  ctx.lineTo(2, e.r * 0.55);
  ctx.lineTo(-9, e.r * 0.7);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = e.heavy ? "#ff8c4e" : "#76dcff";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = e.heavy ? "#ffbb4d" : "#7ff4ff";
  ctx.beginPath();
  ctx.moveTo(-14, -3);
  ctx.lineTo(6, 0);
  ctx.lineTo(-14, 3);
  ctx.closePath();
  ctx.fill();

  if (e.hp < e.maxHp) {
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#11152c";
    ctx.fillRect(-16, -e.r - 9, 32, 3);
    ctx.fillStyle = "#7cffb0";
    ctx.fillRect(-16, -e.r - 9, 32 * e.hp / e.maxHp, 3);
  }

  ctx.restore();
}

function drawBoss() {
  if (!boss) return;

  ctx.save();
  ctx.translate(boss.x, boss.y);

  ctx.shadowBlur = 30;
  ctx.shadowColor = "#ff632e";

  // Large blazing tail.
  ctx.fillStyle = "#ff5e24";
  ctx.beginPath();
  ctx.moveTo(15, -35);
  ctx.lineTo(80, -58 + Math.sin(elapsed * 8) * 8);
  ctx.lineTo(43, -12);
  ctx.lineTo(89, 0);
  ctx.lineTo(35, 17);
  ctx.lineTo(73, 53);
  ctx.lineTo(12, 35);
  ctx.closePath();
  ctx.fill();

  // Armored body.
  const grad = ctx.createLinearGradient(-40, -60, 55, 55);
  grad.addColorStop(0, "#ffb46d");
  grad.addColorStop(0.25, "#63364b");
  grad.addColorStop(0.55, "#24253e");
  grad.addColorStop(1, "#090e2b");

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(-48, -12);
  ctx.lineTo(-20, -55);
  ctx.lineTo(8, -45);
  ctx.lineTo(31, -59);
  ctx.lineTo(44, -25);
  ctx.lineTo(58, 0);
  ctx.lineTo(42, 24);
  ctx.lineTo(28, 54);
  ctx.lineTo(1, 43);
  ctx.lineTo(-26, 57);
  ctx.lineTo(-38, 24);
  ctx.lineTo(-56, 13);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "#ff934d";
  ctx.lineWidth = 3;
  ctx.stroke();

  // Horns.
  ctx.fillStyle = "#ff8b39";
  ctx.beginPath();
  ctx.moveTo(-24, -40);
  ctx.lineTo(-46, -78);
  ctx.lineTo(-11, -51);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(-24, 40);
  ctx.lineTo(-45, 77);
  ctx.lineTo(-10, 52);
  ctx.closePath();
  ctx.fill();

  // Dragon eye.
  ctx.shadowColor = "#ffda59";
  ctx.shadowBlur = 22;
  ctx.fillStyle = "#ffec83";
  ctx.beginPath();
  ctx.ellipse(-25, -5, 12, 5, -0.25, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ff4b22";
  ctx.beginPath();
  ctx.ellipse(-27, -5, 4, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Crystal armor.
  ctx.fillStyle = "#9a7aff";
  ctx.beginPath();
  ctx.moveTo(10, -27);
  ctx.lineTo(31, -14);
  ctx.lineTo(21, 4);
  ctx.lineTo(3, -7);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#79ecff";
  ctx.beginPath();
  ctx.moveTo(17, 13);
  ctx.lineTo(38, 5);
  ctx.lineTo(29, 25);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawBullet(b, enemy = false) {
  ctx.save();
  ctx.fillStyle = b.color;
  ctx.shadowColor = b.color;
  ctx.shadowBlur = enemy ? 16 : 12;

  ctx.beginPath();
  ctx.ellipse(b.x, b.y, enemy ? 8 : 12, enemy ? 4 : 3, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawPickup(p) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(Math.sin(p.phase) * 0.3);
  ctx.shadowBlur = 18;

  const colors = {
    gem: "#f7bfff",
    heal: "#ff8fc6",
    power: "#ffdb69",
    special: "#85f6ff"
  };

  const symbols = {
    gem: "◆",
    heal: "♥",
    power: "✦",
    special: "✧"
  };

  ctx.shadowColor = colors[p.type];
  ctx.fillStyle = colors[p.type];
  ctx.beginPath();
  ctx.moveTo(0, -p.r);
  ctx.lineTo(p.r * 0.8, 0);
  ctx.lineTo(0, p.r);
  ctx.lineTo(-p.r * 0.8, 0);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 13px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(symbols[p.type], 0, 0);

  ctx.restore();
}

function drawParticles() {
  for (const p of particles) {
    ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
    ctx.fillStyle = p.color;
    ctx.shadowBlur = 8;
    ctx.shadowColor = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
}

function draw() {
  ctx.save();

  if (screenShake > 0) {
    ctx.translate(rand(-5, 5) * screenShake * 3, rand(-4, 4) * screenShake * 3);
  }

  drawBackground();

  for (const p of pickups) drawPickup(p);
  for (const b of bullets) drawBullet(b);
  for (const b of enemyBullets) drawBullet(b, true);
  for (const e of enemies) drawEnemy(e);

  drawBoss();
  drawPlayer();
  drawParticles();

  if (damageFlash > 0) {
    ctx.fillStyle = `rgba(255,40,80,${damageFlash * 0.5})`;
    ctx.fillRect(0, 0, W, H);
  }

  ctx.restore();
}

function loop(timestamp) {
  if (!running || paused) return;

  const dt = Math.min((timestamp - lastTime) / 1000, 0.035);
  lastTime = timestamp;

  update(dt);
  draw();

  if (running) requestAnimationFrame(loop);
}

// Virtual joystick.
let joyPointer = null;

function moveJoystick(event) {
  const rect = ui.joystick.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const max = rect.width * 0.31;

  const dx = event.clientX - cx;
  const dy = event.clientY - cy;
  const distance = Math.hypot(dx, dy);
  const scale = distance > max ? max / distance : 1;

  const x = dx * scale;
  const y = dy * scale;

  input.x = clamp(x / max, -1, 1);
  input.y = clamp(y / max, -1, 1);

  ui.knob.style.left = `calc(50% + ${x}px)`;
  ui.knob.style.top = `calc(50% + ${y}px)`;
}

function resetJoystick() {
  input.x = 0;
  input.y = 0;
  input.active = false;
  joyPointer = null;
  ui.knob.style.left = "50%";
  ui.knob.style.top = "50%";
}

ui.joystick.addEventListener("pointerdown", event => {
  if (!running || paused) return;
  event.preventDefault();
  joyPointer = event.pointerId;
  input.active = true;
  ui.joystick.setPointerCapture(event.pointerId);
  moveJoystick(event);
});

ui.joystick.addEventListener("pointermove", event => {
  if (joyPointer !== event.pointerId) return;
  event.preventDefault();
  moveJoystick(event);
});

ui.joystick.addEventListener("pointerup", event => {
  if (joyPointer === event.pointerId) resetJoystick();
});

ui.joystick.addEventListener("pointercancel", resetJoystick);
ui.joystick.addEventListener("lostpointercapture", resetJoystick);

// Keyboard support for desktop.
const keys = new Set();

window.addEventListener("keydown", event => {
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(event.key)) {
    event.preventDefault();
  }

  keys.add(event.key.toLowerCase());

  if (event.key === " " && running) useSpecial();
  if (event.key.toLowerCase() === "e" && running) useShield();
});

window.addEventListener("keyup", event => {
  keys.delete(event.key.toLowerCase());
});

function updateKeyboard() {
  if (joyPointer !== null) return;

  input.x = (keys.has("arrowright") || keys.has("d") ? 1 : 0) -
            (keys.has("arrowleft") || keys.has("a") ? 1 : 0);
  input.y = (keys.has("arrowdown") || keys.has("s") ? 1 : 0) -
            (keys.has("arrowup") || keys.has("w") ? 1 : 0);

  const length = Math.hypot(input.x, input.y);
  if (length > 1) {
    input.x /= length;
    input.y /= length;
  }
}

const originalUpdate = update;
update = function(dt) {
  updateKeyboard();
  originalUpdate(dt);
};

ui.start.addEventListener("click", startGame);
ui.pause.addEventListener("click", () => {
  if (paused) resumeGame();
  else pauseGame();
});
ui.resume.addEventListener("click", resumeGame);
ui.restart.addEventListener("click", startGame);
ui.special.addEventListener("pointerdown", event => {
  event.preventDefault();
  useSpecial();
});
ui.shield.addEventListener("pointerdown", event => {
  event.preventDefault();
  useShield();
});

window.addEventListener("resize", resize);
window.addEventListener("contextmenu", event => event.preventDefault());

resize();
resetGame();
draw();
