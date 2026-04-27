/* ═══════════════════════════════════════════════
   NOVA 777 — Slot Engine v4  (engine.js)
   ═══════════════════════════════════════════════ */

/* ─────────────────────────────────────────────
   AUDIO ENGINE — Real casino-style sounds
   Using Web Audio API oscillators + noise
   ───────────────────────────────────────────── */
const AUDIO = (() => {
  let ctx = null;

  function ac() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function osc(freq, type, start, dur, vol, detune = 0) {
    try {
      const a = ac();
      const o = a.createOscillator();
      const g = a.createGain();
      o.connect(g); g.connect(a.destination);
      o.type = type;
      o.frequency.value = freq;
      if (detune) o.detune.value = detune;
      g.gain.setValueAtTime(0, a.currentTime + start);
      g.gain.linearRampToValueAtTime(vol, a.currentTime + start + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + start + dur);
      o.start(a.currentTime + start);
      o.stop(a.currentTime + start + dur + 0.01);
    } catch (e) {}
  }

  // White noise burst (for reel tick)
  function noise(start, dur, vol) {
    try {
      const a = ac();
      const buf = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1);
      const src = a.createBufferSource();
      src.buffer = buf;
      const g = a.createGain();
      const filt = a.createBiquadFilter();
      filt.type = 'bandpass';
      filt.frequency.value = 800;
      filt.Q.value = 0.5;
      src.connect(filt); filt.connect(g); g.connect(a.destination);
      g.gain.setValueAtTime(vol, a.currentTime + start);
      g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + start + dur);
      src.start(a.currentTime + start);
      src.stop(a.currentTime + start + dur + 0.01);
    } catch(e) {}
  }

  return {
    unlock() { try { ac(); } catch(e) {} },

    // Mechanical reel spin tick — played rapidly during spin
    tick(col) {
      const t = col * 0.02;
      noise(t, 0.025, 0.18);
      osc(180 + col * 15, 'sawtooth', t, 0.03, 0.06);
    },

    // Heavy thud when a reel stops
    reelStop(col) {
      const t = 0;
      osc(90,  'sine',    t,      0.12, 0.35);
      osc(140, 'sine',    t,      0.08, 0.2);
      osc(60,  'sine',    t+0.04, 0.10, 0.25);
      noise(t, 0.06, 0.3);
    },

    // Coin jingle — small win
    coinJingle() {
      [1047, 1319, 1568, 2093].forEach((f, i) => {
        osc(f, 'sine', i * 0.07, 0.15, 0.18);
        osc(f * 1.5, 'triangle', i * 0.07 + 0.03, 0.1, 0.08);
      });
    },

    // Big win fanfare — ascending triumphant
    bigWin() {
      const melody = [523, 659, 784, 1047, 784, 1047, 1319, 1568];
      melody.forEach((f, i) => {
        osc(f,     'sine',     i * 0.09, 0.2,  0.25);
        osc(f * 2, 'triangle', i * 0.09, 0.12, 0.12);
        osc(f / 2, 'sine',     i * 0.09, 0.08, 0.18);
      });
    },

    // Mega win — full orchestra hit
    megaWin() {
      [262, 330, 392, 523, 659, 784, 1047, 1319].forEach((f, i) => {
        osc(f,     'sine',     i * 0.06, 0.3,  0.4);
        osc(f * 2, 'square',   i * 0.06, 0.08, 0.15);
        osc(f * 3, 'triangle', i * 0.06, 0.06, 0.12);
      });
      noise(0, 0.3, 0.15);
    },

    // Free spins trigger — magical ascending arp
    freeSpins() {
      [392, 494, 587, 740, 880, 1109, 1319, 1760].forEach((f, i) => {
        osc(f,     'sine',     i * 0.1,  0.25, 0.22);
        osc(f * 2, 'triangle', i * 0.1 + 0.05, 0.12, 0.1);
      });
    },

    // Bonus trigger — exciting fanfare
    bonus() {
      [330, 415, 523, 622, 784, 988, 1175].forEach((f, i) => {
        osc(f,     'sine',     i * 0.08, 0.22, 0.24);
        osc(f * 1.5,'triangle',i * 0.08, 0.1,  0.1);
      });
      noise(0.3, 0.15, 0.12);
    },

    // UI click
    click() {
      osc(800, 'sine', 0, 0.04, 0.12);
      osc(1000,'sine', 0.01, 0.03, 0.07);
    },

    // Spin button press — whirring start
    spinPress() {
      // Rising sweep
      try {
        const a = ac();
        const o = a.createOscillator();
        const g = a.createGain();
        o.connect(g); g.connect(a.destination);
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(80, a.currentTime);
        o.frequency.exponentialRampToValueAtTime(200, a.currentTime + 0.3);
        g.gain.setValueAtTime(0.12, a.currentTime);
        g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + 0.35);
        o.start(a.currentTime);
        o.stop(a.currentTime + 0.4);
      } catch(e) {}
      noise(0, 0.1, 0.1);
    },

    // Gamble win
    gambleWin() {
      [523, 659, 784, 1047, 1319].forEach((f,i) => osc(f,'sine',i*0.08,0.18,0.2));
    },
    gambleLose() {
      [300, 250, 200].forEach((f,i) => osc(f,'sawtooth',i*0.1,0.15,0.18));
    }
  };
})();

