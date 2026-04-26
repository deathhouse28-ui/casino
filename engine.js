/* ═══════════════════════════════════════════════
   NOVA 777 — Shared Slot Engine  (engine.js)
   ═══════════════════════════════════════════════ */

/* ── WEB AUDIO ───────────────────────────────── */
let _AC = null;
function _ac() {
  if (!_AC) _AC = new (window.AudioContext || window.webkitAudioContext)();
  if (_AC.state === 'suspended') _AC.resume();
  return _AC;
}
function _tone(freq, type, dur, vol = 0.15, delay = 0) {
  try {
    const ac = _ac();
    const o = ac.createOscillator(), g = ac.createGain();
    o.connect(g); g.connect(ac.destination);
    o.type = type;
    o.frequency.setValueAtTime(freq, ac.currentTime + delay);
    g.gain.setValueAtTime(0, ac.currentTime + delay);
    g.gain.linearRampToValueAtTime(vol, ac.currentTime + delay + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + delay + dur);
    o.start(ac.currentTime + delay);
    o.stop(ac.currentTime + delay + dur + 0.05);
  } catch (e) {}
}

window.SND = {
  click:   () => _tone(900, 'sine', 0.05, 0.1),
  tick:    (i) => _tone(120 + Math.random()*40, 'square', 0.03, 0.08, i * 0.045),
  stop:    (col) => { _tone(220 - col*18, 'sine', 0.1, 0.22); _tone(110, 'sine', 0.07, 0.14, 0.06); },
  win:     () => [523,659,784,1047].forEach((f,i) => _tone(f,'sine',0.2,0.18,i*0.1)),
  bigwin:  () => [400,523,659,784,1047,1319].forEach((f,i) => { _tone(f,'sine',0.35,0.22,i*0.09); _tone(f*1.5,'triangle',0.15,0.1,i*0.09+0.04); }),
  freespin:() => [350,450,600,800,1000].forEach((f,i) => _tone(f,'sine',0.28,0.2,i*0.11)),
  bonus:   () => [300,400,550,750,1000].forEach((f,i) => _tone(f,'sine',0.3,0.22,i*0.1)),
  spinStart:() => { for(let i=0;i<20;i++) _tone(80+Math.random()*40,'square',0.035,0.1,i*0.048); }
};

/* ── REEL ENGINE ─────────────────────────────── */
/*
  Simple, reliable approach:
  - Each reel has an array of symbols (strip).
  - During spin, we animate a "scroll position" (pixels).
  - We know in advance where we want to land.
  - We run for a minimum number of full loops, then ease into the target.
  - No physics that can diverge — pure time-based easing.
*/

class ReelEngine {
  constructor(canvas, config) {
    this.cv  = canvas;
    this.ctx = canvas.getContext('2d');
    this.cfg = config; // { rows, cols, cellH (optional), symbols, paylines, theme }

    this.ROWS  = config.rows || 3;
    this.COLS  = config.cols || 5;
    this.syms  = config.symbols;   // array of symbol objects
    this.lines = config.paylines;  // array of payline arrays
    this.theme = config.theme || {};

    // Strip length per reel (how many symbols in the belt)
    this.STRIP = 32;

    // Build strips
    this.strips = Array.from({length: this.COLS}, () =>
      Array.from({length: this.STRIP}, () => this._rnd())
    );

    // Visible result grid [col][row]
    this.grid = Array.from({length: this.COLS}, () =>
      Array.from({length: this.ROWS}, () => this._rnd())
    );

    // Reel animation state
    this.rState = Array.from({length: this.COLS}, () => ({
      spinning:  false,
      startTime: 0,
      duration:  0,       // total spin duration ms
      startPx:   0,       // scroll px at spin start (always 0)
      totalPx:   0,       // total pixels to scroll
      currentPx: 0,       // current scroll position
      done:      true,
    }));

    this.winCells = new Set();
    this.winLines = [];
    this.flashT   = 0;
    this.anySpinning = false;

    this._resize();
    window.addEventListener('resize', () => this._resize());
    requestAnimationFrame(ts => this._loop(ts));
  }

  _resize() {
    this.CW = this.cv.offsetWidth;
    this.CH = Math.round(this.CW * (this.ROWS / this.COLS));
    this.cv.width  = this.CW;
    this.cv.height = this.CH;
    this.CW2 = this.CW / this.COLS;   // cell width
    this.CH2 = this.CH / this.ROWS;   // cell height
  }

  _rnd() {
    const total = this.syms.reduce((a, s) => a + s.w, 0);
    let r = Math.random() * total;
    for (const s of this.syms) { r -= s.w; if (r <= 0) return s; }
    return this.syms[0];
  }

