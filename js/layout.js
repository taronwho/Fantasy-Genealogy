/* Kroniky rodů — rozvržení stromu
 * Postup:
 *   1) viditelnost — od zaměřené postavy nahoru (předci) a dolů (potomci) podle limitů
 *   2) rekurzivní „tidy" rozmístění (obrysové balení podstromů)
 *   3) závěrečný průchod po generacích, který zaručí, že se karty nepřekrývají
 */
(function (global) {
  'use strict';

  var M = {
    NODE_W: 178,
    NODE_H: 78,
    ROW_H: 172,
    PARTNER_GAP: 30,   // mezera mezi kartami partnerů
    SIB_GAP: 32,       // mezera mezi sourozeneckými podstromy
    BLOCK_GAP: 60,     // mezera mezi nespojenými bloky
    MIN_GAP: 24        // minimální mezera při závěrečném rozestupu
  };

  function key(g) { return 'g' + g; }

  function newBlock() {
    return { nodes: [], unions: [], contour: {}, anchor: 0 };
  }

  function addToContour(contour, gen, min, max) {
    var k = key(gen), c = contour[k];
    if (!c) contour[k] = [min, max];
    else { c[0] = Math.min(c[0], min); c[1] = Math.max(c[1], max); }
  }

  function shiftBlock(b, dx) {
    if (!dx) return b;
    b.nodes.forEach(function (n) { n.x += dx; });
    b.unions.forEach(function (u) { u.x += dx; });
    var nc = {};
    for (var k in b.contour) nc[k] = [b.contour[k][0] + dx, b.contour[k][1] + dx];
    b.contour = nc;
    b.anchor += dx;
    return b;
  }

  function mergeInto(target, src) {
    src.nodes.forEach(function (n) { target.nodes.push(n); });
    src.unions.forEach(function (u) { target.unions.push(u); });
    for (var k in src.contour) {
      addToContour(target.contour, k.slice(1), src.contour[k][0], src.contour[k][1]);
    }
    return target;
  }

  /* posune blok tak, aby nekolidoval s dosud sloučeným obrysem */
  function packAfter(contour, block, gap) {
    var shift = -Infinity;
    for (var k in block.contour) {
      if (contour[k]) {
        shift = Math.max(shift, contour[k][1] + gap - block.contour[k][0]);
      }
    }
    if (shift === -Infinity) shift = 0;
    return shiftBlock(block, shift);
  }

  function packRow(blocks, gap) {
    var out = newBlock();
    var first = true;
    blocks.forEach(function (b) {
      if (!b) return;
      if (!first) packAfter(out.contour, b, gap);
      mergeInto(out, b);
      first = false;
    });
    return out;
  }

  function rowCenter(block, gen) {
    var c = block.contour[key(gen)];
    if (!c) return block.anchor;
    return (c[0] + c[1]) / 2;
  }

  /* ------------------------------------------------------------------ */

  function compute(tree, opts) {
    opts = opts || {};
    var S = global.FG.Store;
    var focusId = opts.focusId || tree.focusId;
    if (!focusId || !tree.people[focusId]) {
      focusId = Object.keys(tree.people)[0];
    }
    var up = opts.up === undefined ? Infinity : opts.up;
    var down = opts.down === undefined ? Infinity : opts.down;
    var collateral = opts.collateral || 'siblings';
    var showPartners = opts.showPartners !== false;

    var result = {
      focusId: focusId, persons: [], unions: [], childLinks: [], partnerLinks: [],
      index: {}, unionIndex: {}, bbox: { x1: 0, y1: 0, x2: 0, y2: 0 },
      gen: {}, minGen: 0, maxGen: 0, truncated: false
    };
    if (!focusId) return result;

    /* --- 1) viditelnost --------------------------------------------- */
    var gen = {};
    var vis = {};
    var role = {};

    function see(id, g, r) {
      if (vis[id]) return false;
      vis[id] = true; gen[id] = g; role[id] = r;
      return true;
    }

    see(focusId, 0, 'focus');

    // předci
    var q = [focusId];
    while (q.length) {
      var cur = q.shift();
      var g = gen[cur];
      if (-(g - 1) > up) continue;
      S.parentsOf(tree, cur).forEach(function (pid) {
        if (see(pid, g - 1, 'ancestor')) q.push(pid);
      });
    }

    // výchozí body pro potomky
    var seeds = [focusId];
    if (collateral === 'siblings') {
      S.siblingsOf(tree, focusId).forEach(function (sid) {
        if (see(sid, 0, 'sibling')) seeds.push(sid);
      });
    } else if (collateral === 'all') {
      Object.keys(vis).forEach(function (id) { seeds.push(id); });
      // sourozenci předků (strýcové, tety…) na příslušných generacích
      var grow = seeds.slice();
      while (grow.length) {
        var a = grow.shift();
        S.siblingsOf(tree, a).forEach(function (sid) {
          if (see(sid, gen[a], 'collateral')) { seeds.push(sid); }
        });
      }
    }

    // potomci
    var dq = seeds.slice();
    while (dq.length) {
      var c = dq.shift();
      var cg = gen[c];
      if (cg + 1 > down) continue;
      S.childrenOf(tree, c).forEach(function (kid) {
        if (see(kid, cg + 1, 'descendant')) dq.push(kid);
      });
    }

    // partneři (na stejné generaci, dál se z nich nerozvíjí)
    if (showPartners) {
      Object.keys(vis).forEach(function (id) {
        S.partnersOf(tree, id).forEach(function (pid) {
          see(pid, gen[id], 'partner');
        });
      });
    }

    /* viditelné svazky */
    var visUnions = {};
    Object.keys(tree.unions).forEach(function (uid) {
      var u = tree.unions[uid];
      var pv = u.partners.filter(function (x) { return vis[x]; });
      var cv = u.children.filter(function (x) { return vis[x]; });
      if (pv.length >= 2 || (pv.length >= 1 && cv.length >= 1)) {
        visUnions[uid] = { id: uid, partners: pv, children: cv };
      }
    });

    function parentUnionVisible(pid) {
      var p = tree.people[pid];
      if (!p || !p.parentUnionId) return null;
      return visUnions[p.parentUnionId] || null;
    }

    /* --- 2) rozmístění ---------------------------------------------- */
    var placed = {};
    var placedUnion = {};

    function unitBlock(personId, g) {
      var b = newBlock();
      placed[personId] = true;
      var members = [personId];
      var partners = [];
      if (showPartners) {
        S.unionsOf(tree, personId).forEach(function (u) {
          if (!visUnions[u.id]) return;
          u.partners.forEach(function (pid) {
            if (pid !== personId && vis[pid] && !placed[pid] && partners.indexOf(pid) === -1) {
              partners.push(pid);
            }
          });
        });
      }
      if (partners.length >= 2) members = [partners[0], personId].concat(partners.slice(1));
      else members = [personId].concat(partners);

      var step = M.NODE_W + M.PARTNER_GAP;
      var total = (members.length - 1) * step;
      members.forEach(function (id, i) {
        placed[id] = true;
        var x = i * step - total / 2;
        b.nodes.push({ id: id, x: x, gen: g });
        addToContour(b.contour, g, x - M.NODE_W / 2, x + M.NODE_W / 2);
      });
      var pos = {};
      b.nodes.forEach(function (n) { pos[n.id] = n.x; });
      b.anchor = pos[personId];
      b.memberPos = pos;
      return b;
    }

    /* karta osoby + celé potomstvo pod ní */
    function buildDown(personId, g) {
      if (placed[personId] || !vis[personId]) return null;
      var b = unitBlock(personId, g);

      // svazky této jednotky, kde je personId partnerem
      var unions = [];
      S.unionsOf(tree, personId).forEach(function (u) {
        var vu = visUnions[u.id];
        if (!vu || placedUnion[u.id]) return;
        var kids = vu.children.filter(function (c) { return vis[c] && !placed[c]; });
        var other = vu.partners.filter(function (x) { return x !== personId; })[0];
        var hasHere = other && b.memberPos[other] !== undefined;
        if (!kids.length && !hasHere) return;
        placedUnion[u.id] = true;
        var ux = hasHere ? (b.memberPos[personId] + b.memberPos[other]) / 2 : b.memberPos[personId];
        unions.push({ id: u.id, x: ux, gen: g, kids: kids });
      });
      unions.sort(function (a, c) { return a.x - c.x; });

      var childBlocks = [];
      var groups = [];
      unions.forEach(function (u) {
        var gb = [];
        u.kids.forEach(function (kid) {
          var kb = buildDown(kid, g + 1);
          if (kb) { gb.push(kb); childBlocks.push(kb); }
        });
        groups.push({ union: u, blocks: gb });
      });

      if (childBlocks.length) {
        var run = packRow(childBlocks, M.SIB_GAP);
        var target, cur;
        if (groups.length === 1) {
          target = groups[0].union.x;
          cur = rowCenter(run, g + 1);
        } else {
          var sum = 0, n = 0;
          groups.forEach(function (gr) {
            if (gr.blocks.length) { sum += gr.union.x * gr.blocks.length; n += gr.blocks.length; }
          });
          target = n ? sum / n : b.anchor;
          cur = rowCenter(run, g + 1);
        }
        shiftBlock(run, target - cur);
        mergeInto(b, run);
      }
      return b;
    }

    function nodeX(block, id) {
      for (var i = 0; i < block.nodes.length; i++) {
        if (block.nodes[i].id === id) return block.nodes[i].x;
      }
      return null;
    }

    /* karty rodičovského páru vedle sebe, střed páru = 0 */
    function coupleBlock(ids, g) {
      var b = newBlock();
      var step = M.NODE_W + M.PARTNER_GAP;
      var total = (ids.length - 1) * step;
      ids.forEach(function (id, i) {
        placed[id] = true;
        var x = i * step - total / 2;
        b.nodes.push({ id: id, x: x, gen: g });
        addToContour(b.contour, g, x - M.NODE_W / 2, x + M.NODE_W / 2);
      });
      b.anchor = 0;
      return b;
    }

    /* rozšíří blok o rodiče nad osobou a o její sourozence po stranách */
    function buildUp(personId, g, block, isSpine) {
      var vu = parentUnionVisible(personId);
      if (!vu || placedUnion[vu.id]) return block;
      placedUnion[vu.id] = true;

      var wantSiblings = collateral === 'all' ||
        (collateral === 'siblings' && isSpine && g === 0);

      // sourozenci — starší nalevo, mladší napravo (podle pořadí v datech)
      var before = [], after = [], seenSelf = false;
      tree.unions[vu.id].children.forEach(function (cid) {
        if (cid === personId) { seenSelf = true; return; }
        if (!vis[cid] || placed[cid] || !wantSiblings) return;
        var sb = buildDown(cid, g);
        if (sb) (seenSelf ? after : before).push(sb);
      });
      var row = packRow(before.concat([block], after), M.SIB_GAP);

      // rodičovský pár nad středem svých dětí
      var parents = vu.partners.filter(function (q) { return vis[q] && !placed[q]; });
      if (!parents.length) return row;
      var couple = coupleBlock(parents, g - 1);

      var xs = [];
      tree.unions[vu.id].children.forEach(function (cid) {
        var x = nodeX(row, cid);
        if (x !== null) xs.push(x);
      });
      var targetX = xs.length
        ? (Math.min.apply(null, xs) + Math.max.apply(null, xs)) / 2
        : (nodeX(row, personId) || 0);
      shiftBlock(couple, targetX);
      mergeInto(row, couple);

      // další rodiny rodičů (nevlastní sourozenci)
      parents.forEach(function (q) {
        var extras = [];
        S.unionsOf(tree, q).forEach(function (u) {
          if (u.id === vu.id || !visUnions[u.id] || placedUnion[u.id]) return;
          var kids = visUnions[u.id].children.filter(function (c) { return vis[c] && !placed[c]; });
          var other = visUnions[u.id].partners.filter(function (x) { return x !== q; })[0];
          if (!kids.length && !(other && vis[other] && !placed[other])) return;
          placedUnion[u.id] = true;
          if (other && vis[other] && !placed[other]) {
            var ob = coupleBlock([other], g - 1);
            extras.push(ob);
          }
          kids.forEach(function (kid) {
            var kb = buildDown(kid, g);
            if (kb) extras.push(kb);
          });
        });
        extras.forEach(function (eb) {
          packAfter(row.contour, eb, M.SIB_GAP);
          mergeInto(row, eb);
        });
      });

      // předci obou rodičů — pracují už nad celým dosud sestaveným blokem
      parents.forEach(function (q) {
        row = buildUp(q, g - 1, row, false);
      });
      return row;
    }

    var main = buildDown(focusId, 0);
    main = buildUp(focusId, 0, main, true);

    // cokoliv zbylo (oddělené větve) přibalíme vedle
    var leftovers = [];
    Object.keys(vis).forEach(function (id) {
      if (placed[id]) return;
      var vu = parentUnionVisible(id);
      if (vu && vu.partners.some(function (p) { return vis[p] && !placed[p]; })) return;
      var lb = buildDown(id, gen[id]);
      if (lb) leftovers.push(lb);
    });
    Object.keys(vis).forEach(function (id) {
      if (placed[id]) return;
      var lb = buildDown(id, gen[id]);
      if (lb) leftovers.push(lb);
    });
    leftovers.forEach(function (lb) {
      packAfter(main.contour, lb, M.BLOCK_GAP);
      mergeInto(main, lb);
    });

    /* --- 3) rozestupy po generacích --------------------------------- */
    var byGen = {};
    main.nodes.forEach(function (n) {
      (byGen[n.gen] = byGen[n.gen] || []).push(n);
    });
    Object.keys(byGen).forEach(function (g) {
      var row = byGen[g].sort(function (a, b) { return a.x - b.x; });
      for (var i = 1; i < row.length; i++) {
        var need = row[i - 1].x + M.NODE_W + M.MIN_GAP;
        if (row[i].x < need) row[i].x = need;
      }
    });

    /* --- 4) výstup --------------------------------------------------- */
    var pos = {};
    main.nodes.forEach(function (n) { pos[n.id] = n; });
    var focusNode = pos[focusId];
    var ox = focusNode ? focusNode.x : 0;

    var minGen = Infinity, maxGen = -Infinity;
    main.nodes.forEach(function (n) {
      var p = tree.people[n.id];
      if (!p) return;
      var node = {
        id: n.id, person: p, gen: n.gen, role: role[n.id] || 'other',
        x: n.x - ox, y: n.gen * M.ROW_H,
        w: M.NODE_W, h: M.NODE_H,
        hidden: hiddenCounts(n.id)
      };
      result.persons.push(node);
      result.index[n.id] = node;
      minGen = Math.min(minGen, n.gen);
      maxGen = Math.max(maxGen, n.gen);
    });

    function hiddenCounts(id) {
      var hu = 0, hd = 0;
      S.parentsOf(tree, id).forEach(function (pid) { if (!vis[pid]) hu++; });
      S.childrenOf(tree, id).forEach(function (cid) { if (!vis[cid]) hd++; });
      return { up: hu, down: hd };
    }

    // svazky: pozice = střed mezi partnery
    var seenUnion = {};
    main.unions.forEach(function (u) { seenUnion[u.id] = true; });
    Object.keys(visUnions).forEach(function (uid) {
      var vu = visUnions[uid];
      var pts = vu.partners.map(function (p) { return result.index[p]; })
        .filter(function (n) { return !!n; });
      if (!pts.length) return;
      var x = pts.reduce(function (a, n) { return a + n.x; }, 0) / pts.length;
      var y = pts.reduce(function (a, n) { return a + n.y; }, 0) / pts.length;
      var un = {
        id: uid, x: x, y: y,
        partners: vu.partners.filter(function (p) { return !!result.index[p]; }),
        children: vu.children.filter(function (c) { return !!result.index[c]; })
      };
      result.unions.push(un);
      result.unionIndex[uid] = un;
      if (un.partners.length >= 2) {
        for (var i = 1; i < un.partners.length; i++) {
          result.partnerLinks.push({
            unionId: uid, a: un.partners[0], b: un.partners[i]
          });
        }
      }
      un.children.forEach(function (c) {
        result.childLinks.push({ unionId: uid, childId: c });
      });
    });

    var x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    result.persons.forEach(function (n) {
      x1 = Math.min(x1, n.x - n.w / 2); x2 = Math.max(x2, n.x + n.w / 2);
      y1 = Math.min(y1, n.y - n.h / 2); y2 = Math.max(y2, n.y + n.h / 2);
    });
    if (!result.persons.length) { x1 = y1 = -100; x2 = y2 = 100; }
    result.bbox = { x1: x1, y1: y1, x2: x2, y2: y2, w: x2 - x1, h: y2 - y1 };
    result.minGen = minGen === Infinity ? 0 : minGen;
    result.maxGen = maxGen === -Infinity ? 0 : maxGen;
    result.visibleCount = result.persons.length;
    result.totalCount = Object.keys(tree.people).length;
    result.truncated = result.visibleCount < result.totalCount;
    result.gen = gen;
    return result;
  }

  global.FG = global.FG || {};
  global.FG.Layout = { compute: compute, M: M };
})(window);