window.AUDIO = AUDIO;

/* ─────────────────────────────────────────────
   REEL ENGINE — bulletproof time-based spin
   ───────────────────────────────────────────── */
class SlotEngine {
  constructor(canvas, cfg) {
    this.cv   = canvas;
    this.ctx  = canvas.getContext('2d');
    this.ROWS = cfg.rows || 3;
    this.COLS = cfg.cols || 5;
    this.syms = cfg.symbols;
    this.lines= cfg.paylines;
    this.theme= cfg.theme || {};
    this.onDone = null; // callback when all reels stopped

    // STRIP: big circular belt of symbols per reel
    this.STRIP = 40;
    this.strips = Array.from({length: this.COLS}, () =>
      Array.from({length: this.STRIP}, () => this._rnd())
    );

    // Static display grid (shown when not spinning)
    this.grid = Array.from({length: this.COLS}, () =>
      Array.from({length: this.ROWS}, () => this._rnd())
    );

    // Per-reel state — simple and clean
    // offset: how many pixels we've scrolled (0 = top of strip[0] at top)
    this.reels = Array.from({length: this.COLS}, () => ({
      offset:    0,    // current scroll px
      target:    0,    // target scroll px to land on
      spinning:  false,
      startTime: 0,
      duration:  0,
      stopped:   true,
    }));

    this.winCells = new Set();
    this.winLines = [];
    this.flashT   = 0;
    this.spinning = false;

    // Tick sound interval handles
    this._tickIntervals = [];

    this._resize();
    window.addEventListener('resize', () => this._resize());
    this._rafLoop();
  }

  _resize() {
    this.CW  = this.cv.offsetWidth  || 800;
    this.CH  = Math.round(this.CW * this.ROWS / this.COLS);
    this.cv.width  = this.CW;
    this.cv.height = this.CH;
    this.cw  = this.CW / this.COLS;  // cell width
    this.ch  = this.CH / this.ROWS;  // cell height
  }

  _rnd() {
    const tot = this.syms.reduce((a, s) => a + s.w, 0);
    let r = Math.random() * tot;
    for (const s of this.syms) { r -= s.w; if (r <= 0) return s; }
    return this.syms[0];
  }