  /* Start spinning all reels. result[col][row] = target symbol. */
  spin(result, stopDelays) {
    this.winCells.clear();
    this.winLines = [];
    this.flashT   = 0;
    this.anySpinning = true;

    const CELL = this.CH2;
    const now  = performance.now();

    for (let c = 0; c < this.COLS; c++) {
      // Place result at specific position in strip
      const landIdx = this.STRIP - this.ROWS; // index of first result symbol
      for (let r = 0; r < this.ROWS; r++) {
        this.strips[c][(landIdx + r) % this.STRIP] = result[c][r];
      }
      // Fill rest randomly
      for (let i = 0; i < this.STRIP - this.ROWS; i++) {
        this.strips[c][i] = this._rnd();
      }

      // How many full loops + offset to land on landIdx
      const LOOPS   = 3;
      const landPx  = landIdx * CELL;
      const totalPx = LOOPS * this.STRIP * CELL + landPx;

      const delay    = stopDelays[c];   // ms before this reel starts decelerating
      const spinDur  = delay + 800;     // total duration for this reel

      this.rState[c] = {
        spinning:  true,
        startTime: now,
        duration:  spinDur,
        totalPx:   totalPx,
        currentPx: 0,
        done:      false,
      };
    }
  }

  /* Easing functions */
  _easeIn(t)    { return t * t * t; }
  _easeOut(t)   { return 1 - Math.pow(1 - t, 3); }
  _easeInOut(t) { return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2; }

  _loop(ts) {
    const now = performance.now();
    let allDone = true;

    for (let c = 0; c < this.COLS; c++) {
      const rs = this.rState[c];
      if (rs.done) continue;
      allDone = false;

      const elapsed  = now - rs.startTime;
      const progress = Math.min(elapsed / rs.duration, 1);

      // Ease: fast in middle, slow at end
      let eased;
      if (progress < 0.15) {
        eased = this._easeIn(progress / 0.15) * 0.15;
      } else if (progress < 0.75) {
        // linear middle section — constant fast speed
        eased = 0.15 + (progress - 0.15) * (0.75 / 0.6);
      } else {
        // ease out to stop
        const t = (progress - 0.75) / 0.25;
        eased = 0.9 + this._easeOut(t) * 0.1;
      }

      rs.currentPx = eased * rs.totalPx;

      if (progress >= 1) {
        rs.done     = true;
        rs.spinning = false;
        rs.currentPx = rs.totalPx;
        // Snap grid
        const landIdx = this.STRIP - this.ROWS;
        for (let r = 0; r < this.ROWS; r++) {
          this.grid[c][r] = this.strips[c][(landIdx + r) % this.STRIP];
        }
        SND.stop(c);
        // Check if all done
        if (this.rState.every(s => s.done)) {
          this.anySpinning = false;
          if (this.onAllStopped) this.onAllStopped();
        }
      }
    }

    this._draw();
    requestAnimationFrame(ts => this._loop(ts));
  }

  _draw() {
    const ctx  = this.ctx;
    const CW   = this.CW, CH = this.CH;
    const CW2  = this.CW2, CH2 = this.CH2;
    const t    = this.theme;

    if (!CW2 || !CH2) return;

    // Background
    const bg = ctx.createLinearGradient(0, 0, 0, CH);
    bg.addColorStop(0, t.bg0 || '#1a0810');
    bg.addColorStop(1, t.bg1 || '#0e050b');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, CW, CH);

    // Extra bg effects (override in subclass)
    if (this.drawBackground) this.drawBackground(ctx, CW, CH);

    // Draw each reel
    for (let c = 0; c < this.COLS; c++) {
      const rx  = c * CW2;
      const rs  = this.rState[c];

      ctx.save();
      ctx.beginPath();
      ctx.rect(rx + 1, 0, CW2 - 2, CH);
      ctx.clip();

      // Column bg
      ctx.fillStyle = 'rgba(0,0,0,0.08)';
      ctx.fillRect(rx, 0, CW2, CH);

      if (!rs.done) {
        // SPINNING — draw scrolling strip
        const scrollPx = rs.currentPx % (this.STRIP * CH2);
        const topSym   = Math.floor(scrollPx / CH2);
        const offsetY  = scrollPx % CH2;

        for (let row = -1; row <= this.ROWS + 1; row++) {
          const sy   = row * CH2 - offsetY;
          if (sy > CH + CH2 || sy < -CH2) continue;
          const si   = ((topSym + row) % this.STRIP + this.STRIP) % this.STRIP;
          this._drawCell(ctx, this.strips[c][si], rx, sy, CW2, CH2, false);
        }
      } else {
        // STOPPED — draw static grid with win highlights
        for (let r = 0; r < this.ROWS; r++) {
          const isWin = this.winCells.has(`${c},${r}`);
          const flash = isWin && (this.flashT % 28 < 14);
          this._drawCell(ctx, this.grid[c][r], rx, r * CH2, CW2, CH2, flash);
        }
      }

      ctx.restore();
    }

