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

    /* ---------- perzistence ---------- */

    defaults: function () {
      return {
        version: 1,
        activeTreeId: null,
        settings: {
          theme: prefersDark() ? 'inkoust' : 'pergamen',   // pergamen | inkoust
          collateral: 'siblings',  // none | siblings | all
          showPartners: true,
          showYears: true,
          showNotes: true
        },
        trees: {},
        order: []
      };
    },

    load: function () {
      var raw = null;
      try { raw = global.localStorage.getItem(KEY); }
      catch (e) { this.storageOk = false; }
      if (raw) {
        try { this.state = JSON.parse(raw); }
        catch (e) { this.state = null; }
      }
      if (!this.state || !this.state.trees) this.state = this.defaults();
      if (!this.state.order) this.state.order = Object.keys(this.state.trees);
      if (!this.state.settings) this.state.settings = this.defaults().settings;
      if (!this.state.order.length) {
        var t = this.createTree('Rod bez jména', true);
        this.state.activeTreeId = t.id;
      }
      if (!this.state.trees[this.state.activeTreeId]) {
        this.state.activeTreeId = this.state.order[0];
      }
      this.normalize();
      return this.state;
    },

    /* JSON neumí Infinity — po načtení převedeme null zpět na neomezeno */
    normalize: function () {
      var trees = this.state.trees;
      Object.keys(trees).forEach(function (id) {
        var t = trees[id];
        t.people = t.people || {};
        t.unions = t.unions || {};
        t.view = t.view || {};
        if (t.view.up === null || t.view.up === undefined) t.view.up = Infinity;
        if (t.view.down === null || t.view.down === undefined) t.view.down = Infinity;
        if (!t.focusId || !t.people[t.focusId]) {
          t.focusId = Object.keys(t.people)[0] || null;
        }
        Store.prune(t);
      });
    },

    save: function () {
      try {
        global.localStorage.setItem(KEY, JSON.stringify(this.state));
        this.storageOk = true;
      } catch (e) {
        this.storageOk = false;
      }
    },

    onChange: function (fn) { this.listeners.push(fn); },

    emit: function (reason) {
      this.save();
      for (var i = 0; i < this.listeners.length; i++) this.listeners[i](reason);
    },

    /* ---------- undo ---------- */

    snapshot: function () {
      this.undoStack.push(JSON.stringify(this.state.trees));
      if (this.undoStack.length > MAX_UNDO) this.undoStack.shift();
      this.redoStack.length = 0;
    },

    undo: function () {
      if (!this.undoStack.length) return false;
      this.redoStack.push(JSON.stringify(this.state.trees));
      this.state.trees = JSON.parse(this.undoStack.pop());
      if (!this.state.trees[this.state.activeTreeId]) {
        this.state.activeTreeId = Object.keys(this.state.trees)[0] || null;
      }
      this.state.order = this.state.order.filter(function (id) {
        return !!Store.state.trees[id];
      });
      Object.keys(this.state.trees).forEach(function (id) {
        if (Store.state.order.indexOf(id) === -1) Store.state.order.push(id);
      });
      this.normalize();
      this.emit('undo');
      return true;
    },

    redo: function () {
      if (!this.redoStack.length) return false;
      this.undoStack.push(JSON.stringify(this.state.trees));
      this.state.trees = JSON.parse(this.redoStack.pop());
      this.normalize();
      this.emit('redo');
      return true;
    },

    /* ---------- stromy ---------- */

    createTree: function (name, silent) {
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
      // strom vždy začíná jednou postavou, ať je kam klikat
      var p = this.newPerson(tree, { name: '' });
      tree.focusId = p.id;
      this.state.trees[id] = tree;
      this.state.order.push(id);
      if (!silent) this.emit('tree-create');
      return tree;
    },

    deleteTree: function (id) {
      this.snapshot();
      delete this.state.trees[id];
      this.state.order = this.state.order.filter(function (x) { return x !== id; });
      if (this.state.activeTreeId === id) {
        this.state.activeTreeId = this.state.order[0] || null;
      }
      if (!this.state.order.length) {
        var t = this.createTree('Rod bez jména', true);
        this.state.activeTreeId = t.id;
      }
      this.emit('tree-delete');
    },

    duplicateTree: function (id) {
      this.snapshot();
      var src = this.state.trees[id];
      var copy = clone(src);
      copy.id = uid('t');
      copy.name = src.name + ' (kopie)';
      copy.created = Date.now();
      this.state.trees[copy.id] = copy;
      this.state.order.push(copy.id);
      this.emit('tree-duplicate');
      return copy;
    },

    renameTree: function (id, name) {
      this.snapshot();
      this.state.trees[id].name = name;
      this.emit('tree-rename');
    },

    setActiveTree: function (id) {
      this.state.activeTreeId = id;
      this.emit('tree-switch');
    },

    activeTree: function () {
      return this.state.trees[this.state.activeTreeId] || null;
    },

    trees: function () {
      var s = this.state;
      return s.order.map(function (id) { return s.trees[id]; })
        .filter(function (t) { return !!t; });
    },

    /* ---------- osoby a vazby ---------- */

    newPerson: function (tree, data) {
      var p = {
        id: uid('p'),
        name: (data && data.name) || '',
        gender: (data && data.gender) || 'x',
        birth: (data && data.birth) || '',
        death: (data && data.death) || '',
        note: (data && data.note) || '',
        parentUnionId: null
      };
      tree.people[p.id] = p;
      return p;
    },

    newUnion: function (tree, partners) {
      var u = { id: uid('u'), partners: (partners || []).slice(), children: [], note: '' };
      tree.unions[u.id] = u;
      return u;
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

    /* svazky, kde je osoba partnerem */
    unionsOf: function (tree, personId) {
      var out = [];
      for (var k in tree.unions) {
        if (tree.unions[k].partners.indexOf(personId) !== -1) out.push(tree.unions[k]);
      }
      return out;
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

    addPartner: function (tree, personId, data) {
      this.snapshot();
      var p = this.newPerson(tree, data);
      this.newUnion(tree, [personId, p.id]);
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

    /* propojení dvou existujících osob */
    link: function (tree, personId, otherId, relation) {
      if (personId === otherId) return 'Nelze propojit osobu se sebou samou.';
      this.snapshot();
      var msg = null;
      if (relation === 'partner') {
        var exists = this.unionsOf(tree, personId).some(function (u) {
          return u.partners.indexOf(otherId) !== -1;
        });
        if (exists) msg = 'Tyto osoby už partnery jsou.';
        else this.newUnion(tree, [personId, otherId]);
      } else if (relation === 'child') {
        // otherId se stane dítětem personId
        if (this.isDescendant(tree, personId, otherId)) {
          msg = 'To by vytvořilo kruh v rodokmenu.';
        } else {
          var un = this.unionsOf(tree, personId);
          var u2 = un[0] || this.newUnion(tree, [personId]);
          this.detachFromParents(tree, otherId);
          tree.people[otherId].parentUnionId = u2.id;
          if (u2.children.indexOf(otherId) === -1) u2.children.push(otherId);
        }
      } else if (relation === 'parent') {
        // otherId se stane rodičem personId
        if (this.isDescendant(tree, otherId, personId)) {
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
      delete tree.people[personId];
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
      return JSON.stringify({
        app: 'kroniky-rodu', version: 1, exported: new Date().toISOString(),
        trees: this.state.trees, order: this.state.order
      }, null, 2);
    },

    importJSON: function (text, mode) {
      var data = JSON.parse(text);
      if (!data.trees) throw new Error('Soubor neobsahuje žádné rody.');
      this.snapshot();
      if (mode === 'replace') {
        this.state.trees = {};
        this.state.order = [];
      }
      var first = null;
      var order = data.order || Object.keys(data.trees);
      order.forEach(function (id) {
        var t = data.trees[id];
        if (!t) return;
        var copy = clone(t);
        if (Store.state.trees[copy.id]) copy.id = uid('t');
        copy.people = copy.people || {};
        copy.unions = copy.unions || {};
        copy.view = copy.view || { up: Infinity, down: Infinity };
        if (copy.view.up === null) copy.view.up = Infinity;
        if (copy.view.down === null) copy.view.down = Infinity;
        Store.state.trees[copy.id] = copy;
        Store.state.order.push(copy.id);
        if (!first) first = copy.id;
      });
      if (first) this.state.activeTreeId = first;
      this.emit('import');
      return first;
    },

    uid: uid
  };

  global.FG = global.FG || {};
  global.FG.Store = Store;
})(window);
