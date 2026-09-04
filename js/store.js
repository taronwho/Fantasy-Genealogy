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
        settingsVersion: 1,
        activeWorldId: null,
        settings: {
          theme: prefersDark() ? 'inkoust' : 'pergamen',   // pergamen | inkoust
          collateral: 'all',       // none | siblings | all
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
      state.changedAt = data.changedAt || 0;
      state.settingsVersion = data.settingsVersion || 0;
      /* „Se sourozenci" bývalo výchozí a tiše schovávalo strýce, tety
         i bratrance — na jednom zařízení tak strom vypadal jinak než na
         druhém. Kdo si to nepřenastavil, dostane celý rod; zpět to jde
         v Nastavení jedním klepnutím. */
      if (!state.settingsVersion && state.settings.collateral === 'siblings') {
        state.settings.collateral = 'all';
      }
      state.settingsVersion = 1;
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
        settingsVersion: state.settingsVersion || 1,
        activeWorldId: state.activeWorldId,
        changedAt: state.changedAt || 0,   // kdy se naposledy něco změnilo
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
            offsets: t.offsets || {},
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
          t.offsets = t.offsets || {};
          Object.keys(t.offsets).forEach(function (pid) {
            if (!t.people[pid] || !t.offsets[pid]) delete t.offsets[pid];
          });
          if (t.view.up === null || t.view.up === undefined) t.view.up = Infinity;
          if (t.view.down === null || t.view.down === undefined) t.view.down = Infinity;
          Object.keys(t.unions).forEach(function (uid2) {
            var u = t.unions[uid2];
            if (u.start === undefined) u.start = '';
            if (u.end === undefined) u.end = '';
            if (u.note === undefined) u.note = '';
            if (u.left === undefined) u.left = '';
            if (u.left && u.partners.indexOf(u.left) === -1) u.left = '';
            if (u.anchor === undefined) u.anchor = '';
            if (u.anchor && u.partners.indexOf(u.anchor) === -1) u.anchor = '';
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
        this.state.changedAt = Date.now();
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
        unions: {},
        offsets: {}          // ruční vodorovný posun karet
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
        focusId: null, view: clone(src.view), people: {}, unions: {}, offsets: {}
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
      Object.keys(src.offsets || {}).forEach(function (pid) {
        if (map[pid]) copy.offsets[map[pid]] = src.offsets[pid];
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

    /* Svazek je určený svými partnery. Dva svazky téže dvojice nemají smysl —
       v rodokmenu se z nich zdvojí čáry i vazby a nejde poznat, který je
       ten pravý. Klíč slouží k jejich porovnání. */
    unionKey: function (partners) {
      return (partners || []).slice().sort().join('|');
    },

    findUnion: function (tree, partners) {
      if (!partners || !partners.length) return null;
      var hledany = this.unionKey(partners);
      for (var k in tree.unions) {
        if (this.unionKey(tree.unions[k].partners) === hledany) return tree.unions[k];
      }
      return null;
    },

    newUnion: function (tree, partners, data) {
      var stary = this.findUnion(tree, partners);
      if (stary) {                       // tahle dvojice už svazek má
        ['start', 'end', 'note'].forEach(function (f) {
          if (!stary[f] && data && data[f]) stary[f] = data[f];
        });
        return stary;
      }
      var u = {
        id: uid('u'),
        partners: (partners || []).slice(),
        children: [],
        start: (data && data.start) || '',
        end: (data && data.end) || '',
        note: (data && data.note) || '',
        left: '',           // kdo z dvojice stojí ve stromu vlevo
        anchor: ''          // u čí rodiny se dvojice kreslí
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

    /* Sourozenci i nevlastní — kdo má s osobou společného aspoň jednoho
       rodiče. Ve stromu patří k sobě: Imeline je dcerou Ciallach stejně
       jako Härmas, jen s jiným otcem. */
    allSiblingsOf: function (tree, personId) {
      var out = this.siblingsOf(tree, personId);
      this.parentsOf(tree, personId).forEach(function (rid) {
        Store.childrenOf(tree, rid).forEach(function (cid) {
          if (cid !== personId && out.indexOf(cid) === -1) out.push(cid);
        });
      });
      return out;
    },

    /* ---------- ruční pořadí sourozenců ---------- */

    /* Vodorovné pořadí ve stromu vychází z pořadí dětí ve svazku rodičů.
       Posun doleva/doprava proto jen prohodí dvě jména v tomto seznamu. */
    siblingRow: function (tree, personId) {
      var p = tree.people[personId];
      if (!p || !p.parentUnionId) return null;
      var u = tree.unions[p.parentUnionId];
      if (!u) return null;
      var list = u.children.filter(function (id) { return !!tree.people[id]; });
      var i = list.indexOf(personId);
      if (i < 0 || list.length < 2) return null;
      return { union: u, list: list, index: i };
    },

    /* U koho z dvojice se pár kreslí. Bez volby si ho vezme ta větev,
       která přijde ve stromu na řadu dřív — což nemusí být ta hlavní. */
    setUnionAnchor: function (tree, unionId, personId) {
      var u = tree.unions[unionId];
      if (!u || (personId && u.partners.indexOf(personId) === -1)) return false;
      if (u.anchor === (personId || '')) return false;
      this.snapshot();
      u.anchor = personId || '';
      this.emit('person-update');
      return true;
    },

    /* ---------- ruční posun karet ----------
       Rozvržení počítá aplikace, ale poslední slovo má autor: každá karta
       si může nést vodorovný posun, který se přičte až nakonec. Svislá
       poloha zůstává na pokolení, jinak by strom přestal dávat smysl. */

    nudge: function (tree, personId, dx) {
      if (!tree.people[personId] || !dx) return false;
      this.snapshot();
      tree.offsets = tree.offsets || {};
      var novy = Math.round((tree.offsets[personId] || 0) + dx);
      if (novy) tree.offsets[personId] = novy;
      else delete tree.offsets[personId];
      this.emit('person-update');
      return true;
    },

    nudgeOf: function (tree, personId) {
      return (tree.offsets && tree.offsets[personId]) || 0;
    },

    resetNudge: function (tree, personId, silent) {
      if (!tree.offsets || !tree.offsets[personId]) return false;
      if (!silent) this.snapshot();
      delete tree.offsets[personId];
      if (!silent) this.emit('person-update');
      return true;
    },

    nudged: function (tree) {
      return Object.keys(tree.offsets || {}).filter(function (id) {
        return !!tree.people[id];
      });
    },

    clearNudges: function (tree) {
      if (!this.nudged(tree).length) return false;
      this.snapshot();
      tree.offsets = {};
      this.emit('person-update');
      return true;
    },

    /* překlopí partnery na opačné strany — leftId bude stát vlevo */
    setUnionSide: function (tree, unionId, leftId) {
      var u = tree.unions[unionId];
      if (!u || u.partners.indexOf(leftId) === -1 || u.left === leftId) return false;
      this.snapshot();
      u.left = leftId;
      this.emit('person-update');
      return true;
    },

    canMove: function (tree, personId, dir) {
      var row = this.siblingRow(tree, personId);
      if (!row) return false;
      var j = row.index + (dir < 0 ? -1 : 1);
      return j >= 0 && j < row.list.length;
    },

    movePerson: function (tree, personId, dir) {
      var row = this.siblingRow(tree, personId);
      if (!row) return false;
      var j = row.index + (dir < 0 ? -1 : 1);
      if (j < 0 || j >= row.list.length) return false;
      this.snapshot();
      var list = row.list.slice();
      var tmp = list[row.index];
      list[row.index] = list[j];
      list[j] = tmp;
      var ghosts = row.union.children.filter(function (id) { return !tree.people[id]; });
      row.union.children = list.concat(ghosts);
      this.emit('person-update');
      return true;
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
    /* unionId === 'new' znamená nový svazek jen s touto osobou —
       dítě pak nepatří i jejímu partnerovi */
    addChild: function (tree, personId, unionId, data) {
      this.snapshot();
      var u = (unionId && unionId !== 'new') ? tree.unions[unionId] : null;
      if (!u && unionId === 'new') u = this.newUnion(tree, [personId]);
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
          var zvoleny = (unionId && unionId !== 'new' && tree.unions[unionId] &&
            tree.unions[unionId].partners.indexOf(personId) !== -1)
            ? tree.unions[unionId] : null;
          var u2 = zvoleny ||
            (unionId === 'new'
              ? this.newUnion(tree, [personId])
              : this.unionsOf(tree, personId)[0] || this.newUnion(tree, [personId]));
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
          if (pu && pu.partners.indexOf(otherId) !== -1) {
            msg = 'Tato osoba už je rodičem.';
          } else if (pu && pu.partners.length < 2) {
            if (pu.children.length > 1) {
              // svazek sdílejí sourozenci — druhého rodiče dostane jen tato osoba
              pu.children = pu.children.filter(function (c) { return c !== personId; });
              var spolu = this.unionWith(tree, pu.partners.concat([otherId]));
              me.parentUnionId = spolu.id;
              if (spolu.children.indexOf(personId) === -1) spolu.children.push(personId);
            } else {
              pu.partners.push(otherId);
            }
          } else {
            var nu = this.newUnion(tree, [otherId]);
            this.detachFromParents(tree, personId);
            me.parentUnionId = nu.id;
            if (nu.children.indexOf(personId) === -1) nu.children.push(personId);
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

    /* svazek s přesně těmito partnery — buď už existuje, nebo vznikne */
    unionWith: function (tree, partners) {
      return this.newUnion(tree, partners);
    },

    unlink: function (tree, personId, rel) {
      this.snapshot();
      if (rel.kind === 'parent') {
        var p = tree.people[personId];
        var u = tree.unions[p.parentUnionId];
        if (u) {
          var zbyli = u.partners.filter(function (x) { return x !== rel.targetId; });
          if (zbyli.length === u.partners.length) {
            // takový rodič tam není, není co odpojovat
          } else if (zbyli.length) {
            // Svazek patří i sourozencům, proto se nemění — místo toho
            // přejde jen tato osoba pod zbylého rodiče.
            u.children = u.children.filter(function (c) { return c !== personId; });
            var cil = this.unionWith(tree, zbyli);
            p.parentUnionId = cil.id;
            if (cil.children.indexOf(personId) === -1) cil.children.push(personId);
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
        var kid = tree.people[rel.targetId];
        // rodiče ztrácí jen tehdy, když patřilo právě tomuto svazku
        if (kid && kid.parentUnionId === rel.unionId) kid.parentUnionId = null;
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

    /* Srovná strom do stavu, kde vazby nemohou být dvojznačné:
         – jedna dvojice = jeden svazek
         – dítě patří právě do jednoho svazku a ten o něm ví
         – svazek bez potomků a bez dvojice nedrží nic pohromadě
       Běží po každé úpravě vazeb i při načtení, takže se starší rozsypaná
       data spraví sama. */
    prune: function (tree) {
      var k, u, pid, p;

      // 1. odkazy na osoby, které ve stromu nejsou
      for (k in tree.unions) {
        u = tree.unions[k];
        u.partners = (u.partners || []).filter(function (x) { return !!tree.people[x]; });
        u.children = (u.children || []).filter(function (x) { return !!tree.people[x]; });
      }

      // 2. svazky se stejnými partnery se slijí do prvního
      var podle = {};
      Object.keys(tree.unions).forEach(function (id) {
        var d = tree.unions[id];
        if (!d.partners.length) return;
        var key = Store.unionKey(d.partners);
        var prvni = podle[key];
        if (!prvni) { podle[key] = d; return; }
        d.children.forEach(function (c) {
          if (prvni.children.indexOf(c) === -1) prvni.children.push(c);
          if (tree.people[c].parentUnionId === d.id) tree.people[c].parentUnionId = prvni.id;
        });
        ['start', 'end', 'note', 'left', 'anchor'].forEach(function (f) {
          if (!prvni[f] && d[f]) prvni[f] = d[f];
        });
        delete tree.unions[id];
      });

      // 3. svazek bez partnerů nikoho nespojuje
      for (k in tree.unions) {
        if (tree.unions[k].partners.length) continue;
        tree.unions[k].children.forEach(function (c) { tree.people[c].parentUnionId = null; });
        delete tree.unions[k];
      }

      // 4. dítě a jeho svazek si musí odpovídat — jinak vzniká vazba navíc,
      //    která po odpojení strhne i tu pravou
      for (pid in tree.people) {
        p = tree.people[pid];
        if (p.parentUnionId && !tree.unions[p.parentUnionId]) p.parentUnionId = null;
      }
      for (k in tree.unions) {
        u = tree.unions[k];
        u.children = u.children.filter(function (c) {
          var kid = tree.people[c];
          if (!kid.parentUnionId) { kid.parentUnionId = u.id; return true; }
          return kid.parentUnionId === u.id;
        });
      }
      for (pid in tree.people) {
        p = tree.people[pid];
        if (!p.parentUnionId) continue;
        u = tree.unions[p.parentUnionId];
        if (u.children.indexOf(pid) === -1) u.children.push(pid);
      }

      // 5. svazek bez potomků a bez druhého partnera nenese žádnou informaci
      for (k in tree.unions) {
        u = tree.unions[k];
        if (u.children.length || u.partners.length >= 2) continue;
        delete tree.unions[k];
      }
      for (pid in tree.people) {
        p = tree.people[pid];
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
