/* Kroniky rodů — vykreslení stromu na „stránku kroniky" (A5 / A4, 300 DPI)
 * Cílem je list, který obstojí v tištěné fantasy knize: pergamen, dvojitý rám
 * s rozvilinami v rozích, kaligrafický nadpis a jména na plaketách.
 */
(function (global) {
  'use strict';

  var PAPER = {
    A5: { w: 148, h: 210 },
    A4: { w: 210, h: 297 }
  };

  var PALETTES = {
    pergamen: {
      dark: false,
      bg: '#eee0bd', bgHi: '#faf2df',
      frame: '#a8813f', frameFine: '#c0a065',
      ink: '#382c1e', muted: '#7a6749',
      card: '#fbf4e3', cardLine: '#c6ad82', cardEdge: '#8a7146',
      accent: '#a25f1c', link: '#9c8558',
      stain: 'rgba(146, 104, 44, .07)',
      vignette: 'rgba(96, 68, 26, .17)',
      m: '#5f7f96', f: '#a86a76', x: '#9c8b6a'
    },
    inkoust: {
      dark: true,
      bg: '#1b1710', bgHi: '#251f16',
      frame: '#8a6a33', frameFine: '#6a5228',
      ink: '#f2e7d2', muted: '#a2917a',
      card: '#26211a', cardLine: '#514530', cardEdge: '#6f5c3a',
      accent: '#d8a44a', link: '#6b5b3d',
      stain: 'rgba(255, 218, 150, .04)',
      vignette: 'rgba(0, 0, 0, .5)',
      m: '#7fa2bd', f: '#cd8b98', x: '#9c8d74'
    },
    /* Prostý list — bílý papír, černý tisk, žádné plakety ani rám.
       Takhle se rodokmeny sázejí v dodatcích knih. */
    prosty: {
      plain: true, dark: false,
      bg: '#ffffff', bgHi: '#ffffff',
      frame: '#000000', frameFine: '#000000',
      ink: '#000000', muted: '#333333',
      card: '#ffffff', cardLine: '#000000', cardEdge: '#000000',
      accent: '#000000', link: '#000000',
      stain: 'rgba(0,0,0,0)', vignette: 'rgba(0,0,0,0)',
      m: '#000000', f: '#000000', x: '#000000'
    }
  };

  function mm2px(mm, dpi) { return Math.round(mm / 25.4 * dpi); }

  /* Rozvržení stránky — plocha, která zbude na strom pod nadpisem.
     Kromě názvu rodu se na list netiskne žádný text, takže dole ani
     pod nadpisem není co držet místem. */
  function pageMetrics(W, H) {
    var base = Math.min(W, H);
    var margin = Math.round(base * 0.055);
    var titleSize = Math.round(base * 0.05);
    var subSize = Math.round(base * 0.023);
    var titleBase = margin + titleSize * 1.05;
    var ruleY = titleBase + titleSize * 0.66;
    var top = ruleY + subSize * 1.5;
    return {
      base: base, margin: margin,
      titleSize: titleSize, subSize: subSize,
      titleBase: titleBase, ruleY: ruleY,
      pad: Math.round(base * 0.012),
      x: margin, y: top,
      w: W - margin * 2,
      h: H - top - margin * 1.1
    };
  }

  function plaque(ctx, cx, cy, w, h, b) {
    var x = w / 2, y = h / 2;
    ctx.beginPath();
    ctx.moveTo(cx - x + b, cy - y);
    ctx.lineTo(cx + x - b, cy - y);
    ctx.lineTo(cx + x, cy - y + b);
    ctx.lineTo(cx + x, cy + y - b);
    ctx.lineTo(cx + x - b, cy + y);
    ctx.lineTo(cx - x + b, cy + y);
    ctx.lineTo(cx - x, cy + y - b);
    ctx.lineTo(cx - x, cy - y + b);
    ctx.closePath();
  }

  function fitText(ctx, text, maxW) {
    if (ctx.measureText(text).width <= maxW) return text;
    var t = text;
    while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
    return t + '…';
  }

  function diamond(ctx, x, y, r) {
    ctx.beginPath();
    ctx.moveTo(x, y - r); ctx.lineTo(x + r, y);
    ctx.lineTo(x, y + r); ctx.lineTo(x - r, y);
    ctx.closePath();
  }

  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  /* ---------------- pergamen ---------------- */

  function paperTexture(ctx, W, H, pal) {
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, W, H);

    var g = ctx.createRadialGradient(W / 2, H * 0.42, 0, W / 2, H * 0.42, Math.max(W, H) * 0.72);
    g.addColorStop(0, pal.bgHi);
    g.addColorStop(1, pal.bg);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // dvě vrstvy šumu — velké skvrny a jemné zrno
    [[52, 0.1], [230, 0.06]].forEach(function (spec) {
      var nw = spec[0], nh = Math.max(8, Math.round(spec[0] * H / W));
      var nc = document.createElement('canvas');
      nc.width = nw; nc.height = nh;
      var nx = nc.getContext('2d');
      var img = nx.createImageData(nw, nh);
      var rnd = mulberry32(nw * 7919 + 13);
      for (var i = 0; i < nw * nh; i++) {
        var v = 132 + (rnd() - 0.5) * 105;
        img.data[i * 4] = v;
        img.data[i * 4 + 1] = v * 0.975;
        img.data[i * 4 + 2] = v * 0.9;
        img.data[i * 4 + 3] = 255;
      }
      nx.putImageData(img, 0, 0);
      ctx.save();
      ctx.globalAlpha = spec[1];
      ctx.globalCompositeOperation = pal.dark ? 'overlay' : 'multiply';
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(nc, 0, 0, W, H);
      ctx.restore();
    });

    // měkké skvrny
    var rnd2 = mulberry32(4242);
    for (var s = 0; s < 7; s++) {
      var sx = rnd2() * W, sy = rnd2() * H;
      var sr = (0.06 + rnd2() * 0.12) * Math.min(W, H);
      var sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr);
      sg.addColorStop(0, pal.stain);
      sg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = sg;
      ctx.fillRect(sx - sr, sy - sr, sr * 2, sr * 2);
    }

    // ztmavení k okrajům
    var vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.36,
      W / 2, H / 2, Math.max(W, H) * 0.8);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, pal.vignette);
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
  }

  /* ---------------- rám s rozvilinami ---------------- */

  function cornerFlourish(ctx, x, y, s, sx, sy, pal) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(sx, sy);
    ctx.strokeStyle = pal.frame;
    ctx.lineWidth = s * 0.075;
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(0, s * 1.15);
    ctx.quadraticCurveTo(0, 0, s * 1.15, 0);
    ctx.stroke();

    ctx.lineWidth = s * 0.055;
    ctx.beginPath();
    ctx.moveTo(s * 0.3, s * 0.86);
    ctx.quadraticCurveTo(s * 0.3, s * 0.3, s * 0.86, s * 0.3);
    ctx.stroke();

    ctx.fillStyle = pal.frame;
    ctx.beginPath();
    ctx.moveTo(s * 1.15, 0);
    ctx.quadraticCurveTo(s * 1.62, -s * 0.08, s * 1.78, -s * 0.42);
    ctx.quadraticCurveTo(s * 1.3, -s * 0.36, s * 1.15, 0);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(0, s * 1.15);
    ctx.quadraticCurveTo(-s * 0.08, s * 1.62, -s * 0.42, s * 1.78);
    ctx.quadraticCurveTo(-s * 0.36, s * 1.3, 0, s * 1.15);
    ctx.fill();

    diamond(ctx, s * 0.3, s * 0.3, s * 0.12);
    ctx.fill();
    ctx.restore();
  }

  function drawFrame(ctx, W, H, margin, pal) {
    var o = margin * 0.62;
    var i = o + margin * 0.2;
    ctx.strokeStyle = pal.frame;
    ctx.lineWidth = Math.max(2, W * 0.0026);
    ctx.strokeRect(o, o, W - o * 2, H - o * 2);
    ctx.strokeStyle = pal.frameFine;
    ctx.lineWidth = Math.max(1, W * 0.001);
    ctx.strokeRect(i, i, W - i * 2, H - i * 2);

    var s = margin * 0.62;
    cornerFlourish(ctx, i, i, s, 1, 1, pal);
    cornerFlourish(ctx, W - i, i, s, -1, 1, pal);
    cornerFlourish(ctx, i, H - i, s, 1, -1, pal);
    cornerFlourish(ctx, W - i, H - i, s, -1, -1, pal);
  }

  /* rozestup pokolení natáhneme tak, aby strom vyplnil stránku */
  function stretchLayout(layout, extra) {
    if (!extra) return layout;
    var idx = {};
    var persons = layout.persons.map(function (n) {
      var c = {
        id: n.id, person: n.person, gen: n.gen, role: n.role,
        x: n.x, y: n.y + (n.gen - layout.minGen) * extra,
        w: n.w, h: n.h, hidden: n.hidden
      };
      idx[c.id] = c;
      return c;
    });
    // posun konkrétní osoby proti původnímu rozvržení
    function shiftOf(id) {
      var a = idx[id], b = layout.index[id];
      return (a && b) ? a.y - b.y : 0;
    }
    var unionIndex = {};
    var unions = layout.unions.map(function (u) {
      var dy = shiftOf(u.partners[0]);
      var c = {
        id: u.id, x: u.x, y: u.y + dy,
        ax: u.ax, ay: u.ay + dy,
        arc: u.arc, arcTop: u.arcTop + dy, remote: u.remote,
        years: u.years, note: u.note, bus: u.bus,
        partners: u.partners, children: u.children
      };
      unionIndex[c.id] = c;
      return c;
    });
    var partnerLinks = layout.partnerLinks.map(function (l) {
      return {
        unionId: l.unionId, a: l.a, b: l.b,
        arc: l.arc, arcTop: l.arcTop + shiftOf(l.a)
      };
    });
    var b = layout.bbox;
    var span = (layout.maxGen - layout.minGen) * extra;
    return {
      focusId: layout.focusId, persons: persons, unions: unions,
      childLinks: layout.childLinks, partnerLinks: partnerLinks,
      index: idx, unionIndex: unionIndex,
      minGen: layout.minGen, maxGen: layout.maxGen,
      bbox: { x1: b.x1, y1: b.y1, x2: b.x2, y2: b.y2 + span, w: b.w, h: b.h + span }
    };
  }

  /* největší možné měřítko na dané stránce + odpovídající rozestup pokolení */
  function fitPage(W, H, layout, dpi, M) {
    var m = pageMetrics(W, H);
    var b = layout.bbox;
    var gaps = layout.maxGen - layout.minGen;
    var availW = m.w - m.pad * 2, availH = m.h - m.pad * 2;
    var minExtra = -(M.ROW_H - (M.NODE_H + 46));
    var maxExtra = M.ROW_H * 0.85;
    var s = Math.min(availW / Math.max(b.w, 1), dpi / 96 * 1.7);
    var extra = 0;
    if (gaps > 0) {
      extra = (availH / s - b.h) / gaps;
      extra = Math.max(minExtra, Math.min(maxExtra, extra));
      var totalH = b.h + gaps * extra;
      if (totalH * s > availH) s = availH / totalH;
    } else if (b.h * s > availH) {
      s = availH / b.h;
    }
    return { m: m, s: s, extra: extra };
  }

  /* ---------------- celá stránka ---------------- */

  function render(tree, layout, settings, opts) {
    opts = opts || {};
    var M = global.FG.Layout.M;
    var dpi = opts.dpi || 300;
    var fmt = PAPER[opts.format] || PAPER.A5;
    var pal = PALETTES[opts.theme || settings.theme] || PALETTES.pergamen;

    var b = layout.bbox;
    var orient = opts.orientation || 'auto';
    if (orient === 'auto') {
      var pFit = fitPage(mm2px(fmt.w, dpi), mm2px(fmt.h, dpi), layout, dpi, M);
      var lFit = fitPage(mm2px(fmt.h, dpi), mm2px(fmt.w, dpi), layout, dpi, M);
      orient = lFit.s > pFit.s * 1.02 ? 'landscape' : 'portrait';
    }
    var pw = orient === 'landscape' ? fmt.h : fmt.w;
    var ph = orient === 'landscape' ? fmt.w : fmt.h;

    var W = mm2px(pw, dpi), H = mm2px(ph, dpi);
    var canvas = opts.canvas || document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    var ctx = canvas.getContext('2d');

    var m = pageMetrics(W, H);
    var margin = m.margin;

    // Na listu stojí jen jméno rodu — žádné počty, data ani popisky.
    if (pal.plain) {
      ctx.fillStyle = pal.bg;
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center';
      ctx.fillStyle = pal.ink;
      ctx.font = 'italic 600 ' + m.titleSize + 'px ' + global.FG.View.serif;
      ctx.fillText(fitText(ctx, tree.name || 'Rodokmen', W - margin * 2), W / 2, m.titleBase);
    } else {
      paperTexture(ctx, W, H, pal);
      drawFrame(ctx, W, H, margin, pal);

      // nadpis
      var title = (tree.name || 'Rodokmen').toUpperCase();
      ctx.textAlign = 'center';
      ctx.fillStyle = pal.ink;
      if ('letterSpacing' in ctx) ctx.letterSpacing = Math.round(m.titleSize * 0.09) + 'px';
      ctx.font = '600 ' + m.titleSize + 'px ' + global.FG.View.serif;
      ctx.fillText(fitText(ctx, title, W - margin * 3), W / 2, m.titleBase);
      if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';

      // ozdobná linka pod nadpisem
      var ruleW = Math.min(W - margin * 3, m.base * 0.62);
      ctx.strokeStyle = pal.frame;
      ctx.lineWidth = Math.max(1, m.base * 0.0016);
      ctx.beginPath();
      ctx.moveTo(W / 2 - ruleW / 2, m.ruleY);
      ctx.lineTo(W / 2 - m.subSize * 1.1, m.ruleY);
      ctx.moveTo(W / 2 + m.subSize * 1.1, m.ruleY);
      ctx.lineTo(W / 2 + ruleW / 2, m.ruleY);
      ctx.stroke();
      ctx.fillStyle = pal.frame;
      diamond(ctx, W / 2, m.ruleY, m.subSize * 0.42); ctx.fill();
      diamond(ctx, W / 2 - ruleW / 2, m.ruleY, m.subSize * 0.2); ctx.fill();
      diamond(ctx, W / 2 + ruleW / 2, m.ruleY, m.subSize * 0.2); ctx.fill();
    }

    // strom — rozestup pokolení volíme tak, aby jména byla co největší
    var fit = fitPage(W, H, layout, dpi, M);
    var s = fit.s;
    var drawn = fit.extra ? stretchLayout(layout, fit.extra) : layout;
    var db = drawn.bbox;

    ctx.save();
    ctx.translate(m.x + m.w / 2, m.y + m.h / 2);
    ctx.scale(s, s);
    ctx.translate(-(db.x1 + db.x2) / 2, -(db.y1 + db.y2) / 2);
    drawTree(ctx, tree, drawn, settings, pal, M);
    ctx.restore();

    var nameMM = 16 * s / dpi * 25.4;
    return {
      canvas: canvas, orientation: orient, scale: s, nameMM: nameMM,
      warn: nameMM < 2.1
        ? 'Jména vyjdou na papíře drobná (' + nameMM.toFixed(1) + ' mm). ' +
          'Pomůže menší počet pokolení, jiná orientace nebo formát A4.'
        : null
    };
  }

  /* ---------------- strom ---------------- */

  function drawTree(ctx, tree, layout, settings, pal, M) {
    var S = global.FG.Store;
    var V = global.FG.View;
    var idx = layout.index;

    var cara = pal.plain ? 1.1 : 1.8;
    ctx.lineCap = pal.plain ? 'butt' : 'round';
    ctx.lineJoin = pal.plain ? 'miter' : 'round';
    ctx.strokeStyle = pal.link;
    ctx.lineWidth = cara;

    function measure(text, font) {
      ctx.font = font;
      return ctx.measureText(text).width;
    }

    /* Na prostém listu nejsou rámečky, takže se čáry musí držet textu.
       Předpočítáme si, kde jméno začíná, končí a v jaké výšce leží. */
    var sazby = {};
    if (pal.plain) {
      layout.persons.forEach(function (n) {
        var jm = (n.person.name && n.person.name.trim()) || 'Bez jména';
        var sirka = M.NODE_W - 16;
        var roky = settings.showYears ? S.lifespan(n.person) : '';
        var sz = V.nameLayout(jm, sirka, measure);
        var vic = sz.lines.length > 1;
        var sirkyRadku = sz.lines.map(function (line) {
          return measure(sz.clip ? fitText(ctx, line, sirka) : line,
            '600 ' + sz.size + 'px ' + V.serif);
        });
        sazby[n.id] = {
          sazba: sz, roky: roky, vic: vic, sirka: sirka,
          // stejná výška pro všechna jména v řadě, ať roky mají nebo ne
          zaklad: vic ? -10 : -2,
          pul: Math.max.apply(null, sirkyRadku) / 2
        };
      });
    }
    /* svislý střed jména — tam vede spojnice k partnerovi */
    function stredJmena(n) {
      var z = sazby[n.id];
      if (!z) return n.y;
      return n.y + z.zaklad - z.sazba.size * 0.34 + (z.vic ? 8 : 0);
    }

    layout.childLinks.forEach(function (link) {
      var u = layout.unionIndex[link.unionId];
      var c = idx[link.childId];
      if (!u || !c) return;
      var ux = u.ax, uy = u.ay;
      var cy = c.y - M.NODE_H / 2;
      ctx.save();
      if (cy - uy > 20) {
        var busY = cy - Math.min(32 + (u.bus || 0) * 30, Math.max(20, cy - uy - 14));
        var dx = c.x - ux;
        // oblouk zkrátíme na délku úseku, který zatáčí — jinak čára přejede
        // roh a vrátí se, což vypadá jako smyčka
        var r = Math.min(11, Math.abs(dx) / 2, Math.abs(busY - uy), Math.abs(cy - busY));
        ctx.beginPath();
        ctx.moveTo(ux, uy);
        if (Math.abs(dx) < 0.5) {
          ctx.lineTo(c.x, cy);
        } else if (r < 0.5) {
          ctx.lineTo(ux, busY);
          ctx.lineTo(c.x, busY);
          ctx.lineTo(c.x, cy);
        } else {
          var dir = dx > 0 ? 1 : -1;
          ctx.lineTo(ux, busY - r);
          ctx.quadraticCurveTo(ux, busY, ux + dir * r, busY);
          ctx.lineTo(c.x - dir * r, busY);
          ctx.quadraticCurveTo(c.x, busY, c.x, busY + r);
          ctx.lineTo(c.x, cy);
        }
        ctx.stroke();
      } else {
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.moveTo(ux, uy);
        ctx.bezierCurveTo(ux, (uy + c.y) / 2, c.x, (uy + c.y) / 2, c.x, c.y);
        ctx.stroke();
      }
      ctx.restore();
    });

    layout.partnerLinks.forEach(function (link) {
      var a = idx[link.a], b = idx[link.b];
      if (!a || !b) return;
      var left = a.x < b.x ? a : b, right = a.x < b.x ? b : a;
      ctx.save();
      ctx.beginPath();
      if (link.arc) {
        var top = link.arcTop, r = 8, lx = left.x + 34, rx = right.x - 34;
        ctx.moveTo(lx, left.y - M.NODE_H / 2);
        ctx.lineTo(lx, top + r);
        ctx.quadraticCurveTo(lx, top, lx + r, top);
        ctx.lineTo(rx - r, top);
        ctx.quadraticCurveTo(rx, top, rx, top + r);
        ctx.lineTo(rx, right.y - M.NODE_H / 2);
      } else if (Math.abs(a.y - b.y) < 1) {
        if (pal.plain) {
          var lz = sazby[left.id], rz = sazby[right.id];
          var od = left.x + (lz ? lz.pul : M.NODE_W / 2) + 9;
          var kam = right.x - (rz ? rz.pul : M.NODE_W / 2) - 9;
          var vy = (stredJmena(left) + stredJmena(right)) / 2;
          if (kam > od) { ctx.moveTo(od, vy); ctx.lineTo(kam, vy); }
        } else {
          ctx.moveTo(left.x + M.NODE_W / 2, left.y);
          ctx.lineTo(right.x - M.NODE_W / 2, right.y);
        }
      } else {
        ctx.setLineDash([6, 6]);
        ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
      }
      ctx.stroke();
      ctx.restore();
    });

    // svazek — kosočtverec s obroučkou a obdobím trvání
    layout.unions.forEach(function (u) {
      if (pal.plain) {
        // prostý list značky nemá; jen u samostatného rodiče drobný bod,
        // ať je poznat, že druhý rodič chybí
        if (u.partners.length < 2 && u.children.length) {
          ctx.fillStyle = pal.ink;
          ctx.beginPath();
          ctx.arc(u.ax, u.ay, 2.6, 0, Math.PI * 2);
          ctx.fill();
        }
        if (u.partners.length >= 2 && u.years && settings.showYears) {
          ctx.textAlign = 'left';
          ctx.fillStyle = pal.muted;
          ctx.font = 'italic 11px ' + V.serif;
          ctx.fillText(u.years, u.ax + 7, u.ay - 5);
        }
        return;
      }
      if (u.partners.length < 2) {
        // rodič bez partnera — prázdný kosočtverec tam, kde začíná větev
        if (!u.children.length) return;
        ctx.fillStyle = pal.card;
        ctx.strokeStyle = pal.accent;
        ctx.lineWidth = 1.4;
        diamond(ctx, u.ax, u.ay, 6);
        ctx.fill(); ctx.stroke();
        ctx.strokeStyle = pal.link;
        ctx.lineWidth = cara;
        return;
      }
      ctx.fillStyle = pal.accent;
      diamond(ctx, u.x, u.y, 6.5); ctx.fill();
      if (u.years && settings.showYears) {
        ctx.strokeStyle = pal.accent;
        ctx.lineWidth = 0.9;
        ctx.globalAlpha = 0.5;
        diamond(ctx, u.x, u.y, 10); ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.textAlign = 'left';
        ctx.fillStyle = pal.muted;
        ctx.font = 'italic 11px ' + V.serif;
        ctx.fillText(u.years, u.ax + 9, u.ay + 20);
      }
      ctx.strokeStyle = pal.link;
      ctx.lineWidth = cara;
    });

    layout.persons.forEach(function (n) {
      var p = n.person;
      var isFocus = n.id === layout.focusId;

      if (pal.plain) {
        // Prostý list: žádná plaketa, jen jméno a pod ním roky —
        // tak, jak se rodokmeny sázejí v dodatcích knih.
        var z = sazby[n.id];
        ctx.textAlign = 'center';
        ctx.fillStyle = pal.ink;
        z.sazba.lines.forEach(function (line, i) {
          ctx.font = '600 ' + z.sazba.size + 'px ' + V.serif;
          ctx.fillText(z.sazba.clip ? fitText(ctx, line, z.sirka) : line,
            n.x, n.y + z.zaklad + i * 16);
        });
        if (z.roky) {
          ctx.font = '12px ' + V.serif;
          ctx.fillStyle = pal.muted;
          ctx.fillText(fitText(ctx, z.roky, z.sirka),
            n.x, n.y + z.zaklad + (z.vic ? 2 : 1) * 16 + 3);
        }
        return;
      }

      // stín pod plaketou
      ctx.save();
      ctx.shadowColor = pal.dark ? 'rgba(0,0,0,.55)' : 'rgba(80,58,26,.22)';
      ctx.shadowBlur = 7; ctx.shadowOffsetY = 3;
      ctx.fillStyle = pal.card;
      plaque(ctx, n.x, n.y, M.NODE_W, M.NODE_H, 10);
      ctx.fill();
      ctx.restore();

      ctx.strokeStyle = isFocus ? pal.accent : pal.cardEdge;
      ctx.lineWidth = isFocus ? 2.4 : 1.3;
      plaque(ctx, n.x, n.y, M.NODE_W, M.NODE_H, 10);
      ctx.stroke();

      ctx.strokeStyle = isFocus ? pal.accent : pal.cardLine;
      ctx.lineWidth = 0.9;
      ctx.globalAlpha = isFocus ? 0.7 : 0.9;
      plaque(ctx, n.x, n.y, M.NODE_W - 9, M.NODE_H - 9, 7);
      ctx.stroke();
      ctx.globalAlpha = 1;

      var name = (p.name && p.name.trim()) || 'Bez jména';
      var maxW = M.NODE_W - 30;
      var years = settings.showYears ? S.lifespan(p) : '';
      var nl = V.nameLayout(name, maxW, measure);
      var two = nl.lines.length > 1;
      var y0 = two ? (years ? -17 : -5) : (years ? -8 : 5);

      ctx.textAlign = 'center';
      ctx.fillStyle = pal.ink;
      nl.lines.forEach(function (line, i) {
        ctx.font = '600 ' + nl.size + 'px ' + V.serif;
        ctx.fillText(nl.clip ? fitText(ctx, line, maxW) : line, n.x, n.y + y0 + i * 15);
      });

      if (years) {
        var ry = two ? 9 : 5;
        ctx.strokeStyle = pal[p.gender] || pal.x;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.75;
        ctx.beginPath();
        ctx.moveTo(n.x - 26, n.y + ry); ctx.lineTo(n.x + 26, n.y + ry);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.fillStyle = pal.muted;
        ctx.font = 'italic 12px ' + V.serif;
        ctx.fillText(fitText(ctx, years, maxW), n.x, n.y + ry + 17);
      }
    });
  }

  function download(canvas, filename, onDone) {
    canvas.toBlob(function (blob) {
      global.FG.Files.save(filename, blob, 'image/png', onDone);
    }, 'image/png');
  }

  global.FG = global.FG || {};
  global.FG.Export = { render: render, download: download, PAPER: PAPER };
})(window);
