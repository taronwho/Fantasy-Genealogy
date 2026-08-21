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
    }
  };

  function mm2px(mm, dpi) { return Math.round(mm / 25.4 * dpi); }

  /* rozvržení stránky — plocha, která zbude na strom po nadpisu a patičce */
  function pageMetrics(W, H) {
    var base = Math.min(W, H);
    var margin = Math.round(base * 0.055);
    var footH = Math.round(base * 0.03);
    var titleSize = Math.round(base * 0.05);
    var subSize = Math.round(base * 0.023);
    var titleBase = margin + titleSize * 1.05;
    var subBase = titleBase + subSize * 2.05;
    var ruleY = subBase + subSize * 1.35;
    var top = ruleY + subSize * 1.1;
    return {
      base: base, margin: margin, footH: footH,
      titleSize: titleSize, subSize: subSize,
      titleBase: titleBase, subBase: subBase, ruleY: ruleY,
      pad: Math.round(base * 0.012),
      x: margin, y: top,
      w: W - margin * 2,
      h: H - top - footH - margin * 1.1
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
    var unionIndex = {};
    var unions = layout.unions.map(function (u) {
      var first = idx[u.partners[0]];
      var c = {
        id: u.id, x: u.x, y: first ? first.y : u.y,
        partners: u.partners, children: u.children
      };
      unionIndex[c.id] = c;
      return c;
    });
    var b = layout.bbox;
    var span = (layout.maxGen - layout.minGen) * extra;
    return {
      focusId: layout.focusId, persons: persons, unions: unions,
      childLinks: layout.childLinks, partnerLinks: layout.partnerLinks,
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

    paperTexture(ctx, W, H, pal);
    drawFrame(ctx, W, H, margin, pal);

    // nadpis
    var focus = tree.people[layout.focusId];
    var title = (tree.name || 'Rodokmen').toUpperCase();
    ctx.textAlign = 'center';
    ctx.fillStyle = pal.ink;
    if ('letterSpacing' in ctx) ctx.letterSpacing = Math.round(m.titleSize * 0.09) + 'px';
    ctx.font = '600 ' + m.titleSize + 'px ' + global.FG.View.serif;
    ctx.fillText(fitText(ctx, title, W - margin * 3), W / 2, m.titleBase);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';

    ctx.font = 'italic ' + m.subSize + 'px ' + global.FG.View.serif;
    ctx.fillStyle = pal.muted;
    var genSpan = layout.maxGen - layout.minGen + 1;
    var sub = focus ? 'rod postavy ' + ((focus.name || '').trim() || 'bez jména') : '';
    sub += sub ? '  ·  ' : '';
    sub += genSpan + ' pokolení  ·  ' + layout.persons.length + ' ' + czOsob(layout.persons.length);
    ctx.fillText(fitText(ctx, sub, W - margin * 3), W / 2, m.subBase);

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

    // patička
    ctx.textAlign = 'center';
    ctx.fillStyle = pal.muted;
    ctx.font = 'italic ' + Math.round(m.base * 0.018) + 'px ' + global.FG.View.serif;
    ctx.fillText('❧  Kroniky rodů  ·  ' + new Date().toLocaleDateString('cs-CZ') + '  ❧',
      W / 2, H - margin * 0.95);

    var nameMM = 16 * s / dpi * 25.4;
    return {
      canvas: canvas, orientation: orient, scale: s, nameMM: nameMM,
      warn: nameMM < 2.1
        ? 'Jména vyjdou na papíře drobná (' + nameMM.toFixed(1) + ' mm). ' +
          'Pomůže menší počet pokolení, jiná orientace nebo formát A4.'
        : null
    };
  }

  function czOsob(n) {
    if (n === 1) return 'osoba';
    if (n >= 2 && n <= 4) return 'osoby';
    return 'osob';
  }

  /* ---------------- strom ---------------- */

  function drawTree(ctx, tree, layout, settings, pal, M) {
    var S = global.FG.Store;
    var V = global.FG.View;
    var idx = layout.index;

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = pal.link;
    ctx.lineWidth = 1.8;

    layout.childLinks.forEach(function (link) {
      var u = layout.unionIndex[link.unionId];
      var c = idx[link.childId];
      if (!u || !c) return;
      var uy = u.y + M.NODE_H / 2;
      var cy = c.y - M.NODE_H / 2;
      ctx.save();
      if (cy - uy > 20) {
        var busY = cy - Math.min(48, (cy - uy) / 2);
        var r = 11;
        ctx.beginPath();
        ctx.moveTo(u.x, uy);
        if (Math.abs(c.x - u.x) < 1) {
          ctx.lineTo(c.x, cy);
        } else {
          var dir = c.x > u.x ? 1 : -1;
          ctx.lineTo(u.x, busY - r);
          ctx.quadraticCurveTo(u.x, busY, u.x + dir * r, busY);
          ctx.lineTo(c.x - dir * r, busY);
          ctx.quadraticCurveTo(c.x, busY, c.x, busY + r);
          ctx.lineTo(c.x, cy);
        }
        ctx.stroke();
      } else {
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.moveTo(u.x, u.y);
        ctx.bezierCurveTo(u.x, (u.y + c.y) / 2, c.x, (u.y + c.y) / 2, c.x, c.y);
        ctx.stroke();
      }
      ctx.restore();
    });

    layout.partnerLinks.forEach(function (link) {
      var a = idx[link.a], b = idx[link.b];
      if (!a || !b) return;
      ctx.save();
      ctx.beginPath();
      if (Math.abs(a.y - b.y) < 1) {
        var left = a.x < b.x ? a : b, right = a.x < b.x ? b : a;
        ctx.moveTo(left.x + M.NODE_W / 2, left.y);
        ctx.lineTo(right.x - M.NODE_W / 2, right.y);
      } else {
        ctx.setLineDash([6, 6]);
        ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
      }
      ctx.stroke();
      ctx.restore();
    });

    // svazek — kosočtverec s obroučkou
    layout.unions.forEach(function (u) {
      if (u.partners.length < 2) return;
      ctx.fillStyle = pal.accent;
      diamond(ctx, u.x, u.y, 6.5); ctx.fill();
      ctx.strokeStyle = pal.accent;
      ctx.lineWidth = 0.9;
      ctx.globalAlpha = 0.5;
      diamond(ctx, u.x, u.y, 10); ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = pal.link;
      ctx.lineWidth = 1.8;
    });

    function measure(text, font) {
      ctx.font = font;
      return ctx.measureText(text).width;
    }

    layout.persons.forEach(function (n) {
      var p = n.person;
      var isFocus = n.id === layout.focusId;

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

  function download(canvas, filename) {
    canvas.toBlob(function (blob) {
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 500);
    }, 'image/png');
  }

  global.FG = global.FG || {};
  global.FG.Export = { render: render, download: download, PAPER: PAPER };
})(window);
