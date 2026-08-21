/* Kroniky rodů — vykreslení stromu do SVG + ovládání plátna */
(function (global) {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var M = null;

  function el(name, attrs, parent) {
    var e = document.createElementNS(NS, name);
    if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  var measureCtx = document.createElement('canvas').getContext('2d');
  function textWidth(text, font) {
    measureCtx.font = font;
    return measureCtx.measureText(text).width;
  }
  function fitText(text, font, maxW) {
    if (textWidth(text, font) <= maxW) return text;
    var t = text;
    while (t.length > 1 && textWidth(t + '…', font) > maxW) t = t.slice(0, -1);
    return t + '…';
  }

  function elbow(ux, uy, cx, cy, busY, r) {
    var d = 'M' + ux + ' ' + uy + ' V' + (busY - Math.sign(busY - uy) * r);
    if (Math.abs(cx - ux) < 1) return 'M' + ux + ' ' + uy + ' V' + cy;
    var dir = cx > ux ? 1 : -1;
    d = 'M' + ux + ' ' + uy +
      ' V' + (busY - r) +
      ' Q' + ux + ' ' + busY + ' ' + (ux + dir * r) + ' ' + busY +
      ' H' + (cx - dir * r) +
      ' Q' + cx + ' ' + busY + ' ' + cx + ' ' + (busY + r) +
      ' V' + cy;
    return d;
  }

  /* sazba jmena do karty: 16px -> 14px -> dva radky -> zkraceni */
  function nameLayout(text, maxW, measure) {
    function font(sz) { return '600 ' + sz + 'px ' + View.serif; }
    if (measure(text, font(16)) <= maxW) return { size: 16, lines: [text] };
    if (measure(text, font(14)) <= maxW) return { size: 14, lines: [text] };
    var words = text.split(/\s+/);
    if (words.length > 1) {
      var best = null;
      for (var i = 1; i < words.length; i++) {
        var a = words.slice(0, i).join(' '), b = words.slice(i).join(' ');
        var wa = measure(a, font(14)), wb = measure(b, font(14));
        if (wa <= maxW && wb <= maxW) {
          var d = Math.abs(wa - wb);
          if (!best || d < best.d) best = { a: a, b: b, d: d };
        }
      }
      if (best) return { size: 14, lines: [best.a, best.b] };
    }
    return { size: 14, lines: [text], clip: true };
  }

  var View = {
    svg: null, viewport: null, host: null,
    gLinks: null, gNodes: null, gUnions: null,
    t: { x: 0, y: 0, k: 1 },
    layout: null, tree: null,
    selectedId: null,
    onAction: function () {},
    onSelect: function () {},

    init: function (host) {
      M = global.FG.Layout.M;
      this.host = host;
      this.svg = el('svg', { class: 'canvas' }, host);
      var defs = el('defs', null, this.svg);
      var glow = el('filter', { id: 'softshadow', x: '-30%', y: '-30%', width: '160%', height: '160%' }, defs);
      el('feDropShadow', { dx: 0, dy: 2, stdDeviation: 3, 'flood-opacity': 0.18 }, glow);
      this.viewport = el('g', { class: 'viewport' }, this.svg);
      this.gLinks = el('g', { class: 'links' }, this.viewport);
      this.gUnions = el('g', { class: 'unions' }, this.viewport);
      this.gNodes = el('g', { class: 'nodes' }, this.viewport);
      this.bindPointer();
      return this;
    },

    /* ---------- transformace ---------- */

    applyTransform: function () {
      this.viewport.setAttribute('transform',
        'translate(' + this.t.x + ',' + this.t.y + ') scale(' + this.t.k + ')');
      if (this.selectedId) this.onSelect(this.selectedId, this.screenPos(this.selectedId));
    },

    screenPos: function (id) {
      var n = this.layout && this.layout.index[id];
      if (!n) return null;
      return { x: n.x * this.t.k + this.t.x, y: n.y * this.t.k + this.t.y, k: this.t.k };
    },

    size: function () {
      var r = this.host.getBoundingClientRect();
      return { w: r.width, h: r.height };
    },

    tweenTo: function (target, ms) {
      var self = this, from = { x: this.t.x, y: this.t.y, k: this.t.k };
      var t0 = performance.now();
      ms = ms || 320;
      if (this._raf) cancelAnimationFrame(this._raf);
      function step(now) {
        var p = Math.min(1, (now - t0) / ms);
        var e = p < 0.5 ? 2 * p * p : -1 + (4 - 2 * p) * p;
        self.t.x = from.x + (target.x - from.x) * e;
        self.t.y = from.y + (target.y - from.y) * e;
        self.t.k = from.k + (target.k - from.k) * e;
        self.applyTransform();
        if (p < 1) self._raf = requestAnimationFrame(step);
      }
      this._raf = requestAnimationFrame(step);
    },

    fit: function (animate) {
      if (!this.layout) return;
      var s = this.size(), b = this.layout.bbox;
      var pad = 70;
      var k = Math.min((s.w - pad * 2) / Math.max(b.w, 1), (s.h - pad * 2) / Math.max(b.h, 1));
      k = Math.max(0.12, Math.min(1, k));
      var cx = (b.x1 + b.x2) / 2, cy = (b.y1 + b.y2) / 2;
      var target = { k: k, x: s.w / 2 - cx * k, y: s.h / 2 - cy * k };
      if (animate) this.tweenTo(target); else { this.t = target; this.applyTransform(); }
    },

    centerOn: function (id, animate, keepZoom) {
      var n = this.layout && this.layout.index[id];
      if (!n) return;
      var s = this.size();
      var k = keepZoom ? this.t.k : Math.max(0.5, Math.min(this.t.k, 1));
      var target = { k: k, x: s.w / 2 - n.x * k, y: s.h / 2 - n.y * k };
      if (animate) this.tweenTo(target); else { this.t = target; this.applyTransform(); }
    },

    zoomBy: function (f) {
      var s = this.size();
      var cx = s.w / 2, cy = s.h / 2;
      var k = Math.max(0.08, Math.min(3, this.t.k * f));
      this.t.x = cx - (cx - this.t.x) * (k / this.t.k);
      this.t.y = cy - (cy - this.t.y) * (k / this.t.k);
      this.t.k = k;
      this.applyTransform();
    },

    /* ---------- ovládání ---------- */

    bindPointer: function () {
      var self = this, pointers = {}, panning = false, moved = false;
      var last = null, pinch = null, downTarget = null;

      this.svg.addEventListener('wheel', function (ev) {
        ev.preventDefault();
        var rect = self.svg.getBoundingClientRect();
        var mx = ev.clientX - rect.left, my = ev.clientY - rect.top;
        var f = ev.deltaY < 0 ? 1.12 : 1 / 1.12;
        var k = Math.max(0.08, Math.min(3, self.t.k * f));
        self.t.x = mx - (mx - self.t.x) * (k / self.t.k);
        self.t.y = my - (my - self.t.y) * (k / self.t.k);
        self.t.k = k;
        self.applyTransform();
      }, { passive: false });

      this.svg.addEventListener('pointerdown', function (ev) {
        pointers[ev.pointerId] = { x: ev.clientX, y: ev.clientY };
        var ids = Object.keys(pointers);
        if (ids.length === 1) {
          panning = true; moved = false;
          downTarget = ev.target;
          last = { x: ev.clientX, y: ev.clientY };
          self.svg.setPointerCapture(ev.pointerId);
        } else if (ids.length === 2) {
          panning = false;
          pinch = self.pinchState(pointers);
        }
      });

      this.svg.addEventListener('pointermove', function (ev) {
        if (!pointers[ev.pointerId]) return;
        pointers[ev.pointerId] = { x: ev.clientX, y: ev.clientY };
        var ids = Object.keys(pointers);
        if (ids.length >= 2 && pinch) {
          var now = self.pinchState(pointers);
          var k = Math.max(0.08, Math.min(3, self.t.k * (now.d / pinch.d)));
          var rect = self.svg.getBoundingClientRect();
          var mx = now.cx - rect.left, my = now.cy - rect.top;
          self.t.x = mx - (mx - self.t.x - (now.cx - pinch.cx)) * (k / self.t.k);
          self.t.y = my - (my - self.t.y - (now.cy - pinch.cy)) * (k / self.t.k);
          self.t.k = k;
          pinch = now;
          self.applyTransform();
          moved = true;
          return;
        }
        if (!panning) return;
        var dx = ev.clientX - last.x, dy = ev.clientY - last.y;
        if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
        last = { x: ev.clientX, y: ev.clientY };
        self.t.x += dx; self.t.y += dy;
        self.applyTransform();
      });

      function up(ev) {
        delete pointers[ev.pointerId];
        if (Object.keys(pointers).length < 2) pinch = null;
        if (!Object.keys(pointers).length) {
          if (panning && !moved) self.handleTap(downTarget || ev.target);
          panning = false;
        }
      }
      this.svg.addEventListener('pointerup', up);
      this.svg.addEventListener('pointercancel', up);
      this.svg.addEventListener('dblclick', function (ev) {
        var g = ev.target.closest ? ev.target.closest('.node') : null;
        if (g) self.onAction('focus', g.getAttribute('data-id'));
      });
    },

    pinchState: function (pointers) {
      var ids = Object.keys(pointers);
      var a = pointers[ids[0]], b = pointers[ids[1]];
      return {
        d: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
        cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2
      };
    },

    handleTap: function (target) {
      var chip = target.closest ? target.closest('.chip') : null;
      if (chip) {
        this.onAction(chip.getAttribute('data-chip'), chip.getAttribute('data-id'));
        return;
      }
      var g = target.closest ? target.closest('.node') : null;
      if (g) {
        var id = g.getAttribute('data-id');
        this.select(id);
      } else {
        this.select(null);
      }
    },

    select: function (id) {
      this.selectedId = id;
      var nodes = this.gNodes.querySelectorAll('.node');
      for (var i = 0; i < nodes.length; i++) {
        nodes[i].classList.toggle('is-selected', nodes[i].getAttribute('data-id') === id);
      }
      if (id) this.ensureVisible(id);
      this.onSelect(id, id ? this.screenPos(id) : null);
    },

    /* posune (a v případě potřeby přiblíží) plátno, aby se kolem karty
       vešla kruhová nabídka */
    ensureVisible: function (id) {
      var n = this.layout && this.layout.index[id];
      if (!n) return;
      var s0 = this.size();
      var minK = 0.75;
      if (this.t.k < minK) {
        this.tweenTo({
          k: minK, x: s0.w / 2 - n.x * minK, y: s0.h / 2 - n.y * minK
        }, 260);
        return;
      }
      var p = this.screenPos(id);
      if (!p) return;
      var s = this.size(), pad = 170;
      var dx = 0, dy = 0;
      if (p.x < pad) dx = pad - p.x;
      if (p.x > s.w - pad) dx = s.w - pad - p.x;
      if (p.y < pad) dy = pad - p.y;
      if (p.y > s.h - pad) dy = s.h - pad - p.y;
      if (dx || dy) this.tweenTo({ x: this.t.x + dx, y: this.t.y + dy, k: this.t.k }, 220);
    },

    /* ---------- vykreslení ---------- */

    render: function (tree, layout, settings) {
      this.tree = tree;
      this.layout = layout;
      var S = global.FG.Store;
      this.gLinks.textContent = '';
      this.gUnions.textContent = '';
      this.gNodes.textContent = '';

      var idx = layout.index;

      // linky rodič → dítě
      layout.childLinks.forEach(function (link) {
        var u = layout.unionIndex[link.unionId];
        var c = idx[link.childId];
        if (!u || !c) return;
        var uy = u.y + M.NODE_H / 2;
        var cy = c.y - M.NODE_H / 2;
        var cls = 'link-child';
        var d;
        if (cy - uy > 20) {
          var busY = cy - Math.min(46, (cy - uy) / 2);
          d = elbow(u.x, uy, c.x, cy, busY, 12);
        } else {
          cls += ' link-remote';
          d = 'M' + u.x + ' ' + u.y + ' C' + u.x + ' ' + ((u.y + c.y) / 2) +
            ' ' + c.x + ' ' + ((u.y + c.y) / 2) + ' ' + c.x + ' ' + c.y;
        }
        el('path', { d: d, class: cls }, View.gLinks);
      });

      // linky partnerů
      layout.partnerLinks.forEach(function (link) {
        var a = idx[link.a], b = idx[link.b];
        if (!a || !b) return;
        var cls = 'link-partner';
        var d;
        if (Math.abs(a.y - b.y) < 1) {
          var left = a.x < b.x ? a : b, right = a.x < b.x ? b : a;
          d = 'M' + (left.x + M.NODE_W / 2) + ' ' + left.y + ' H' + (right.x - M.NODE_W / 2);
        } else {
          cls += ' link-remote';
          d = 'M' + a.x + ' ' + a.y + ' L' + b.x + ' ' + b.y;
        }
        el('path', { d: d, class: cls }, View.gLinks);
      });

      // značky svazků
      layout.unions.forEach(function (u) {
        if (u.partners.length < 2) return;
        var g = el('g', { class: 'union', transform: 'translate(' + u.x + ',' + u.y + ')' }, View.gUnions);
        el('path', { d: 'M0 -7 L7 0 L0 7 L-7 0 Z', class: 'union-mark' }, g);
      });

      // karty osob — plakety s useknutými rohy
      layout.persons.forEach(function (n) {
        var p = n.person;
        var g = el('g', {
          class: 'node' + (n.id === layout.focusId ? ' is-focus' : '') + ' g-' + (p.gender || 'x'),
          transform: 'translate(' + n.x + ',' + n.y + ')',
          'data-id': n.id
        }, View.gNodes);

        el('path', {
          d: View.plaquePath(M.NODE_W, M.NODE_H, 10),
          class: 'card', filter: 'url(#softshadow)'
        }, g);
        el('path', {
          d: View.plaquePath(M.NODE_W - 9, M.NODE_H - 9, 7),
          class: 'card-inner'
        }, g);

        var name = (p.name && p.name.trim()) || 'Bez jména';
        var maxW = M.NODE_W - 30;
        var years = settings.showYears ? S.lifespan(p) : '';
        var nl = nameLayout(name, maxW, textWidth);
        var two = nl.lines.length > 1;
        var y0 = two ? (years ? -17 : -5) : (years ? -8 : 5);
        nl.lines.forEach(function (line, i) {
          var t = el('text', {
            class: 'n-name', x: 0, y: y0 + i * 15, 'text-anchor': 'middle',
            'font-size': nl.size
          }, g);
          t.textContent = nl.clip
            ? fitText(line, '600 ' + nl.size + 'px ' + View.serif, maxW) : line;
        });
        if (years) {
          var ry = two ? 9 : 5;
          el('path', {
            d: 'M-26 ' + ry + ' H26', class: 'n-rule'
          }, g);
          var t2 = el('text', {
            class: 'n-years', x: 0, y: ry + 17, 'text-anchor': 'middle'
          }, g);
          t2.textContent = fitText(years, 'italic 12px ' + View.sans, maxW);
        }
        if (settings.showNotes && p.note && p.note.trim()) {
          var note = el('g', {
            class: 'n-note',
            transform: 'translate(' + (M.NODE_W / 2 - 13) + ',' + (-M.NODE_H / 2 + 13) + ')'
          }, g);
          el('path', { d: 'M0 -5 L5 0 L0 5 L-5 0 Z', class: 'note-dot' }, note);
        }

        if (n.hidden.up > 0) View.chip(g, n, 'up');
        if (n.hidden.down > 0) View.chip(g, n, 'down');
      });

      if (this.selectedId && !idx[this.selectedId]) this.selectedId = null;
      this.select(this.selectedId);
    },

    /* obdélník s useknutými rohy */
    plaquePath: function (w, h, b) {
      var x = w / 2, y = h / 2;
      return 'M' + (-x + b) + ' ' + (-y) +
        ' H' + (x - b) + ' L' + x + ' ' + (-y + b) +
        ' V' + (y - b) + ' L' + (x - b) + ' ' + y +
        ' H' + (-x + b) + ' L' + (-x) + ' ' + (y - b) +
        ' V' + (-y + b) + ' Z';
    },

    chip: function (g, n, dir) {
      var y = dir === 'up' ? -M.NODE_H / 2 - 13 : M.NODE_H / 2 + 13;
      var count = dir === 'up' ? n.hidden.up : n.hidden.down;
      var c = el('g', {
        class: 'chip', transform: 'translate(0,' + y + ')',
        'data-chip': dir === 'up' ? 'expand-up' : 'expand-down',
        'data-id': n.id
      }, g);
      el('rect', { x: -19, y: -11, width: 38, height: 22, rx: 11, class: 'chip-bg' }, c);
      var t = el('text', { y: 4, 'text-anchor': 'middle', class: 'chip-text' }, c);
      t.textContent = (dir === 'up' ? '▲ ' : '▼ ') + count;
    },

    serif: '"Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif',
    sans: 'system-ui,-apple-system,"Segoe UI",Roboto,sans-serif'
  };

  View.nameLayout = nameLayout;
  View.fitText = fitText;

  global.FG = global.FG || {};
  global.FG.View = View;
})(window);