  /*
    spin(result, delays)
      result[col][row] = symbol to show when stopped
      delays[col] = ms from now when this reel should FINISH (not start decelerating)
  */
  spin(result, delays) {
    if (this.spinning) return;
    this.spinning  = true;
    this.winCells.clear();
    this.winLines  = [];
    this.flashT    = 0;
    const now      = performance.now();

    // Stop all tick intervals
    this._tickIntervals.forEach(clearInterval);
    this._tickIntervals = [];

    for (let c = 0; c < this.COLS; c++) {
      const r = this.reels[c];

      // Build new strip with result at the END
      // Strip layout: [random × (STRIP-ROWS)] [result[0]] [result[1]] [result[2]]
      for (let i = 0; i < this.STRIP - this.ROWS; i++) {
        this.strips[c][i] = this._rnd();
      }
      for (let row = 0; row < this.ROWS; row++) {
        this.strips[c][this.STRIP - this.ROWS + row] = result[c][row];
      }

      // Target = exactly at (STRIP - ROWS) * ch so result is perfectly visible
      // We add N full loops to ensure enough travel
      const LOOPS    = 4;
      const landIdx  = this.STRIP - this.ROWS;
      const target   = LOOPS * this.STRIP * this.ch + landIdx * this.ch;

      r.offset   = 0;
      r.target   = target;
      r.spinning = true;
      r.stopped  = false;
      r.startTime= now;
      r.duration = delays[c]; // this reel finishes at now + delays[c]

      // Tick sound loop for this reel
      const iv = setInterval(() => {
        if (r.stopped) { clearInterval(iv); return; }
        AUDIO.tick(c);
      }, 55 + c * 8);
      this._tickIntervals.push(iv);
    }
  }

