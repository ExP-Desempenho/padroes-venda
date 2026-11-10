/* fundo.js · Fundo dinâmico da ExP Estudo (v3, 07/11/2026)
   Campo de pontos em onda (a onda pontilhada das artes da ExP) em 3 camadas de profundidade,
   mais um campo de fluxo com partículas que deixam rastro. Reage ao mouse/toque, respeita
   prefers-reduced-motion, pausa com a aba oculta ou fora da tela. Canvas 2D puro, sem biblioteca.
   v3: preset 'global' (uma só instância fixa atrás do app inteiro, transparente, 100lvh), troca
   suave de intensidade por tela (f.intensidade(v) faz a transição), quadros a 24 fps enquanto a
   pessoa digita e Fundo.global apontando para a instância de fundo da página.
   Desempenho (v3): nas telas grandes a malha é mais aberta, as duas camadas do fundo são retângulos
   num path só (os arcos ficam só na camada da frente), o halo é desenhado a 1/8 da resolução, DPR no
   máximo 1,5, rastros a meia resolução e, se o navegador não segurar 60 fps por mais de ~1 s, o fundo desce sozinho para 30 fps
   depois reduz a densidade e, por fim, vira um quadro parado (f.nivel() diz em que degrau está).

   Uso:
     var f = Fundo.montar(elemento, { preset:'global' | 'total' | 'sutil' | 'card', tema:'auto'|'claro'|'escuro', ... });
     f.tema('escuro'); f.pausar(); f.retomar(); f.destruir();
     // vídeo/print determinístico: Fundo.montar(el,{autoplay:false, semente:3}); f.avancar(1/30); f.desenhar();
   Ou só marque o elemento: <div data-fundo="sutil"></div> e chame Fundo.auto() (ou deixe o DOMContentLoaded).
*/
(function (global) {
  'use strict';

  /* ---------- ruído simplex 3D (compacto, determinístico pela semente) ---------- */
  function Ruido(semente) {
    var p = new Uint8Array(512), perm = new Uint8Array(256), s = semente >>> 0 || 1;
    function rnd() { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }
    for (var i = 0; i < 256; i++) perm[i] = i;
    for (i = 255; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)), t = perm[i]; perm[i] = perm[j]; perm[j] = t; }
    for (i = 0; i < 512; i++) p[i] = perm[i & 255];
    var G = [[1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],[1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],[0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]];
    var F3 = 1 / 3, G3 = 1 / 6;
    function dot(g, x, y, z) { return g[0] * x + g[1] * y + g[2] * z; }
    this.rnd = rnd;
    this.n3 = function (x, y, z) {
      var s0 = (x + y + z) * F3, i = Math.floor(x + s0), j = Math.floor(y + s0), k = Math.floor(z + s0);
      var t = (i + j + k) * G3, x0 = x - (i - t), y0 = y - (j - t), z0 = z - (k - t), i1, j1, k1, i2, j2, k2;
      if (x0 >= y0) { if (y0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0; } else if (x0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1; } else { i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1; } }
      else { if (y0 < z0) { i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1; } else if (x0 < z0) { i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1; } else { i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0; } }
      var x1 = x0 - i1 + G3, y1 = y0 - j1 + G3, z1 = z0 - k1 + G3, x2 = x0 - i2 + 2 * G3, y2 = y0 - j2 + 2 * G3, z2 = z0 - k2 + 2 * G3, x3 = x0 - 1 + 3 * G3, y3 = y0 - 1 + 3 * G3, z3 = z0 - 1 + 3 * G3;
      var ii = i & 255, jj = j & 255, kk = k & 255, n = 0, t0;
      t0 = 0.6 - x0 * x0 - y0 * y0 - z0 * z0; if (t0 > 0) { t0 *= t0; n += t0 * t0 * dot(G[p[ii + p[jj + p[kk]]] % 12], x0, y0, z0); }
      t0 = 0.6 - x1 * x1 - y1 * y1 - z1 * z1; if (t0 > 0) { t0 *= t0; n += t0 * t0 * dot(G[p[ii + i1 + p[jj + j1 + p[kk + k1]]] % 12], x1, y1, z1); }
      t0 = 0.6 - x2 * x2 - y2 * y2 - z2 * z2; if (t0 > 0) { t0 *= t0; n += t0 * t0 * dot(G[p[ii + i2 + p[jj + j2 + p[kk + k2]]] % 12], x2, y2, z2); }
      t0 = 0.6 - x3 * x3 - y3 * y3 - z3 * z3; if (t0 > 0) { t0 *= t0; n += t0 * t0 * dot(G[p[ii + 1 + p[jj + 1 + p[kk + 1]]] % 12], x3, y3, z3); }
      return 32 * n;
    };
  }

  /* ---------- cores por tema (as da marca) ---------- */
  var TEMAS = {
    claro:  { fundo: '#F4F1E8', ponto: [122, 176, 128], pontoAlfa: 1.15,  traco: [63, 132, 76],  tracoAlfa: 0.9, halo: [134, 183, 138], haloAlfa: 0.07 },
    escuro: { fundo: '#0B1411', ponto: [134, 183, 138], pontoAlfa: 0.95, traco: [168, 220, 174], tracoAlfa: 1.0, halo: [134, 183, 138], haloAlfa: 0.06 }
  };
  var PRESETS = {
    global:{ intensidade: 1,    densidade: 1,   trilhas: true, halo: true,  transparente: true,  interativo: true, fpsMax: 30 },   // 30 fps: o campo anda devagar e a página fica leve para rolar e digitar
    total: { intensidade: 1,    densidade: 1,   trilhas: true, halo: true,  transparente: false, interativo: true },
    sutil: { intensidade: 0.42, densidade: 0.8, trilhas: true, halo: false, transparente: true,  interativo: true, particulasFator: 0.5 },
    card:  { intensidade: 0.6,  densidade: 0.9, trilhas: true, halo: true,  transparente: true,  interativo: true, particulasFator: 0.7 }
  };

  function temaDaPagina() {
    var t = document.documentElement.getAttribute('data-tema');
    if (t === 'escuro' || t === 'claro') return t;
    return (global.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches) ? 'escuro' : 'claro';
  }
  function reduzMovimento() { return global.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches; }
  function mescla(a, b) { var o = {}, k; for (k in a) o[k] = a[k]; for (k in b) if (b[k] !== undefined) o[k] = b[k]; return o; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  /* ---------- instância ---------- */
  function Instancia(el, op) {
    var self = this;
    op = mescla(mescla({ preset: 'total', tema: 'auto', semente: 7, autoplay: true, fpsMax: 60, ondas: true, particulasFator: 1 }, PRESETS[op.preset || 'total']), op);
    this.op = op;
    var ruido = new Ruido(op.semente), rnd = ruido.rnd;
    var cv = document.createElement('canvas'); cv.className = 'fundo-cv'; cv.setAttribute('aria-hidden', 'true');
    cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none;';
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
    el.insertBefore(cv, el.firstChild);
    var ctx = cv.getContext('2d', { alpha: true });
    var trilha = document.createElement('canvas'), tctx = trilha.getContext('2d');
    var haloCv = document.createElement('canvas'), hctx = haloCv.getContext('2d');
    var w = 0, h = 0, dpr = 1, camadas = [], parts = [], ondas = [], t = 0, ultimo = 0, rodando = false, visivel = true, abaViva = !document.hidden, destruido = false;
    var mouse = { x: -9999, y: -9999, ax: -9999, ay: -9999, px: 0, py: 0, dentro: false }, cores = TEMAS[op.tema === 'auto' ? temaDaPagina() : op.tema], temaAtual = op.tema;
    var movimentoReduzido = reduzMovimento(), movel = false, acc = 0, alvoI = op.intensidade, digitando = false;

    function dimensiona() {
      var r = el.getBoundingClientRect(); w = Math.max(1, Math.round(r.width)); h = Math.max(1, Math.round(r.height));
      movel = w < 700;
      dpr = clamp(global.devicePixelRatio || 1, 1, 1.5);
      if (op.dpr) dpr = op.dpr;
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      var tdpr = dpr * 0.5; trilha.width = Math.max(1, Math.round(w * tdpr)); trilha.height = Math.max(1, Math.round(h * tdpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); tctx.setTransform(tdpr, 0, 0, tdpr, 0, 0);
      haloCv.width = Math.max(1, Math.round(w / 8)); haloCv.height = Math.max(1, Math.round(h / 8));
      montaCamadas(); montaParticulas();
    }

    /* camadas de pontos: longe (densa, fraca), meio, perto (esparsa, forte). z = profundidade/paralaxe */
    function montaCamadas() {
      var esc = clamp(Math.sqrt(w * h) / 900, 0.9, 1.6) / op.densidade;
      var defs = [
        { z: 0.45, esp: 20 * esc, r: 0.9, alfa: 0.42, quad: true },
        { z: 0.8,  esp: 29 * esc, r: 1.4, alfa: 0.78, quad: true },
        { z: 1.25, esp: 46 * esc, r: 2.2,  alfa: 1,  quad: false }
      ];
      if (movel) defs.splice(0, 1); // no celular só duas camadas
      camadas = defs.map(function (d) {
        var cols = Math.ceil(w / d.esp) + 3, lins = Math.ceil(h / d.esp) + 3, xs = new Float32Array(cols * lins), ys = new Float32Array(cols * lins), fase = new Float32Array(cols * lins), n = 0;
        for (var i = 0; i < cols; i++) for (var j = 0; j < lins; j++) { xs[n] = (i - 1.5) * d.esp + (j % 2) * d.esp * 0.5; ys[n] = (j - 1.5) * d.esp; fase[n] = rnd() * 6.283; n++; }
        return { z: d.z, esp: d.esp, r: d.r, alfa: d.alfa, quad: d.quad, xs: xs, ys: ys, fase: fase, n: n };
      });
    }
    function montaParticulas() {
      var n = op.trilhas ? Math.round(w * h / (movel ? 11000 : 8200) * op.densidade * op.particulasFator) : 0;
      parts = [];
      for (var i = 0; i < n; i++) parts.push(novaParticula(true));
    }
    function novaParticula(aleatoria) {
      return { x: rnd() * w, y: rnd() * h, px: 0, py: 0, vida: 7 + rnd() * 9, idade: aleatoria ? rnd() * 6 : 0, z: 0.6 + rnd() * 0.8, brilho: rnd() < 0.18 ? 1 : 0.55, ok: false };
    }

    /* ---------- passo de simulação ---------- */
    function avancar(dt) {
      t += dt;
      if (op.intensidade !== alvoI) { var dI = alvoI - op.intensidade; op.intensidade = Math.abs(dI) < 0.01 ? alvoI : op.intensidade + dI * Math.min(1, dt * 3.5); }
      // ponteiro suavizado (paralaxe lenta)
      if (mouse.dentro) { mouse.ax += (mouse.x - mouse.ax) * 0.12; mouse.ay += (mouse.y - mouse.ay) * 0.12; }
      else { mouse.ax += (-9999 - mouse.ax) * 0.02; mouse.ay += (-9999 - mouse.ay) * 0.02; }
      var alvoPx = mouse.dentro ? (mouse.x / w - 0.5) : 0, alvoPy = mouse.dentro ? (mouse.y / h - 0.5) : 0;
      mouse.px += (alvoPx - mouse.px) * 0.04; mouse.py += (alvoPy - mouse.py) * 0.04;
      // ondas de clique: expandem e somem em ~1,6 s
      for (var k = ondas.length - 1; k >= 0; k--) if (t - ondas[k].t0 > 1.7) ondas.splice(k, 1);
      // partículas do campo de fluxo
      var esc = 0.00125, vel = (movel ? 40 : 48) * dt, mx = mouse.ax, my = mouse.ay, eps = 0.02, tz = t * 0.05;
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i];
        p.px = p.x; p.py = p.y; p.idade += dt;
        if (p.idade > p.vida || p.x < -20 || p.x > w + 20 || p.y < -20 || p.y > h + 20) { parts[i] = p = novaParticula(false); p.px = p.x; p.py = p.y; p.ok = false; continue; }
        var nx = p.x * esc, ny = p.y * esc;
        var vx = (ruido.n3(nx, ny + eps, tz) - ruido.n3(nx, ny - eps, tz)) / (2 * eps) * 0.055 + 0.26;
        var vy = -(ruido.n3(nx + eps, ny, tz) - ruido.n3(nx - eps, ny, tz)) / (2 * eps) * 0.055 + 0.05 * Math.sin(t * 0.3 + p.x * 0.002);
        var vn = Math.sqrt(vx * vx + vy * vy) || 1; vx /= vn; vy /= vn;
        if (op.interativo) { var dx = p.x - mx, dy = p.y - my, d2 = dx * dx + dy * dy, R = 230;
          if (d2 < R * R) { var d = Math.sqrt(d2) + 0.001, f = 1 - d / R; f *= f; vx += (-dy / d) * 2.6 * f - (dx / d) * 0.5 * f; vy += (dx / d) * 2.6 * f - (dy / d) * 0.5 * f; } }
        var s = vel * p.z; p.x += vx * s; p.y += vy * s; p.ok = true;
      }
    }

    /* ---------- desenho ---------- */
    function desenhar() {
      var I = op.intensidade;
      ctx.clearRect(0, 0, w, h);
      if (!op.transparente) { ctx.fillStyle = cores.fundo; ctx.fillRect(0, 0, w, h); }
      if (op.halo) {
        var hw = haloCv.width, hh = haloCv.height, hx = hw * (0.62 + 0.05 * Math.sin(t * 0.17)) - mouse.px * 60 / 8, hy = hh * (0.52 + 0.06 * Math.cos(t * 0.13)) - mouse.py * 40 / 8, hr = Math.max(hw, hh) * 0.6;
        var g = hctx.createRadialGradient(hx, hy, 0, hx, hy, hr); var c = cores.halo;
        g.addColorStop(0, 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (cores.haloAlfa * I) + ')'); g.addColorStop(1, 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',0)');
        hctx.clearRect(0, 0, hw, hh); hctx.fillStyle = g; hctx.fillRect(0, 0, hw, hh);
        ctx.drawImage(haloCv, 0, 0, w, h);
      }
      // rastros: esmaece o canvas de trilha e desenha os segmentos novos
      if (parts.length) {
        tctx.globalCompositeOperation = 'destination-out'; tctx.fillStyle = 'rgba(0,0,0,' + (movimentoReduzido ? 0.02 : 0.03) + ')'; tctx.fillRect(0, 0, w, h);
        tctx.globalCompositeOperation = 'source-over'; tctx.lineCap = 'round';
        var tc = cores.traco, base = 'rgba(' + tc[0] + ',' + tc[1] + ',' + tc[2] + ',';
        tctx.lineWidth = 3.4; tctx.strokeStyle = base + (0.05 * cores.tracoAlfa * I) + ')'; tctx.beginPath();
        for (var i = 0; i < parts.length; i++) { var p = parts[i]; if (!p.ok) continue; tctx.moveTo(p.px, p.py); tctx.lineTo(p.x, p.y); }
        tctx.stroke();
        var buckets = [[], [], [], []];
        for (i = 0; i < parts.length; i++) { p = parts[i]; if (!p.ok) continue; var env = Math.min(1, p.idade * 1.2, (p.vida - p.idade) * 0.8); buckets[Math.min(3, Math.floor(env * p.brilho * 3.99))].push(p); }
        for (var b = 0; b < 4; b++) { if (!buckets[b].length) continue; tctx.lineWidth = 0.9 + b * 0.15; tctx.strokeStyle = base + ((0.12 + b * 0.22) * cores.tracoAlfa * I) + ')'; tctx.beginPath();
          for (i = 0; i < buckets[b].length; i++) { p = buckets[b][i]; tctx.moveTo(p.px, p.py); tctx.lineTo(p.x, p.y); } tctx.stroke(); }
        ctx.drawImage(trilha, 0, 0, w, h);
        // cabeça brilhante das partículas mais vivas
        ctx.fillStyle = base + (0.85 * I) + ')'; ctx.beginPath();
        for (i = 0; i < buckets[3].length; i++) { p = buckets[3][i]; ctx.moveTo(p.x + 1.4, p.y); ctx.arc(p.x, p.y, 1.4, 0, 6.283); } ctx.fill();
      }
      // pontos em onda
      if (op.ondas) {
        var pc = cores.ponto, pbase = 'rgba(' + pc[0] + ',' + pc[1] + ',' + pc[2] + ',', NB = 10, mx = mouse.ax, my = mouse.ay, inter = op.interativo;
        var bandaC = 0.56 + 0.07 * Math.sin(t * 0.21), sig2 = 2 * 0.3 * 0.3;
        for (var L = 0; L < camadas.length; L++) {
          var c = camadas[L], paths = [], j;
          for (j = 0; j < NB; j++) paths.push([]);
          var z = c.z, parX = -mouse.px * 36 * z, parY = -mouse.py * 26 * z, alfaL = c.alfa * cores.pontoAlfa * I;
          for (i = 0; i < c.n; i++) {
            var x0 = c.xs[i], y0 = c.ys[i];
            var onda = Math.sin(x0 * 0.0042 + t * 0.34 + y0 * 0.0019) * 26 + Math.sin(x0 * 0.0105 - t * 0.22 + y0 * 0.0029) * 9;
            var x = x0 + parX + Math.sin(y0 * 0.012 + t * 0.42 + c.fase[i]) * 3 * z, y = y0 + parY + onda * z;
            var cr = 0.5 + 0.5 * Math.sin(x0 * 0.0031 + y0 * 0.0013 - t * 0.5 + Math.sin(y0 * 0.0075 + t * 0.19) * 1.6);
            var dy0 = y0 / h - bandaC, banda = Math.exp(-dy0 * dy0 / sig2);
            var cr3 = cr * cr * cr, alfa = alfaL * (0.1 + 0.9 * banda * cr3), r = c.r * (0.7 + 0.7 * cr3);
            if (inter) { var dx = x - mx, dy = y - my, d2 = dx * dx + dy * dy, R = 170 * z;
              if (d2 < R * R) { var d = Math.sqrt(d2) + 0.001, f = 1 - d / R; f *= f; x += dx / d * 18 * f * z; y += dy / d * 18 * f * z; alfa += 0.55 * f * I; r *= 1 + 0.9 * f; } }
            for (var k = 0; k < ondas.length; k++) { var o = ondas[k], ox = x - o.x, oy = y - o.y, od = Math.sqrt(ox * ox + oy * oy), raioO = (t - o.t0) * 420, dd = (od - raioO) / 48, ff = Math.exp(-dd * dd) * (1 - (t - o.t0) / 1.7);
              if (ff > 0.01) { x += ox / (od + 0.1) * 14 * ff * z; y += oy / (od + 0.1) * 14 * ff * z; alfa += 0.6 * ff * I; r *= 1 + 0.6 * ff; } }
            if (alfa < 0.012) continue;
            paths[Math.min(NB - 1, (alfa * NB) | 0)].push(x, y, r);
          }
          for (j = 0; j < NB; j++) { var P = paths[j]; if (!P.length) continue;
            ctx.fillStyle = pbase + Math.min(1, (j + 0.5) / NB) + ')';
            if (c.quad) { ctx.beginPath(); for (i = 0; i < P.length; i += 3) ctx.rect(P[i] - P[i + 2], P[i + 1] - P[i + 2], P[i + 2] * 2, P[i + 2] * 2); ctx.fill(); }
            else { ctx.beginPath(); for (i = 0; i < P.length; i += 3) { ctx.moveTo(P[i] + P[i + 2], P[i + 1]); ctx.arc(P[i], P[i + 1], P[i + 2], 0, 6.283); } ctx.fill(); }
          }
        }
      }
    }

    /* ---------- laço ---------- */
    var lentos = 0, nivel = 0;
    function degrada() { nivel++; lentos = 0;
      if (nivel === 1) op.fpsMax = Math.min(op.fpsMax, 30);
      else if (nivel === 2) { op.densidade *= 0.7; op.particulasFator *= 0.6; montaCamadas(); montaParticulas(); }
      else { op.autoplay = false; rodando = false; desenhar(); } }   // 3º degrau: máquina não aguenta; vira um quadro parado
    function quadro(agora) {
      if (!rodando || destruido) return;
      var real = ultimo ? agora - ultimo : 16.7, dt = Math.min(0.05, real / 1000); ultimo = agora;
      // o navegador não está segurando o ritmo (quadros de mais de 30 ms por mais de ~1 s): desce um degrau
      if (real > 30) { if (++lentos > 40 && nivel < 3) degrada(); } else if (lentos) lentos--;
      var fps = movel ? Math.min(op.fpsMax, 30) : digitando ? Math.min(op.fpsMax, 24) : op.fpsMax;
      acc += dt;
      if (acc >= 1 / fps - 0.002) { avancar(acc); desenhar(); acc = 0; }
      global.requestAnimationFrame(quadro);
    }
    function podeRodar() { return op.autoplay && !movimentoReduzido && visivel && abaViva && !destruido; }
    function sincroniza() { var deve = podeRodar(); if (deve && !rodando) { rodando = true; ultimo = 0; global.requestAnimationFrame(quadro); } else if (!deve) rodando = false; }

    /* ---------- eventos ---------- */
    function ponteiro(e) { var r = cv.getBoundingClientRect(), p = e.touches ? e.touches[0] : e; if (!p) return; mouse.x = p.clientX - r.left; mouse.y = p.clientY - r.top; mouse.dentro = mouse.x >= -40 && mouse.y >= -40 && mouse.x <= w + 40 && mouse.y <= h + 40; if (mouse.dentro && mouse.ax < -1000) { mouse.ax = mouse.x; mouse.ay = mouse.y; } }
    function sai() { mouse.dentro = false; }
    function toque(e) { var r = cv.getBoundingClientRect(), p = e.touches ? e.touches[0] : e; if (!p) return; var x = p.clientX - r.left, y = p.clientY - r.top; if (x < 0 || y < 0 || x > w || y > h) return; ondas.push({ x: x, y: y, t0: t }); if (ondas.length > 4) ondas.shift(); if (movimentoReduzido) { avancar(0.016); desenhar(); } }
    var alvoEv = op.area || global;
    if (op.interativo) { alvoEv.addEventListener('mousemove', ponteiro, { passive: true }); alvoEv.addEventListener('touchmove', ponteiro, { passive: true }); alvoEv.addEventListener('touchstart', ponteiro, { passive: true }); alvoEv.addEventListener('mousedown', toque, { passive: true }); alvoEv.addEventListener('touchstart', toque, { passive: true }); document.addEventListener('mouseleave', sai); }
    function vis() { abaViva = !document.hidden; sincroniza(); }
    document.addEventListener('visibilitychange', vis);
    function foco(e) { var a = e.target, tag = a && a.tagName; digitando = e.type === 'focusin' && (tag === 'TEXTAREA' || (tag === 'INPUT' && !/^(checkbox|radio|range|button|submit)$/.test(a.type)) || (a && a.isContentEditable)); }
    document.addEventListener('focusin', foco); document.addEventListener('focusout', foco);
    var io = null; if (global.IntersectionObserver) { io = new IntersectionObserver(function (es) { visivel = es[0].isIntersecting; sincroniza(); }, { threshold: 0.02 }); io.observe(cv); }
    var ro = null; if (global.ResizeObserver) { ro = new ResizeObserver(function () { var r = el.getBoundingClientRect(); if (Math.round(r.width) !== w || Math.round(r.height) !== h) { var eraMinusculo = w <= 2 || h <= 2; dimensiona(); if (eraMinusculo) preaquece(); if (!rodando) desenhar(); } }); ro.observe(el); }
    else global.addEventListener('resize', dimensiona);
    var mo = null; if (op.tema === 'auto' && global.MutationObserver) { mo = new MutationObserver(function () { self.tema('auto'); }); mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-tema'] }); }
    var mq = global.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : null;
    function mudaMovimento() { movimentoReduzido = mq.matches; if (movimentoReduzido) { rodando = false; preaquece(); desenhar(); } else sincroniza(); }
    if (mq && mq.addEventListener) mq.addEventListener('change', mudaMovimento);

    /* com movimento reduzido ou antes do 1º quadro: simula alguns passos para a imagem parada já ter rastro */
    function preaquece() { for (var i = 0; i < 160; i++) { avancar(1 / 40); if (parts.length) { tctx.globalCompositeOperation = 'destination-out'; tctx.fillStyle = 'rgba(0,0,0,0.03)'; tctx.fillRect(0, 0, w, h); tctx.globalCompositeOperation = 'source-over'; var tc = cores.traco; tctx.lineWidth = 1.1; tctx.strokeStyle = 'rgba(' + tc[0] + ',' + tc[1] + ',' + tc[2] + ',' + (0.4 * cores.tracoAlfa * op.intensidade) + ')'; tctx.beginPath(); for (var j = 0; j < parts.length; j++) { var p = parts[j]; if (!p.ok) continue; tctx.moveTo(p.px, p.py); tctx.lineTo(p.x, p.y); } tctx.stroke(); } } }

    /* ---------- API ---------- */
    this.el = el; this.canvas = cv;
    this.avancar = function (dt) { avancar(dt); return self; };
    this.desenhar = function () { desenhar(); return self; };
    this.tempo = function () { return t; };
    this.ir = function (segundos) { var passo = 1 / 30; while (t < segundos) { avancar(passo); desenhar(); } return self; };
    this.pausar = function () { op.autoplay = false; rodando = false; return self; };
    this.retomar = function () { op.autoplay = true; sincroniza(); return self; };
    this.tema = function (nome) { temaAtual = nome; cores = TEMAS[nome === 'auto' ? temaDaPagina() : nome] || TEMAS.claro; if (!rodando) desenhar(); return self; };
    this.nivel = function () { return nivel; };
    this.intensidade = function (v, imediato) { alvoI = v; if (imediato || !rodando) { op.intensidade = v; if (!rodando) desenhar(); } return self; };
    this.onda = function (x, y) { ondas.push({ x: x, y: y, t0: t }); return self; };
    this.destruir = function () { destruido = true; rodando = false; if (io) io.disconnect(); if (ro) ro.disconnect(); if (mo) mo.disconnect(); document.removeEventListener('visibilitychange', vis); document.removeEventListener('focusin', foco); document.removeEventListener('focusout', foco); if (op.interativo) { alvoEv.removeEventListener('mousemove', ponteiro); alvoEv.removeEventListener('touchmove', ponteiro); alvoEv.removeEventListener('touchstart', ponteiro); alvoEv.removeEventListener('mousedown', toque); alvoEv.removeEventListener('touchstart', toque); document.removeEventListener('mouseleave', sai); } if (cv.parentNode) cv.parentNode.removeChild(cv); };

    dimensiona();
    if (op.quadro !== undefined) { this.ir(op.quadro); op.autoplay = false; }
    else if (movimentoReduzido || !op.autoplay) { preaquece(); desenhar(); }
    else { preaquece(); desenhar(); sincroniza(); }
  }

  var Fundo = {
    montar: function (el, op) { return new Instancia(el, op || {}); },
    auto: function (raiz) {
      var q = new URLSearchParams(global.location.search), quadro = q.get('quadro'), lista = [];
      (raiz || document).querySelectorAll('[data-fundo]').forEach(function (el) {
        if (el.__fundo) return;
        var op = { preset: el.getAttribute('data-fundo') || 'total' };
        if (el.dataset.intensidade) op.intensidade = +el.dataset.intensidade;
        if (el.dataset.densidade) op.densidade = +el.dataset.densidade;
        if (el.dataset.semente) op.semente = +el.dataset.semente;
        if (el.dataset.tema) op.tema = el.dataset.tema;
        if (quadro !== null) op.quadro = +quadro;
        el.__fundo = Fundo.montar(el, op); lista.push(el.__fundo);
        if (op.preset === 'global') Fundo.global = el.__fundo;
      });
      return lista;
    },
    global: null, temas: TEMAS, presets: PRESETS
  };
  global.Fundo = Fundo;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { Fundo.auto(); }); else Fundo.auto();
})(window);
