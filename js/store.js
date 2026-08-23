/* Kroniky rodů — datová vrstva
 * Model:
 *   tree   = { id, name, focusId, view:{ up, down }, people:{}, unions:{} }
 *   person = { id, name, gender:'m'|'f'|'x', birth, death, note, parentUnionId }
 *   union  = { id, partners:[personId], children:[personId], note }
 * Svazek (union) drží dvojici (nebo jednotlivce) a jejich děti — díky tomu lze
 * libovolně proplétat větve: jeden člověk může být partnerem ve více svazcích.
 */
(function (global) {
  'use strict';

  var KEY = 'kroniky-rodu:v1';
  var MAX_UNDO = 60;

  function uid(prefix) {
    return (prefix || 'x') + Date.now().toString(36).slice(-5) +
      Math.random().toString(36).slice(2, 7);
  }

  function clone(v) { return JSON.parse(JSON.stringify(v)); }

  /* první číslo v zápisu roku; bez roku řadíme nakonec */
  function yearKey(text) {
    var m = /(-?\d+)/.exec(text || '');
    return m ? parseInt(m[1], 10) : Infinity;
  }

  /* při prvním spuštění se přizpůsobíme nastavení prohlížeče */
  function prefersDark() {
    try {
      var stamped = document.documentElement.getAttribute('data-theme');
      if (stamped === 'dark') return true;
      if (stamped === 'light') return false;
      return !!(global.matchMedia &&
        global.matchMedia('(prefers-color-scheme: dark)').matches);
    } catch (e) { return false; }
  }

  var Store = {
    state: null,
    undoStack: [],
    redoStack: [],
    listeners: [],
    storageOk: true,

    /* ---------- perzistence ----------
       V úložišti drží každý svět své entity jednou; rodokmen si u sebe
       pamatuje jen seznam id svých postav. Po načtení se odkazy propojí,
       takže karta ve stromu a záznam v seznamu postav je jeden objekt. */

    defaults: function () {
      return {
        version: 2,
        activeWorldId: null,
        settings: {
          theme: prefersDark() ? 'inkoust' : 'pergamen',   // pergamen | inkoust
          collateral: 'siblings',  // none | siblings | all
          showPartners: true,
          showYears: true,
          showNotes: true
        },
        worlds: {},
        worldOrder: []
      };
    },

    load: function () {
      var raw = null;
      try { raw = global.localStorage.getItem(KEY); }
      catch (e) { this.storageOk = false; }
      var data = null;
      if (raw) {
        try { data = JSON.parse(raw); } catch (e) { data = null; }
      }
      this.state = this.hydrate(data);
      if (!this.state.worldOrder.length) {
        var w = this.createWorld('Můj svět', true);
        this.state.activeWorldId = w.id;
      }
      if (!this.state.worlds[this.state.activeWorldId]) {
        this.state.activeWorldId = this.state.worldOrder[0];
      }
      this.normalize();
      return this.state;
    },

    /* z uloženého tvaru (i staršího) udělá běžící stav */
    hydrate: function (data) {
      var W = global.FG.World;
      var state = this.defaults();
      if (!data) return state;
      if (data.settings) {
        for (var k in data.settings) state.settings[k] = data.settings[k];
      }
      if (data.worlds) {
        state.worlds = data.worlds;
        state.worldOrder = data.worldOrder || Object.keys(data.worlds);
        state.activeWorldId = data.activeWorldId;
      } else if (data.trees) {
        // starší podoba: jen rodokmeny, bez světa okolo
        var world = W.blank('Můj svět');
        world.trees = data.trees;
        world.treeOrder = data.order || Object.keys(data.trees);
        world.activeTreeId = data.activeTreeId;
        Object.keys(world.trees).forEach(function (tid) {
          var t = world.trees[tid];
          Object.keys(t.people || {}).forEach(function (pid) {
            var p = t.people[pid];
            if (!p || typeof p !== 'object') return;
            p.type = 'postava';
            p.alias = p.alias || '';
            p.narod = p.narod || '';
            p.misto = p.misto || '';
            p.vzhled = p.vzhled || '';
            p.povaha = p.povaha || '';
            world.entities[pid] = p;
          });
          t.people = Object.keys(t.people || {});
        });
        state.worlds[world.id] = world;
        state.worldOrder = [world.id];
        state.activeWorldId = world.id;
      }
      // propojení rodokmenů s entitami
      Object.keys(state.worlds).forEach(function (wid) {
        var world = state.worlds[wid];
        world.entities = world.entities || {};
        world.trees = world.trees || {};
        world.treeOrder = world.treeOrder || Object.keys(world.trees);
        world.calendar = world.calendar || W.blank().calendar;
        Object.keys(world.trees).forEach(function (tid) {
          var t = world.trees[tid];
          var ids = Array.isArray(t.people) ? t.people : Object.keys(t.people || {});
          t.people = {};
          ids.forEach(function (pid) {
            if (world.entities[pid]) t.people[pid] = world.entities[pid];
          });
        });
      });
      return state;
    },

    /* opačný směr — do úložiště i do zálohy */
    serialize: function (state) {
      state = state || this.state;
      var out = {
        version: 2,
        activeWorldId: state.activeWorldId,
        settings: state.settings,
        worlds: {},
        worldOrder: state.worldOrder.slice()
      };
      Object.keys(state.worlds).forEach(function (wid) {
        var w = state.worlds[wid];
        var copy = {
          id: w.id, name: w.name, created: w.created,
          entities: w.entities,
          calendar: w.calendar,
          activeTreeId: w.activeTreeId,
          treeOrder: w.treeOrder,
          trees: {}
        };
        Object.keys(w.trees).forEach(function (tid) {
          var t = w.trees[tid];
          copy.trees[tid] = {
            id: t.id, name: t.name, created: t.created,
            focusId: t.focusId, view: t.view, unions: t.unions,
            people: Object.keys(t.people || {})
          };
        });
        out.worlds[wid] = copy;
      });
      return out;
    },

    /* JSON neumí Infinity — po načtení převedeme null zpět na neomezeno */
    normalize: function () {
      var worlds = this.state.worlds;
      Object.keys(worlds).forEach(function (wid) {
        var world = worlds[wid];
        Object.keys(world.entities).forEach(function (eid) {
          var e = world.entities[eid];
          if (!e.type) e.type = 'postava';
          if (!e.id) e.id = eid;
        });
        Object.keys(world.trees).forEach(function (id) {
          var t = world.trees[id];
          t.people = t.people || {};
          t.unions = t.unions || {};
          t.view = t.view || {};
          if (t.view.up === null || t.view.up === undefined) t.view.up = Infinity;
          if (t.view.down === null || t.view.down === undefined) t.view.down = Infinity;
          Object.keys(t.unions).forEach(function (uid2) {
            var u = t.unions[uid2];
            if (u.start === undefined) u.start = '';
            if (u.end === undefined) u.end = '';
            if (u.note === undefined) u.note = '';
          });
          if (!t.focusId || !t.people[t.focusId]) {
            t.focusId = Object.keys(t.people)[0] || null;
          }
          Store.prune(t);
        });
        if (!world.trees[world.activeTreeId]) {
          world.activeTreeId = world.treeOrder[0] || null;
        }
      });
    },

    save: function () {
      try {
        global.localStorage.setItem(KEY, JSON.stringify(this.serialize()));
        this.storageOk = true;
      } catch (e) {
        this.storageOk = false;
      }
    },

    onChange: function (fn) { this.listeners.push(fn); },

    emit: function (reason) {
      if (this.silent) return;
      this.save();
      for (var i = 0; i < this.listeners.length; i++) this.listeners[i](reason);
    },

    /* několik změn najednou = jeden krok zpět a jedno překreslení */
    batch: function (fn) {
      this.snapshot();
      this.silent = true;
      try { fn(); } finally { this.silent = false; }
      this.emit('batch');
    },

    snapshot: function () {
      if (this.silent) return;
      this.undoStack.push(JSON.stringify(this.serialize().worlds));
      if (this.undoStack.length > MAX_UNDO) this.undoStack.shift();
      this.redoStack.length = 0;
    },

    restore: function (json) {
      var data = this.serialize();
      data.worlds = JSON.parse(json);
      data.worldOrder = this.state.worldOrder.filter(function (id) {
        return !!data.worlds[id];
      });
      Object.keys(data.worlds).forEach(function (id) {
        if (data.worldOrder.indexOf(id) === -1) data.worldOrder.push(id);
      });
      this.state = this.hydrate(data);
      this.normalize();
    },

    undo: function () {
      if (!this.undoStack.length) return false;
      this.redoStack.push(JSON.stringify(this.serialize().worlds));
      this.restore(this.undoStack.pop());
      this.emit('undo');
      return true;
    },

    redo: function () {
      if (!this.redoStack.length) return false;
      this.undoStack.push(JSON.stringify(this.serialize().worlds));
      this.restore(this.redoStack.pop());
      this.emit('redo');
      return true;
    },

    /* ---------- světy ---------- */

    createWorld: function (name, silent) {
      var W = global.FG.World;
      if (!silent) this.snapshot();
      var world = W.blank(name);
      this.state.worlds[world.id] = world;
      this.state.worldOrder.push(world.id);
      var tree = this.createTree('Rod bez jména', true, world);
      world.activeTreeId = tree.id;
      if (!silent) {
        this.state.activeWorldId = world.id;
        this.emit('world-create');
      }
      return world;
    },

    activeWorld: function () {
      return this.state.worlds[this.state.activeWorldId] || null;
    },

    worlds: function () {
      var s = this.state;
      return s.worldOrder.map(function (id) { return s.worlds[id]; })
        .filter(function (w) { return !!w; });
    },

    setActiveWorld: function (id) {
      this.state.activeWorldId = id;
      this.emit('world-switch');
    },

    renameWorld: function (id, name) {
      this.snapshot();
      this.state.worlds[id].name = name;
      this.emit('world-rename');
    },

    deleteWorld: function (id) {
      this.snapshot();
      delete this.state.worlds[id];
      this.state.worldOrder = this.state.worldOrder.filter(function (x) { return x !== id; });
      if (this.state.activeWorldId === id) {
        this.state.activeWorldId = this.state.worldOrder[0] || null;
      }
      if (!this.state.worldOrder.length) {
        var w = this.createWorld('Můj svět', true);
        this.state.activeWorldId = w.id;
      }
      this.emit('world-delete');
    },

    /* ---------- rodokmeny ---------- */

    createTree: function (name, silent, world) {
      world = world || this.activeWorld();
      if (!silent) this.snapshot();
      var id = uid('t');
      var tree = {
        id: id,
        name: name || 'Nový rod',
        created: Date.now(),
        focusId: null,
        view: { up: Infinity, down: Infinity },
        people: {},
        unions: {}
      };
      world.trees[id] = tree;
      world.treeOrder.push(id);
      // strom vždy začíná jednou postavou, ať je kam klikat
      var p = this.newPerson(tree, { name: '' }, world);
      tree.focusId = p.id;
      if (!silent) this.emit('tree-create');
      return tree;
    },

    deleteTree: function (id) {
      this.snapshot();
      var world = this.activeWorld();
      delete world.trees[id];
      world.treeOrder = world.treeOrder.filter(function (x) { return x !== id; });
      if (world.activeTreeId === id) world.activeTreeId = world.treeOrder[0] || null;
      if (!world.treeOrder.length) {
        var t = this.createTree('Rod bez jména', true);
        world.activeTreeId = t.id;
      }
      this.emit('tree-delete');
    },

    duplicateTree: function (id) {
      this.snapshot();
      var world = this.activeWorld();
      var src = world.trees[id];
      var copy = {
        id: uid('t'), name: src.name + ' (kopie)', created: Date.now(),
        focusId: null, view: clone(src.view), people: {}, unions: {}
      };
      // kopie rodokmenu znamená i kopie jeho postav, ať jsou stromy nezávislé
      var map = {};
      Object.keys(src.people).forEach(function (pid) {
        var e = clone(world.entities[pid]);
        e.id = uid('p');
        map[pid] = e.id;
        world.entities[e.id] = e;
        copy.people[e.id] = e;
      });
      Object.keys(src.unions).forEach(function (uid2) {
        var u = clone(src.unions[uid2]);
        u.id = uid('u');
        u.partners = u.partners.map(function (x) { return map[x]; }).filter(Boolean);
        u.children = u.children.map(function (x) { return map[x]; }).filter(Boolean);
        copy.unions[u.id] = u;
        u.children.forEach(function (c) { copy.people[c].parentUnionId = u.id; });
      });
      copy.focusId = map[src.focusId] || Object.keys(copy.people)[0] || null;
      world.trees[copy.id] = copy;
      world.treeOrder.push(copy.id);
      this.emit('tree-duplicate');
      return copy;
    },

    renameTree: function (id, name) {
      this.snapshot();
      this.activeWorld().trees[id].name = name;
      this.emit('tree-rename');
    },

    setActiveTree: function (id) {
      this.activeWorld().activeTreeId = id;
      this.emit('tree-switch');
    },

    activeTree: function () {
      var w = this.activeWorld();
      return (w && w.trees[w.activeTreeId]) || null;
    },

    trees: function () {
      var w = this.activeWorld();
      if (!w) return [];
      return w.treeOrder.map(function (id) { return w.trees[id]; })
        .filter(function (t) { return !!t; });
    },

    /* rodokmen, ve kterém osoba vystupuje */
    treeOf: function (world, personId) {
      var ids = Object.keys(world.trees);
      for (var i = 0; i < ids.length; i++) {
        if (world.trees[ids[i]].people[personId]) return world.trees[ids[i]];
      }
      return null;
    },

    /* ---------- osoby a vazby ---------- */

    newPerson: function (tree, data, world) {
      world = world || this.activeWorld();
      var p = global.FG.World.create(world, 'postava', {
        name: (data && data.name) || '',
        gender: (data && data.gender) || 'x',
        birth: (data && data.birth) || '',
        death: (data && data.death) || '',
        note: (data && data.note) || ''
      });
      p.parentUnionId = null;
      tree.people[p.id] = p;
      return p;
    },

    newUnion: function (tree, partners, data) {
      var u = {
        id: uid('u'),
        partners: (partners || []).slice(),
        children: [],
        start: (data && data.start) || '',
        end: (data && data.end) || '',
        note: (data && data.note) || ''
      };
      tree.unions[u.id] = u;
      return u;
    },

    updateUnion: function (tree, unionId, data) {
      var u = tree.unions[unionId];
      if (!u) return;
      this.snapshot();
      ['start', 'end', 'note'].forEach(function (k) {
        if (data[k] !== undefined) u[k] = data[k];
      });
      this.emit('union-update');
    },

    /* roky trvání svazku pro popisek u značky */
    unionYears: function (u) {
      if (!u) return '';
      var a = (u.start || '').trim(), b = (u.end || '').trim();
      if (a && b) return a + ' – ' + b;
      if (a) return 'od ' + a;
      if (b) return 'do ' + b;
      return '';
    },

    updatePerson: function (tree, id, data) {
      this.snapshot();
      var p = tree.people[id];
      if (!p) return;
      ['name', 'gender', 'birth', 'death', 'note'].forEach(function (k) {
        if (data[k] !== undefined) p[k] = data[k];
      });
      this.emit('person-update');
    },

    /* svazky, kde je osoba partnerem — seřazené podle začátku, aby šly
       za sebou tak, jak v životě postavy následovaly */
    unionsOf: function (tree, personId) {
      var out = [];
      for (var k in tree.unions) {
        if (tree.unions[k].partners.indexOf(personId) !== -1) out.push(tree.unions[k]);
      }
      return out.sort(function (a, b) {
        var ka = yearKey(a.start), kb = yearKey(b.start);
        if (ka === kb) return 0;          // Infinity − Infinity by dalo NaN
        return ka < kb ? -1 : 1;
      });
    },

    partnersOf: function (tree, personId) {
      var out = [];
      this.unionsOf(tree, personId).forEach(function (u) {
        u.partners.forEach(function (pid) {
          if (pid !== personId && tree.people[pid] && out.indexOf(pid) === -1) out.push(pid);
        });
      });
      return out;
    },

    parentsOf: function (tree, personId) {
      var p = tree.people[personId];
      if (!p || !p.parentUnionId) return [];
      var u = tree.unions[p.parentUnionId];
      if (!u) return [];
      return u.partners.filter(function (id) { return !!tree.people[id]; });
    },

    childrenOf: function (tree, personId) {
      var out = [];
      this.unionsOf(tree, personId).forEach(function (u) {
        u.children.forEach(function (c) {
          if (tree.people[c] && out.indexOf(c) === -1) out.push(c);
        });
      });
      return out;
    },

    siblingsOf: function (tree, personId) {
      var p = tree.people[personId];
      if (!p || !p.parentUnionId) return [];
      var u = tree.unions[p.parentUnionId];
      if (!u) return [];
      return u.children.filter(function (id) {
        return id !== personId && tree.people[id];
      });
    },

    addParents: function (tree, childId, fatherData, motherData) {
      this.snapshot();
      var child = tree.people[childId];
      var u = child.parentUnionId ? tree.unions[child.parentUnionId] : null;
      if (!u) {
        u = this.newUnion(tree, []);
        u.children.push(childId);
        child.parentUnionId = u.id;
      }
      var made = [];
      [fatherData, motherData].forEach(function (d) {
        if (!d) return;
        if (u.partners.length >= 2) return;
        var p = Store.newPerson(tree, d);
        u.partners.push(p.id);
        made.push(p.id);
      });
      this.emit('add-parents');
      return made;
    },

    addPartner: function (tree, personId, data, unionData) {
      this.snapshot();
      var p = this.newPerson(tree, data);
      this.newUnion(tree, [personId, p.id], unionData);
      this.emit('add-partner');
      return p.id;
    },

    /* unionId === null => samostatné rodičovství (svazek jen s touto osobou) */
    addChild: function (tree, personId, unionId, data) {
      this.snapshot();
      var u = unionId ? tree.unions[unionId] : null;
      if (!u) {
        var solo = this.unionsOf(tree, personId).filter(function (x) {
          return x.partners.length === 1;
        })[0];
        u = solo || this.newUnion(tree, [personId]);
      }
      var c = this.newPerson(tree, data);
      c.parentUnionId = u.id;
      u.children.push(c.id);
      this.emit('add-child');
      return c.id;
    },

    /* propojení dvou existujících osob; unionId upřesňuje svazek u vztahu 'child' */
    link: function (tree, personId, otherId, relation, unionId, unionData) {
      if (personId === otherId) return 'Nelze propojit osobu se sebou samou.';
      this.snapshot();
      // postava ze světa, která v tomto rodokmenu ještě nebyla, se do něj doplní
      var world = this.activeWorld();
      if (world && world.entities[otherId] && !tree.people[otherId]) {
        tree.people[otherId] = world.entities[otherId];
      }
      var msg = null;
      if (relation === 'partner') {
        var exists = this.unionsOf(tree, personId).some(function (u) {
          return u.partners.indexOf(otherId) !== -1;
        });
        if (exists) msg = 'Tyto osoby už partnery jsou.';
        else this.newUnion(tree, [personId, otherId], unionData);
      } else if (relation === 'child') {
        // otherId se stane dítětem personId — kruh by vznikl, kdyby personId
        // byl potomkem otherId
        if (this.isDescendant(tree, otherId, personId)) {
          msg = 'To by vytvořilo kruh v rodokmenu.';
        } else {
          var u2 = (unionId && tree.unions[unionId] &&
            tree.unions[unionId].partners.indexOf(personId) !== -1)
            ? tree.unions[unionId]
            : this.unionsOf(tree, personId)[0] || this.newUnion(tree, [personId]);
          this.detachFromParents(tree, otherId);
          tree.people[otherId].parentUnionId = u2.id;
          if (u2.children.indexOf(otherId) === -1) u2.children.push(otherId);
        }
      } else if (relation === 'parent') {
        // otherId se stane rodičem personId — kruh by vznikl, kdyby otherId
        // byl potomkem personId
        if (this.isDescendant(tree, personId, otherId)) {
          msg = 'To by vytvořilo kruh v rodokmenu.';
        } else {
          var me = tree.people[personId];
          var pu = me.parentUnionId ? tree.unions[me.parentUnionId] : null;
          if (pu && pu.partners.length < 2 && pu.partners.indexOf(otherId) === -1) {
            pu.partners.push(otherId);
          } else if (pu && pu.partners.indexOf(otherId) !== -1) {
            msg = 'Tato osoba už je rodičem.';
          } else {
            var nu = this.newUnion(tree, [otherId]);
            this.detachFromParents(tree, personId);
            me.parentUnionId = nu.id;
            nu.children.push(personId);
          }
        }
      }
      if (msg) { this.undoStack.pop(); return msg; }
      this.prune(tree);
      this.emit('link');
      return null;
    },

    detachFromParents: function (tree, personId) {
      var p = tree.people[personId];
      if (!p || !p.parentUnionId) return;
      var u = tree.unions[p.parentUnionId];
      if (u) u.children = u.children.filter(function (c) { return c !== personId; });
      p.parentUnionId = null;
    },

    /* seznam vazeb pro dialog „Odpojit" */
    relationsOf: function (tree, personId) {
      var out = [];
      var p = tree.people[personId];
      if (!p) return out;
      this.parentsOf(tree, personId).forEach(function (id) {
        out.push({ kind: 'parent', targetId: id, label: 'Rodič: ' + Store.label(tree, id) });
      });
      this.unionsOf(tree, personId).forEach(function (u) {
        u.partners.forEach(function (pid) {
          if (pid !== personId) {
            out.push({
              kind: 'partner', unionId: u.id, targetId: pid,
              label: 'Partner: ' + Store.label(tree, pid)
            });
          }
        });
        u.children.forEach(function (cid) {
          out.push({
            kind: 'child', unionId: u.id, targetId: cid,
            label: 'Dítě: ' + Store.label(tree, cid)
          });
        });
      });
      return out;
    },

    unlink: function (tree, personId, rel) {
      this.snapshot();
      if (rel.kind === 'parent') {
        var p = tree.people[personId];
        var u = tree.unions[p.parentUnionId];
        if (u) {
          if (u.partners.length > 1) {
            // odpojíme jen konkrétního rodiče
            u.partners = u.partners.filter(function (x) { return x !== rel.targetId; });
          } else {
            u.children = u.children.filter(function (c) { return c !== personId; });
            p.parentUnionId = null;
          }
        }
      } else if (rel.kind === 'partner') {
        var up = tree.unions[rel.unionId];
        if (up) up.partners = up.partners.filter(function (x) { return x !== rel.targetId; });
      } else if (rel.kind === 'child') {
        var uc = tree.unions[rel.unionId];
        if (uc) uc.children = uc.children.filter(function (c) { return c !== rel.targetId; });
        if (tree.people[rel.targetId]) tree.people[rel.targetId].parentUnionId = null;
      }
      this.prune(tree);
      this.emit('unlink');
    },

    deletePerson: function (tree, personId) {
      this.snapshot();
      var world = this.activeWorld();
      delete tree.people[personId];
      if (world) global.FG.World.remove(world, personId);
      for (var k in tree.unions) {
        var u = tree.unions[k];
        u.partners = u.partners.filter(function (x) { return x !== personId; });
        u.children = u.children.filter(function (x) { return x !== personId; });
      }
      for (var pid in tree.people) {
        var p = tree.people[pid];
        if (p.parentUnionId && !tree.unions[p.parentUnionId]) p.parentUnionId = null;
      }
      this.prune(tree);
      if (tree.focusId === personId) {
        tree.focusId = Object.keys(tree.people)[0] || null;
      }
      if (!Object.keys(tree.people).length) {
        var np = this.newPerson(tree, { name: '' });
        tree.focusId = np.id;
      }
      this.emit('person-delete');
    },

    prune: function (tree) {
      for (var k in tree.unions) {
        var u = tree.unions[k];
        u.partners = u.partners.filter(function (x) { return !!tree.people[x]; });
        u.children = u.children.filter(function (x) { return !!tree.people[x]; });
        if (!u.partners.length && u.children.length < 1) {
          u.children.forEach(function (c) { tree.people[c].parentUnionId = null; });
          delete tree.unions[k];
        } else if (!u.partners.length) {
          u.children.forEach(function (c) { tree.people[c].parentUnionId = null; });
          delete tree.unions[k];
        }
      }
      for (var pid in tree.people) {
        var p = tree.people[pid];
        if (p.parentUnionId && !tree.unions[p.parentUnionId]) p.parentUnionId = null;
      }
    },

    isDescendant: function (tree, ancestorId, personId) {
      // je personId potomkem ancestorId?
      var seen = {}, stack = [ancestorId];
      while (stack.length) {
        var cur = stack.pop();
        if (seen[cur]) continue;
        seen[cur] = 1;
        var kids = this.childrenOf(tree, cur);
        for (var i = 0; i < kids.length; i++) {
          if (kids[i] === personId) return true;
          stack.push(kids[i]);
        }
      }
      return false;
    },

    setFocus: function (tree, personId) {
      tree.focusId = personId;
      this.emit('focus');
    },

    setView: function (tree, patch) {
      if (patch.up !== undefined) tree.view.up = patch.up;
      if (patch.down !== undefined) tree.view.down = patch.down;
      this.emit('view');
    },

    label: function (tree, id) {
      var p = tree.people[id];
      if (!p) return '—';
      return p.name && p.name.trim() ? p.name : 'Bez jména';
    },

    lifespan: function (p) {
      if (!p) return '';
      var b = (p.birth || '').trim(), d = (p.death || '').trim();
      if (b && d) return b + ' – ' + d;
      if (b) return '* ' + b;
      if (d) return '† ' + d;
      return '';
    },

    search: function (tree, q) {
      q = (q || '').trim().toLowerCase();
      if (!q) return [];
      var out = [];
      for (var id in tree.people) {
        var p = tree.people[id];
        var hay = ((p.name || '') + ' ' + (p.note || '')).toLowerCase();
        if (hay.indexOf(q) !== -1) out.push(p);
      }
      return out.sort(function (a, b) {
        return (a.name || '').localeCompare(b.name || '', 'cs');
      }).slice(0, 40);
    },

    stats: function (tree) {
      return {
        people: Object.keys(tree.people).length,
        unions: Object.keys(tree.unions).length
      };
    },

    /* ---------- import / export dat ---------- */

    exportJSON: function () {
      var data = this.serialize();
      data.app = 'kroniky-rodu';
      data.exported = new Date().toISOString();
      return JSON.stringify(data, null, 2);
    },

    importJSON: function (text, mode) {
      var data = JSON.parse(text);
      if (!data.worlds && !data.trees) {
        throw new Error('Soubor neobsahuje žádný svět ani rod.');
      }
      this.snapshot();
      var incoming = this.hydrate(data);          // zvládne i starší zálohy
      if (mode === 'replace') {
        this.state.worlds = {};
        this.state.worldOrder = [];
      }
      var first = null;
      incoming.worldOrder.forEach(function (wid) {
        var w = incoming.worlds[wid];
        if (!w) return;
        if (Store.state.worlds[w.id]) {
          var old = w.id;
          w.id = uid('w');
          if (incoming.activeWorldId === old) incoming.activeWorldId = w.id;
        }
        Store.state.worlds[w.id] = w;
        Store.state.worldOrder.push(w.id);
        if (!first) first = w.id;
      });
      if (first) this.state.activeWorldId = first;
      this.normalize();
      this.emit('import');
      return first;
    },

    uid: uid
  };

  global.FG = global.FG || {};
  global.FG.Store = Store;
})(window);