  _easeOutBounce(t) {
    // Slight bounce/overshoot at end — feels like a real reel snapping
    const n1 = 7.5625, d1 = 2.75;
    if (t < 1 / d1)       return n1 * t * t;
    if (t < 2 / d1)       return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1)     return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  }

  _easeInOut(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  _rafLoop() {
    const now      = performance.now();
    let anyMoving  = false;
    let justStopped= [];

    for (let c = 0; c < this.COLS; c++) {
      const r = this.reels[c];
      if (r.stopped) continue;
      anyMoving = true;

      const elapsed  = now - r.startTime;
      const progress = Math.min(elapsed / r.duration, 1);

      // Motion curve:
      // 0-10%:  ease in (accelerate)
      // 10-80%: constant fast (linear)
      // 80-100%: ease out (decelerate + tiny bounce)
      let eased;
      if (progress < 0.10) {
        const t = progress / 0.10;
        eased = t * t * t * 0.10;                        // ease in
      } else if (progress < 0.80) {
        eased = 0.10 + (progress - 0.10) * (0.80 / 0.70); // linear fast
      } else {
        const t = (progress - 0.80) / 0.20;
        eased = 0.90 + this._easeOutBounce(t) * 0.10;    // ease out
      }

      r.offset = eased * r.target;

      if (progress >= 1) {
        r.offset  = r.target; // snap exact
        r.stopped = true;
        r.spinning= false;
        // Snap grid from strip
        const landIdx = this.STRIP - this.ROWS;
        for (let row = 0; row < this.ROWS; row++) {
          this.grid[c][row] = this.strips[c][landIdx + row];
        }
        justStopped.push(c);
      }
    }

    // Fire stop sounds staggered
    justStopped.forEach(c => AUDIO.reelStop(c));

    // All done?
    if (this.spinning && this.reels.every(r => r.stopped)) {
      this.spinning = false;
      if (this.onDone) this.onDone();
    }

    this._draw();
    requestAnimationFrame(() => this._rafLoop());
  }

  _draw() {
    const { ctx, CW, CH, cw, ch } = this;
    const th = this.theme;
    if (!cw || !ch) return;

    // ── Background ──
    const bg = ctx.createLinearGradient(0, 0, 0, CH);
    bg.addColorStop(0, th.bg0 || '#1a0508');
    bg.addColorStop(1, th.bg1 || '#0a0204');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, CW, CH);

    // Custom bg hook
    if (this.drawBg) this.drawBg(ctx, CW, CH);

    // ── Reels ──
    for (let c = 0; c < this.COLS; c++) {
      const r  = this.reels[c];
      const rx = c * cw;

      ctx.save();
      ctx.beginPath();
      ctx.rect(rx + 1, 1, cw - 2, CH - 2);
      ctx.clip();

      // Reel bg
      const rbg = ctx.createLinearGradient(rx, 0, rx + cw, 0);
      rbg.addColorStop(0,   'rgba(0,0,0,.25)');
      rbg.addColorStop(0.5, 'rgba(255,255,255,.015)');
      rbg.addColorStop(1,   'rgba(0,0,0,.25)');
      ctx.fillStyle = rbg;
      ctx.fillRect(rx, 0, cw, CH);

      if (!r.stopped) {
        // Spinning — draw scrolling symbols
        const scrollPx = r.offset % (this.STRIP * ch);
        const topIdx   = Math.floor(scrollPx / ch);
        const offsetY  = scrollPx % ch;

        for (let row = -1; row <= this.ROWS + 1; row++) {
          const sy = row * ch - offsetY;
          if (sy > CH + ch || sy < -ch * 1.5) continue;
          const si = ((topIdx + row) % this.STRIP + this.STRIP) % this.STRIP;
          this._cell(ctx, this.strips[c][si], rx, sy, cw, ch, false, c);
        }

        // Motion blur overlay
        const blur = ctx.createLinearGradient(0, 0, 0, CH);
        blur.addColorStop(0,   'rgba(0,0,0,.15)');
        blur.addColorStop(0.5, 'rgba(0,0,0,0)');
        blur.addColorStop(1,   'rgba(0,0,0,.15)');
        ctx.fillStyle = blur;
        ctx.fillRect(rx, 0, cw, CH);
      } else {
        // Stopped
        for (let row = 0; row < this.ROWS; row++) {
          const sym    = this.grid[c][row];
          const isWin  = this.winCells.has(`${c},${row}`);
          const flash  = isWin && (this.flashT % 30 < 15);
          this._cell(ctx, sym, rx, row * ch, cw, ch, flash, c);
        }
      }

      ctx.restore();
    }

    // Flash counter
    if (!this.spinning && this.winCells.size > 0) this.flashT++;

    // ── Reel separators (fancy gold lines) ──
    for (let c = 0; c <= this.COLS; c++) {
      const x = c * cw;
      const grd = ctx.createLinearGradient(0, 0, 0, CH);
      grd.addColorStop(0,   'rgba(212,168,67,.05)');
      grd.addColorStop(0.3, 'rgba(212,168,67,.18)');
      grd.addColorStop(0.7, 'rgba(212,168,67,.18)');
      grd.addColorStop(1,   'rgba(212,168,67,.05)');
      ctx.strokeStyle = grd;
      ctx.lineWidth   = 1;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CH); ctx.stroke();
    }
    for (let r = 0; r <= this.ROWS; r++) {
      const y = r * ch;
      const grd = ctx.createLinearGradient(0, 0, CW, 0);
      grd.addColorStop(0,   'rgba(212,168,67,.05)');
      grd.addColorStop(0.15,'rgba(212,168,67,.18)');
      grd.addColorStop(0.85,'rgba(212,168,67,.18)');
      grd.addColorStop(1,   'rgba(212,168,67,.05)');
      ctx.strokeStyle = grd;
      ctx.lineWidth   = 1;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CW, y); ctx.stroke();
    }

    // ── Win paylines ──
    if (!this.spinning && this.winLines.length && this.flashT % 30 < 15) {
      this.winLines.forEach(li => {
        const line = this.lines[li];
        ctx.save();
        ctx.beginPath();
        line.forEach((row, col) => {
          const px = col * cw + cw / 2;
          const py = row * ch + ch / 2;
          col === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        });
        ctx.strokeStyle = th.winLine || 'rgba(255,220,60,.75)';
        ctx.lineWidth   = 3;
        ctx.shadowColor = th.winLine || 'rgba(255,220,60,.8)';
        ctx.shadowBlur  = 12;
        ctx.setLineDash([10, 6]);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      });
    }

    // ── Center payline highlight strip ──
    const midY = CH / 2;
    const ph   = ctx.createLinearGradient(0, midY - 2, 0, midY + 2);
    ph.addColorStop(0,   'rgba(255,215,60,.0)');
    ph.addColorStop(0.5, 'rgba(255,215,60,.08)');
    ph.addColorStop(1,   'rgba(255,215,60,.0)');
    ctx.fillStyle = ph;
    ctx.fillRect(0, midY - 1, CW, 3);

    // ── Top & bottom vignette ──
    const vOH = ch * 0.65;
    const vT  = ctx.createLinearGradient(0, 0, 0, vOH);
    vT.addColorStop(0, th.vignette || 'rgba(10,3,5,.88)');
    vT.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = vT; ctx.fillRect(0, 0, CW, vOH);

    const vB = ctx.createLinearGradient(0, CH - vOH, 0, CH);
    vB.addColorStop(0, 'rgba(0,0,0,0)');
    vB.addColorStop(1, th.vignette || 'rgba(10,3,5,.88)');
    ctx.fillStyle = vB; ctx.fillRect(0, CH - vOH, CW, vOH);

    // ── Outer frame glow ──
    ctx.save();
    ctx.strokeStyle = th.frameGlow || 'rgba(212,168,67,.25)';
    ctx.lineWidth   = 2;
    ctx.shadowColor = th.frameGlow || 'rgba(212,168,67,.3)';
    ctx.shadowBlur  = 8;
    ctx.strokeRect(1, 1, CW - 2, CH - 2);
    ctx.restore();
  }

  _cell(ctx, sym, x, y, w, h, highlight, col) {
    if (!sym) return;

    // Win highlight
    if (highlight) {
      // Pulsing gold bg
      ctx.save();
      ctx.fillStyle   = this.theme.winCell || 'rgba(255,215,60,.15)';
      ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
      ctx.strokeStyle = this.theme.winBorder || 'rgba(255,215,60,.9)';
      ctx.lineWidth   = 2.5;
      ctx.shadowColor = 'rgba(255,215,60,.6)';
      ctx.shadowBlur  = 10;
      ctx.strokeRect(x + 3, y + 3, w - 6, h - 6);
      ctx.restore();
    }

    // Draw symbol
    if (sym.draw) {
      sym.draw(ctx, x, y, w, h);
    } else {
      ctx.save();
      const fs = Math.round(h * 0.48);
      ctx.font         = `${fs}px serif`;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      // Drop shadow
      ctx.shadowColor = 'rgba(0,0,0,.5)';
      ctx.shadowBlur  = 4;
      ctx.shadowOffsetX = 1.5;
      ctx.shadowOffsetY = 1.5;
      ctx.fillText(sym.e, x + w / 2, y + h / 2);
      ctx.restore();
    }
  }

  // ── Evaluate paylines ──
  evaluate(bet, numLines) {
    let totalWin = 0;
    this.winCells.clear();
    this.winLines = [];

    const used = this.lines.slice(0, numLines);
    used.forEach((line, li) => {
      const syms = line.map((row, col) => this.grid[col][row]);
      let matchSym = null, cnt = 0;

      for (let i = 0; i < syms.length; i++) {
        const s = syms[i];
        if (s.wild)                { cnt++; continue; }
        if (s.scatter || s.bonus)  { break; }
        if (!matchSym)             { matchSym = s; cnt++; continue; }
        if (s.id === matchSym.id)  { cnt++; }
        else break;
      }

      if (cnt >= 3 && matchSym) {
        const pay = matchSym.pays[cnt - 1] || 0;
        if (pay > 0) {
          totalWin += pay * bet;
          this.winLines.push(li);
          line.slice(0, cnt).forEach((row, col) => this.winCells.add(`${col},${row}`));
        }
      }
    });

    // Count scatters
    let scatCount = 0;
    for (let c = 0; c < this.COLS; c++) {
      for (let r = 0; r < this.ROWS; r++) {
        if (this.grid[c][r].scatter) {
          scatCount++;
          this.winCells.add(`${c},${r}`);
        }
      }
    }

    return { totalWin, scatCount };
  }
}

window.SlotEngine = SlotEngine;
