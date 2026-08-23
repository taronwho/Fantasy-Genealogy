/* Kroniky rodů — svět a jeho obyvatelé
 *
 * Celý svět stojí na jednom druhu záznamu: entitě. Entita je plochý objekt
 * { id, type, name, … }, typ určuje, jaká pole se u ní zobrazují a jak se
 * mezi sebou váží. Rodokmeny pracují se stejnými postavami — karta ve stromu
 * a záznam v seznamu postav je jeden a tentýž objekt.
 */
(function (global) {
  'use strict';

  var TYPES = {
    postava: {
      label: 'Postava', plural: 'Postavy', article: 'Nová postava',
      icon: 'person', order: 1,
      fields: [
        { k: 'alias', l: 'Přídomek nebo překlad jména', t: 'text' },
        { k: 'gender', l: 'Pohlaví', t: 'gender' },
        { k: 'narod', l: 'Národ či skupina', t: 'ref', to: 'narod' },
        { k: 'misto', l: 'Místo pobytu', t: 'ref', to: 'misto' },
        { k: 'birth', l: 'Narození', t: 'text', half: true },
        { k: 'death', l: 'Úmrtí', t: 'text', half: true },
        { k: 'vzhled', l: 'Vzhled', t: 'long' },
        { k: 'povaha', l: 'Povahové vlastnosti', t: 'long' },
        { k: 'note', l: 'Další informace', t: 'long' }
      ],
      groupBy: 'narod'
    },
    misto: {
      label: 'Místo', plural: 'Místa', article: 'Nové místo',
      icon: 'place', order: 2,
      fields: [
        { k: 'alias', l: 'Překlad názvu', t: 'text' },
        { k: 'druh', l: 'Druh', t: 'select', options: [
          'kraj', 'město', 'vesnice', 'tvrz', 'hrad', 'věž', 'palác', 'náměstí',
          'stavba', 'místnost', 'les', 'pohoří', 'hora', 'řeka', 'jezero',
          'moře', 'ostrov', 'poloostrov', 'pláň', 'jiné'
        ] },
        { k: 'parent', l: 'Leží v', t: 'ref', to: 'misto' },
        { k: 'narod', l: 'Náleží národu', t: 'ref', to: 'narod' },
        { k: 'obyvatel', l: 'Obyvatel', t: 'text' },
        { k: 'note', l: 'Popis', t: 'long' }
      ],
      tree: 'parent',
      groupBy: 'druh'
    },
    narod: {
      label: 'Národ', plural: 'Národy', article: 'Nový národ',
      icon: 'flag', order: 3,
      fields: [
        { k: 'alias', l: 'Původní název', t: 'text' },
        { k: 'parent', l: 'Součást', t: 'ref', to: 'narod' },
        { k: 'symbol', l: 'Znak a barvy', t: 'text' },
        { k: 'note', l: 'Popis', t: 'long' }
      ],
      tree: 'parent'
    },
    udalost: {
      label: 'Událost', plural: 'Události', article: 'Nová událost',
      icon: 'event', order: 4,
      fields: [
        { k: 'datum', l: 'Datum', t: 'text', half: true },
        { k: 'epocha', l: 'Epocha nebo letopočet', t: 'text', half: true },
        { k: 'mista', l: 'Kde se stalo', t: 'refs', to: 'misto' },
        { k: 'postavy', l: 'Koho se týká', t: 'refs', to: 'postava' },
        { k: 'note', l: 'Co se stalo', t: 'long' }
      ],
      groupBy: 'epocha'
    },
    zapis: {
      label: 'Zápis', plural: 'Zápisy', article: 'Nový zápis',
      icon: 'book', order: 5,
      fields: [
        { k: 'alias', l: 'Podtitul', t: 'text' },
        { k: 'note', l: 'Text', t: 'long' }
      ]
    }
  };

  var TYPE_ORDER = Object.keys(TYPES).sort(function (a, b) {
    return TYPES[a].order - TYPES[b].order;
  });

  function uid(p) {
    return (p || 'e') + Date.now().toString(36).slice(-5) +
      Math.random().toString(36).slice(2, 7);
  }

  /* první číslo v zápisu — pro řazení událostí a svazků.
     „4378 př. rl" je dřív než „145 rl", proto se letopočty před počátkem
     letopočtu berou záporně. */
  function yearKey(text) {
    var t = text || '';
    var m = /(-?\d+)/.exec(t);
    if (!m) return null;
    var n = parseInt(m[1], 10);
    // „př. rl", „před LL" hned za prvním číslem = záporný letopočet
    var rest = t.slice(m.index + m[1].length);
    var next = /\d/.exec(rest);
    if (next) rest = rest.slice(0, next.index);
    if (/(př\.|pred|před)/i.test(rest)) n = -n;
    return n;
  }

  function norm(s) {
    return (s || '').trim().toLowerCase();
  }

  var World = {
    TYPES: TYPES,
    TYPE_ORDER: TYPE_ORDER,
    uid: uid,
    yearKey: yearKey,

    blank: function (name) {
      return {
        id: uid('w'),
        name: name || 'Nový svět',
        created: Date.now(),
        entities: {},
        trees: {},
        treeOrder: [],
        calendar: {
          name: '', daysInMonth: '', daysInYear: '',
          months: [], holidays: [], note: ''
        }
      };
    },

    /* ---------- entity ---------- */

    create: function (world, type, data) {
      var e = { id: uid(type.slice(0, 1)), type: type, name: '' };
      var spec = TYPES[type];
      (spec ? spec.fields : []).forEach(function (f) {
        e[f.k] = f.t === 'refs' ? [] : '';
      });
      if (data) for (var k in data) e[k] = data[k];
      world.entities[e.id] = e;
      return e;
    },

    get: function (world, id) {
      return (id && world.entities[id]) || null;
    },

    label: function (world, id) {
      var e = this.get(world, id);
      if (!e) return '';
      return (e.name && e.name.trim()) || 'Bez názvu';
    },

    all: function (world, type) {
      var out = [];
      for (var id in world.entities) {
        var e = world.entities[id];
        if (!type || e.type === type) out.push(e);
      }
      return out.sort(function (a, b) {
        return (a.name || '').localeCompare(b.name || '', 'cs');
      });
    },

    count: function (world, type) {
      var n = 0;
      for (var id in world.entities) if (world.entities[id].type === type) n++;
      return n;
    },

    /* smaže entitu a uklidí odkazy na ni */
    remove: function (world, id) {
      delete world.entities[id];
      for (var k in world.entities) {
        var e = world.entities[k];
        var spec = TYPES[e.type];
        if (!spec) continue;
        spec.fields.forEach(function (f) {
          if (f.t === 'ref' && e[f.k] === id) e[f.k] = '';
          else if (f.t === 'refs' && Array.isArray(e[f.k])) {
            e[f.k] = e[f.k].filter(function (x) { return x !== id; });
          }
        });
      }
      // z rodokmenů
      for (var t in world.trees) {
        var tree = world.trees[t];
        if (tree.people) delete tree.people[id];
        for (var u in tree.unions) {
          var un = tree.unions[u];
          un.partners = un.partners.filter(function (x) { return x !== id; });
          un.children = un.children.filter(function (x) { return x !== id; });
        }
        if (tree.focusId === id) tree.focusId = Object.keys(tree.people || {})[0] || null;
      }
    },

    /* ---------- vazby ---------- */

    refsOf: function (world, entity) {
      var spec = TYPES[entity.type];
      var out = [];
      if (!spec) return out;
      spec.fields.forEach(function (f) {
        if (f.t === 'ref' && entity[f.k]) {
          var e = World.get(world, entity[f.k]);
          if (e) out.push({ field: f, target: e });
        } else if (f.t === 'refs' && Array.isArray(entity[f.k])) {
          entity[f.k].forEach(function (id) {
            var t = World.get(world, id);
            if (t) out.push({ field: f, target: t });
          });
        }
      });
      return out;
    },

    /* kdo se na entitu odkazuje — poli i odkazem [[…]] v textu */
    backlinks: function (world, id) {
      var target = this.get(world, id);
      if (!target) return [];
      var name = norm(target.name);
      var out = [];
      for (var k in world.entities) {
        var e = world.entities[k];
        if (e.id === id) continue;
        var spec = TYPES[e.type];
        if (!spec) continue;
        var hit = null;
        spec.fields.forEach(function (f) {
          if (hit) return;
          if (f.t === 'ref' && e[f.k] === id) hit = { field: f.k, why: f.l };
          else if (f.t === 'refs' && Array.isArray(e[f.k]) && e[f.k].indexOf(id) !== -1) {
            hit = { field: f.k, why: f.l };
          } else if ((f.t === 'long' || f.t === 'text') && name) {
            var links = World.linksIn(e[f.k]);
            for (var i = 0; i < links.length; i++) {
              if (norm(links[i]) === name) {
                hit = { field: null, why: 'zmínka v poli ' + f.l.toLowerCase() };
                break;
              }
            }
          }
        });
        if (hit) out.push({ entity: e, field: hit.field, why: hit.why });
      }
      return out.sort(function (a, b) {
        return (a.entity.name || '').localeCompare(b.entity.name || '', 'cs');
      });
    },

    /* [[odkazy]] v textu */
    linksIn: function (text) {
      var out = [], re = /\[\[([^\]]+)\]\]/g, m;
      while ((m = re.exec(text || ''))) out.push(m[1].trim());
      return out;
    },

    findByName: function (world, name) {
      var n = norm(name);
      for (var id in world.entities) {
        if (norm(world.entities[id].name) === n) return world.entities[id];
      }
      return null;
    },

    /* ---------- hledání ---------- */

    search: function (world, q, type) {
      q = norm(q);
      if (!q) return [];
      var out = [];
      for (var id in world.entities) {
        var e = world.entities[id];
        if (type && e.type !== type) continue;
        var score = 0;
        var name = norm(e.name), alias = norm(e.alias);
        if (name === q) score = 100;
        else if (name.indexOf(q) === 0) score = 80;
        else if (name.indexOf(q) !== -1) score = 60;
        else if (alias.indexOf(q) !== -1) score = 40;
        else {
          var spec = TYPES[e.type];
          var hit = spec && spec.fields.some(function (f) {
            return (f.t === 'long' || f.t === 'text') &&
              norm(e[f.k]).indexOf(q) !== -1;
          });
          if (hit) score = 20;
        }
        if (score) out.push({ entity: e, score: score });
      }
      return out.sort(function (a, b) {
        if (b.score !== a.score) return b.score - a.score;
        return (a.entity.name || '').localeCompare(b.entity.name || '', 'cs');
      }).map(function (r) { return r.entity; });
    },

    /* ---------- hierarchie (místa, národy) ---------- */

    roots: function (world, type) {
      var spec = TYPES[type];
      var key = spec && spec.tree;
      return this.all(world, type).filter(function (e) {
        return !key || !e[key] || !world.entities[e[key]];
      });
    },

    childrenOf: function (world, type, id) {
      var spec = TYPES[type];
      var key = spec && spec.tree;
      if (!key) return [];
      return this.all(world, type).filter(function (e) { return e[key] === id; });
    },

    /* ---------- události na ose ---------- */

    timeline: function (world) {
      var list = this.all(world, 'udalost');
      return list.sort(function (a, b) {
        var ka = yearKey(a.datum), kb = yearKey(b.datum);
        if (ka === null && kb === null) return 0;   // beze data — v pořadí zápisu
        if (ka === null) return 1;
        if (kb === null) return -1;
        return ka - kb;
      });
    },

    /* ---------- kalendář ---------- */

    calendarSummary: function (world) {
      var c = world.calendar || {};
      var parts = [];
      if (c.months && c.months.length) parts.push(c.months.length + ' měsíců');
      if (c.daysInMonth) parts.push(c.daysInMonth + ' dní v měsíci');
      if (c.daysInYear) parts.push(c.daysInYear + ' dní v roce');
      if (c.holidays && c.holidays.length) parts.push(c.holidays.length + ' svátků');
      return parts.join('  ·  ');
    }
  };

  global.FG = global.FG || {};
  global.FG.World = World;
})(window);