    // Flash counter
    if (!this.anySpinning && this.winCells.size > 0) this.flashT++;

    // Grid lines
    ctx.strokeStyle = t.gridLine || 'rgba(212,168,67,.08)';
    ctx.lineWidth = 1;
    for (let c = 1; c < this.COLS; c++) {
      ctx.beginPath(); ctx.moveTo(c*CW2, 0); ctx.lineTo(c*CW2, CH); ctx.stroke();
    }
    for (let r = 1; r < this.ROWS; r++) {
      ctx.beginPath(); ctx.moveTo(0, r*CH2); ctx.lineTo(CW, r*CH2); ctx.stroke();
    }

    // Win paylines
    if (!this.anySpinning && this.winLines.length && this.flashT % 28 < 14) {
      this.winLines.forEach(li => {
        const line = this.lines[li];
        ctx.beginPath();
        line.forEach((row, col) => {
          const px = col * CW2 + CW2 / 2;
          const py = row * CH2 + CH2 / 2;
          col === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        });
        ctx.strokeStyle = t.winLine || 'rgba(212,168,67,.6)';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([8, 5]);
        ctx.stroke();
        ctx.setLineDash([]);
      });
    }

    // Top/bottom vignette
    const vT = ctx.createLinearGradient(0, 0, 0, CH2 * 0.6);
    vT.addColorStop(0, t.vignette || 'rgba(14,5,11,.8)');
    vT.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = vT; ctx.fillRect(0, 0, CW, CH2 * 0.6);
    const vB = ctx.createLinearGradient(0, CH - CH2 * 0.6, 0, CH);
    vB.addColorStop(0, 'rgba(0,0,0,0)');
    vB.addColorStop(1, t.vignette || 'rgba(14,5,11,.8)');
    ctx.fillStyle = vB; ctx.fillRect(0, CH - CH2 * 0.6, CW, CH2 * 0.6);

    // Center payline guide
    ctx.strokeStyle = t.centerLine || 'rgba(212,168,67,.15)';
    ctx.lineWidth = 1; ctx.setLineDash([6, 7]);
    ctx.beginPath(); ctx.moveTo(0, CH / 2); ctx.lineTo(CW, CH / 2); ctx.stroke();
    ctx.setLineDash([]);
  }

  _drawCell(ctx, sym, x, y, w, h, highlight) {
    if (highlight) {
      ctx.fillStyle = this.theme.winCell || 'rgba(212,168,67,.18)';
      ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
      ctx.strokeStyle = this.theme.winBorder || 'rgba(212,168,67,.7)';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(x + 3, y + 3, w - 6, h - 6);
    }
    // Symbol — override with custom draw if needed
    if (sym.draw) {
      sym.draw(ctx, x, y, w, h);
    } else {
      const fs = Math.round(h * 0.46);
      ctx.font = `${fs}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // Subtle shadow
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillText(sym.e, x + w / 2 + 1, y + h / 2 + 1);
      ctx.fillStyle = '#fff';
      ctx.fillText(sym.e, x + w / 2, y + h / 2);
    }
  }

  /* Evaluate win for current grid */
  evaluate(bet, numLines) {
    let totalWin = 0;
    this.winCells.clear();
    this.winLines = [];

    LINES_USED = this.lines.slice(0, numLines);

    LINES_USED.forEach((line, li) => {
      const syms = line.map((row, col) => this.grid[col][row]);
      let matchSym = null, cnt = 0;
      for (let i = 0; i < syms.length; i++) {
        const s = syms[i];
        if (s.wild) { cnt++; continue; }
        if (s.scatter || s.bonus) break;
        if (!matchSym) { matchSym = s; cnt++; continue; }
        if (s.id === matchSym.id) cnt++;
        else break;
      }
      if (cnt >= 3 && matchSym) {
        const payout = matchSym.pays[cnt - 1] || 0;
        if (payout > 0) {
          totalWin += payout * bet;
          this.winLines.push(li);
          line.slice(0, cnt).forEach((row, col) => this.winCells.add(`${col},${row}`));
        }
      }
    });

    // Scatter count
    let scatCount = 0;
    for (let c = 0; c < this.COLS; c++)
      for (let r = 0; r < this.ROWS; r++)
        if (this.grid[c][r].scatter) { scatCount++; this.winCells.add(`${c},${r}`); }

    return { totalWin, scatCount };
  }
}

window.ReelEngine = ReelEngine;
