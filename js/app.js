/* Kroniky rodů — propojení všech částí */
(function (global) {
  'use strict';

  var S, UI, View, Layout, W, Pages;
  var stage, pageEl, treeSection;
  var currentLayout = null;
  var focusHistory = [];
  var pendingView = 'fit';

  var SECTIONS = [
    { id: 'prehled', label: 'Přehled', icon: 'home' },
    { id: 'postava', label: 'Postavy', icon: 'person' },
    { id: 'misto', label: 'Místa', icon: 'place' },
    { id: 'narod', label: 'Národy', icon: 'flag' },
    { id: 'udalost', label: 'Události', icon: 'event' },
    { id: 'kalendar', label: 'Kalendář', icon: 'moon' },
    { id: 'zapis', label: 'Zápisy', icon: 'book' },
    { id: 'rodokmeny', label: 'Rodokmeny', icon: 'trees' }
  ];

  var UP_OPTIONS = [
    { v: Infinity, big: '∞', small: 'vše' },
    { v: 4, big: '4', small: 'pokolení' },
    { v: 3, big: '3', small: 'pokolení' },
    { v: 2, big: '2', small: 'pokolení' },
    { v: 1, big: '1', small: 'rodiče' }
  ];
  var DOWN_OPTIONS = [
    { v: 1, big: '1', small: 'děti' },
    { v: 2, big: '2', small: 'vnoučata' },
    { v: 3, big: '3', small: 'pravnoučata' },
    { v: Infinity, big: '∞', small: 'vše' }
  ];

  function q(sel) { return document.querySelector(sel); }

  /* ---------------- start ---------------- */

  function boot() {
    S = global.FG.Store; UI = global.FG.UI; View = global.FG.View;
    Layout = global.FG.Layout; W = global.FG.World; Pages = global.FG.Pages;

    var firstRun = false;
    try { firstRun = !global.localStorage.getItem('kroniky-rodu:v1'); } catch (e) { firstRun = true; }

    S.load();
    stage = q('#stage');
    pageEl = q('#page');
    treeSection = q('#tree-section');

    View.init(stage);
    View.onSelect = onSelect;
    View.onAction = onCanvasAction;
    UI.orbit.mount(treeSection, onOrbitAction);

    buildSidebar();
    buildRails();
    bindTools();
    bindKeys();
    paintIcons();

    S.onChange(function (reason) {
      if (reason === 'tree-switch' || reason === 'import' || reason === 'tree-create' ||
        reason === 'undo' || reason === 'redo' || reason === 'view' ||
        reason === 'tree-delete' || reason === 'world-switch') {
        pendingView = 'fit';
      } else if (reason === 'focus') {
        pendingView = 'center';
      }
      if (reason !== 'person-update' && reason !== 'settings') View.select(null);
      App.render();
    });

    var last = S.state.settings.section;
    if (last && (last === 'prehled' || last === 'kalendar' || last === 'rodokmeny' ||
      global.FG.World.TYPES[last])) {
      App.section = last;
    }
    App.render();
    if (firstRun) welcome();

    global.addEventListener('resize', function () {
      if (View.selectedId) View.select(View.selectedId);
    });
  }

  /* ---------------- rozcestník ---------------- */

  var App = {
    section: 'prehled',
    detail: null,
    history: [],

    go: function (section, skipHistory) {
      if (!skipHistory) this.history.push({ section: this.section, detail: this.detail });
      this.section = section;
      this.detail = null;
      remember(section);
      this.render();
    },

    open: function (id, skipHistory) {
      if (!skipHistory) this.history.push({ section: this.section, detail: this.detail });
      var e = W.get(S.activeWorld(), id);
      if (e && W.TYPES[e.type]) this.section = e.type;
      this.detail = id;
      remember(this.section);
      this.render();
    },

    back: function () {
      var prev = this.history.pop();
      if (prev) {
        this.section = prev.section;
        this.detail = prev.detail;
      } else {
        this.section = 'prehled';
        this.detail = null;
      }
      this.render();
    },

    /* z detailu postavy rovnou do jejího rodokmenu */
    showInTree: function (personId) {
      var world = S.activeWorld();
      var tree = S.treeOf(world, personId);
      if (!tree) { UI.toast('Postava zatím není v žádném rodokmenu.', 'warn'); return; }
      if (world.activeTreeId !== tree.id) world.activeTreeId = tree.id;
      S.setFocus(tree, personId);
      this.go('rodokmeny');
    },

    render: function () {
      var world = S.activeWorld();
      if (!world) return;
      document.body.setAttribute('data-theme', S.state.settings.theme);
      q('#world-name').textContent = world.name;
      q('#world-meta').textContent = worldMeta(world);

      var links = document.querySelectorAll('#sections .side-link');
      for (var i = 0; i < links.length; i++) {
        links[i].classList.toggle('on', links[i].getAttribute('data-sec') === App.section);
      }

      var onTree = App.section === 'rodokmeny' && !App.detail;
      treeSection.classList.toggle('on', onTree);
      pageEl.classList.toggle('on', !onTree);

      if (onTree) renderTree();
      else Pages.render(pageEl, App.section, App.detail);
    }
  };

  /* aplikace si pamatuje, kde jste naposledy byli */
  function remember(section) {
    try {
      S.state.settings.section = section;
      S.save();
    } catch (e) { /* na úložišti nezáleží */ }
  }

  function worldMeta(world) {
    var n = W.count(world, 'postava');
    var m = W.count(world, 'misto');
    return n + ' postav · ' + m + ' míst';
  }

  function buildSidebar() {
    var nav = q('#sections');
    SECTIONS.forEach(function (sec) {
      var b = UI.h('button', {
        class: 'side-link', type: 'button', 'data-sec': sec.id, title: sec.label
      }, [
        UI.h('span', { class: 'side-ico', html: UI.icon(sec.icon, 20) }),
        UI.h('span', { class: 'side-label', text: sec.label })
      ]);
      b.addEventListener('click', function () { App.go(sec.id); });
      nav.appendChild(b);
    });
    q('#btn-world').addEventListener('click', function () { UI.worldManager(); });
  }

  /* ---------------- rodokmen ---------------- */

  function renderTree() {
    var tree = S.activeTree();
    if (!tree) return;
    var set = S.state.settings;

    // prázdný rodokmen: není kam klepnout, nabídneme rovnou první postavu
    var empty = q('#tree-empty');
    if (!Object.keys(tree.people).length) {
      if (!empty) {
        empty = UI.h('div', { id: 'tree-empty', class: 'tree-empty' }, [
          UI.h('p', { text: 'Rodokmen „' + tree.name + '" je zatím prázdný.' }),
          UI.h('button', {
            class: 'btn primary', type: 'button', text: 'Založit první postavu',
            onclick: function () {
              var t = S.activeTree();
              S.snapshot();
              var p = S.newPerson(t, { name: '' });
              t.focusId = p.id;
              S.emit('person-add');
              setTimeout(function () { View.select(p.id); }, 260);
            }
          })
        ]);
        treeSection.appendChild(empty);
      }
      empty.style.display = '';
    } else if (empty) {
      empty.style.display = 'none';
    }

    currentLayout = Layout.compute(tree, {
      focusId: tree.focusId,
      up: tree.view.up,
      down: tree.view.down,
      collateral: set.collateral,
      showPartners: set.showPartners
    });

    View.render(tree, currentLayout, set);
    updateChrome(tree);

    if (pendingView === 'fit') View.fit(true);
    else if (pendingView === 'center') View.centerOn(tree.focusId, true, true);
    else if (pendingView === null && !View.layoutReady) View.fit(false);
    pendingView = null;
  }

  function updateChrome(tree) {
    q('#tree-name').textContent = tree.name;
    var focus = tree.people[tree.focusId];
    var total = Object.keys(tree.people).length;
    var shown = currentLayout ? currentLayout.persons.length : 0;
    q('#focus-name').textContent =
      (focus ? ((focus.name || '').trim() || 'Bez jména') : '—') +
      ' · ' + shown + (shown < total ? ' z ' + total : '') + ' ' + osob(shown);

    markRail('#rail-up', tree.view.up);
    markRail('#rail-down', tree.view.down);
  }

  function osob(n) {
    if (n === 1) return 'osoba';
    if (n >= 2 && n <= 4) return 'osoby';
    return 'osob';
  }

  function markRail(sel, value) {
    var btns = document.querySelectorAll(sel + ' .rail-btn');
    for (var i = 0; i < btns.length; i++) {
      var v = btns[i].getAttribute('data-value');
      var num = v === 'inf' ? Infinity : parseInt(v, 10);
      btns[i].classList.toggle('on', num === value);
    }
  }

  function buildRails() {
    function make(host, options, key) {
      options.forEach(function (o) {
        var b = UI.h('button', {
          class: 'rail-btn', 'data-value': o.v === Infinity ? 'inf' : String(o.v),
          title: (key === 'up' ? 'Předci: ' : 'Potomci: ') + o.big + ' ' + o.small
        }, [
          UI.h('span', { class: 'rb-ico', text: o.big }),
          UI.h('span', { text: o.small })
        ]);
        b.addEventListener('click', function () {
          var patch = {};
          patch[key] = o.v;
          S.setView(S.activeTree(), patch);
        });
        host.appendChild(b);
      });
    }
    make(q('#rail-up'), UP_OPTIONS, 'up');
    make(q('#rail-down'), DOWN_OPTIONS, 'down');
  }

  function paintIcons() {
    var nodes = document.querySelectorAll('[data-icon]');
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].innerHTML = UI.icon(nodes[i].getAttribute('data-icon'), 21);
    }
  }

  function bindTools() {
    document.querySelectorAll('.tool, .side-tool').forEach(function (btn) {
      btn.addEventListener('click', function () { tool(btn.getAttribute('data-act')); });
    });
    q('#btn-trees').addEventListener('click', function () { UI.treeManager(); });
  }

  function tool(act) {
    var tree = S.activeTree();
    switch (act) {
      case 'settings': UI.settings(); break;
      case 'search': UI.worldSearch(); break;
      case 'export': UI.exportDialog(tree, currentLayout); break;
      case 'undo':
        if (!S.undo()) UI.toast('Není co vrátit.', 'warn');
        else UI.toast('Vráceno zpět');
        break;
      case 'zoom-in': View.zoomBy(1.2); break;
      case 'zoom-out': View.zoomBy(1 / 1.2); break;
      case 'fit': View.fit(true); break;
      case 'center': View.centerOn(tree.focusId, true, true); break;
    }
  }

  /* ---------------- interakce s plátnem ---------------- */

  function onSelect(id, pos) {
    if (!id || !pos) { UI.orbit.hide(); return; }
    var tree = S.activeTree();
    var disabled = [];
    if (S.parentsOf(tree, id).length >= 2) disabled.push('parents');
    if (!S.relationsOf(tree, id).length) disabled.push('unlink');
    if (Object.keys(tree.people).length < 2) disabled.push('link');
    if (id === tree.focusId) disabled.push('focus');
    UI.orbit.show(id, pos, { disabled: disabled });
  }

  function onCanvasAction(action, id) {
    var tree = S.activeTree();
    if (action === 'focus') { setFocus(id); return; }
    if (action === 'union') { UI.unionDialog(tree, id); return; }
    if (action === 'expand-up' || action === 'expand-down') {
      setFocus(id);
      UI.toast('Zaměřeno na ' + S.label(tree, id) + ' — strom se rozvine kolem ní');
    }
  }

  function onOrbitAction(action, id) {
    var tree = S.activeTree();
    switch (action) {
      case 'close': View.select(id || null); break;
      case 'edit': UI.editPerson(tree, id); break;
      case 'parents': UI.addParents(tree, id); break;
      case 'partner': UI.addPartner(tree, id); break;
      case 'child': UI.addChild(tree, id); break;
      case 'link': UI.linkPerson(tree, id); break;
      case 'unlink': UI.unlinkPerson(tree, id); break;
      case 'focus': setFocus(id); break;
      case 'detail': View.select(null); App.open(id); break;
      case 'delete':
        UI.confirm('Smazat osobu ' + S.label(tree, id) + '?',
          'Osoba se odstraní ze stromu i ze světa. Vrátit lze pomocí Ctrl+Z.',
          function () { S.deletePerson(tree, id); UI.toast('Osoba smazána'); }, 'Smazat');
        break;
    }
  }

  function setFocus(id) {
    var tree = S.activeTree();
    if (tree.focusId && tree.focusId !== id) focusHistory.push(tree.focusId);
    S.setFocus(tree, id);
  }

  function focusBack() {
    var tree = S.activeTree();
    var prev = focusHistory.pop();
    if (!prev || !tree.people[prev]) { UI.toast('Není kam se vrátit.', 'warn'); return; }
    S.setFocus(tree, prev);
  }

  /* ---------------- klávesnice ---------------- */

  function bindKeys() {
    document.addEventListener('keydown', function (ev) {
      var t = ev.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
      if (document.querySelector('.modal-back')) return;
      var onTree = App.section === 'rodokmeny' && !App.detail;
      var tree = S.activeTree();
      var sel = View.selectedId;
      var k = ev.key.toLowerCase();

      if ((ev.ctrlKey || ev.metaKey) && k === 'z') {
        ev.preventDefault();
        if (ev.shiftKey) { if (S.redo()) UI.toast('Znovu'); }
        else if (S.undo()) UI.toast('Vráceno zpět');
        return;
      }
      if ((ev.ctrlKey || ev.metaKey) && k === 'y') { ev.preventDefault(); S.redo(); return; }
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return;

      if (k === 'f') { ev.preventDefault(); UI.worldSearch(); return; }
      if (k === 'escape') {
        if (onTree && View.selectedId) View.select(null);
        else App.back();
        return;
      }
      if (k === 'backspace') { ev.preventDefault(); App.back(); return; }

      if (!onTree) return;
      switch (k) {
        case 't': UI.treeManager(); break;
        case 'e': tool('export'); break;
        case '0': View.fit(true); break;
        case 'c': View.centerOn(tree.focusId, true, true); break;
        case '+': case '=': View.zoomBy(1.2); break;
        case '-': View.zoomBy(1 / 1.2); break;
        case 'enter': if (sel) UI.editPerson(tree, sel); break;
        case 'delete': if (sel) onOrbitAction('delete', sel); break;
      }
    });
  }

  /* ---------------- první spuštění ---------------- */

  function showHint(text, ms) {
    var el = q('#hint');
    el.textContent = text;
    el.classList.add('on');
    clearTimeout(showHint._t);
    showHint._t = setTimeout(function () { el.classList.remove('on'); }, ms || 4000);
  }

  function welcome() {
    UI.modal({
      title: 'Vítejte v Kronikách rodů',
      content: UI.h('div', {}, [
        UI.h('p', {
          class: 'dialog-text',
          text: 'Tady se staví celý fantasy svět: postavy, místa, národy, události, ' +
            'kalendář a rodokmeny. Všechno se dá mezi sebou provázat a proklikat — ' +
            'z postavy na její město, z města na národ, z události na ty, kdo v ní ' +
            'vystupovali.'
        }),
        UI.h('p', {
          class: 'dialog-text',
          text: 'V textech stačí napsat [[Jméno]] a vznikne odkaz. Rodokmeny jsou ' +
            'jednou ze sekcí vlevo a osoby v nich jsou tytéž postavy jako v seznamu.'
        })
      ]),
      buttons: [
        {
          label: 'Prohlédnout ukázku',
          action: function () {
            demoWorld();
            UI.toast('Ukázkový svět otevřen');
          }
        },
        { label: 'Začít od nuly', kind: 'primary' }
      ]
    });
  }

  function demoWorld() {
    var world = S.activeWorld();
    var t = S.trees()[0];
    var P = {};
    function person(key, name, gender, birth, death, note) {
      var p = S.newPerson(t, { name: name, gender: gender, birth: birth, death: death, note: note || '' });
      P[key] = p.id;
      return p.id;
    }
    function union(a, b, start, end) {
      return S.newUnion(t, b ? [a, b] : [a], { start: start || '', end: end || '' });
    }
    function kids(u) {
      for (var i = 1; i < arguments.length; i++) {
        u.children.push(arguments[i]);
        t.people[arguments[i]].parentUnionId = u.id;
      }
    }

    world.name = 'Havraní hvozd';
    t.name = 'Rod Havraního hvozdu';

    var narod = W.create(world, 'narod', {
      name: 'Havraní rod', alias: 'Corvid', symbol: 'černý havran ve stříbrném poli',
      note: 'Rod, který drží [[Hvozdovou tvrz]] od časů zakladatele.'
    });
    var kraj = W.create(world, 'misto', {
      name: 'Havraní hvozd', druh: 'kraj',
      note: 'Rozlehlý les na severu, protkaný Černou řekou.'
    });
    var tvrz = W.create(world, 'misto', {
      name: 'Hvozdová tvrz', druh: 'tvrz', parent: kraj.id, narod: narod.id,
      obyvatel: '2 000 obyvatel', note: 'Sídlo rodu nad soutokem.'
    });
    W.create(world, 'misto', {
      name: 'Síň předků', druh: 'místnost', parent: tvrz.id,
      note: 'Dlouhá síň s podobiznami všech pánů Hvozdu.'
    });

    person('pra1', 'Orlan Havran', 'm', '812', '889', 'Zakladatel rodu, první pán Hvozdu.');
    person('pra2', 'Sylva z Mlžin', 'f', '818', '901');
    person('ded1', 'Rovan Havran', 'm', '845', '918', 'Postavil pevnost nad Černou řekou.');
    person('ded2', 'Mirena Jasanová', 'f', '850', '922');
    person('str1', 'Tomáš Havran', 'm', '848', '870', 'Padl v bitvě u Šedého brodu.');
    person('otec', 'Aeldrin Havran', 'm', '876', '944', 'Pán Hvozdu v době Dračích válek.');
    person('matka', 'Elísa z Ostrova', 'f', '880', '951');
    person('teta', 'Rada Havranová', 'f', '879', '940');
    person('tetin', 'Bors Kamenný', 'm', '870', '939');
    person('hrd', 'Kaeler Havran', 'm', '905', '', 'Hlavní hrdina kroniky. Nositel meče Jitřenka.');
    person('zena1', 'Sirin z Popelavého dolu', 'f', '907', '945', 'První žena Kaelerova.');
    person('zena', 'Nyra z Jilmu', 'f', '909', '', 'Léčitelka, sestra řádu Bílého jilmu.');
    person('sestra', 'Idra Havranová', 'f', '907', '', 'Kapitánka jízdní stráže.');
    person('bratr', 'Torm Havran', 'm', '911', '958');
    person('bratranec', 'Vilém Kamenný', 'm', '901', '', 'Spojenec z vedlejší větve rodu.');
    person('syn0', 'Aran Havran', 'm', '928', '', 'Syn z prvního svazku.');
    person('syn', 'Renar Havran', 'm', '951', '', 'Dědic Hvozdu.');
    person('dcera', 'Lira Havranová', 'f', '954', '');
    person('vnuk', 'Orlan Havran mladší', 'm', '978', '', 'Pojmenován po zakladateli rodu.');

    var u0 = union(P.pra1, P.pra2, '838', '889'); kids(u0, P.ded1, P.str1);
    var u1 = union(P.ded1, P.ded2, '872', '918'); kids(u1, P.otec, P.teta);
    var u2 = union(P.otec, P.matka, '902', '944'); kids(u2, P.hrd, P.sestra, P.bratr);
    var u3 = union(P.teta, P.tetin, '898', '939'); kids(u3, P.bratranec);
    var u4a = union(P.hrd, P.zena1, '925', '945'); kids(u4a, P.syn0);
    var u4 = union(P.hrd, P.zena, '950'); kids(u4, P.syn, P.dcera);
    var u5 = union(P.syn); kids(u5, P.vnuk);

    // postavy jsou entity světa — rovnou je zařadíme
    [P.pra1, P.ded1, P.otec, P.hrd, P.syn].forEach(function (id) {
      world.entities[id].narod = narod.id;
      world.entities[id].misto = tvrz.id;
    });

    W.create(world, 'udalost', {
      name: 'Založení Hvozdové tvrze', datum: '846', epocha: 'První věk',
      mista: [tvrz.id], postavy: [P.ded1],
      note: '[[Rovan Havran]] nechal nad soutokem vystavět tvrz.'
    });
    W.create(world, 'udalost', {
      name: 'Bitva u Šedého brodu', datum: '870', epocha: 'První věk',
      postavy: [P.str1],
      note: 'Padl zde [[Tomáš Havran]].'
    });
    W.create(world, 'udalost', {
      name: 'Dračí války', datum: '921 – 934', epocha: 'Druhý věk',
      postavy: [P.otec], mista: [kraj.id]
    });

    world.calendar = {
      name: 'Hvozdový kalendář', daysInMonth: '30', daysInYear: '360',
      months: [
        { name: 'Tání', translation: '', season: 'Jaro' },
        { name: 'Probouzení', translation: '', season: 'Jaro' },
        { name: 'Sklizeň', translation: '', season: 'Podzim' },
        { name: 'Jinovatka', translation: '', season: 'Zima' }
      ],
      holidays: [
        { name: 'Noc havranů', translation: '', when: 'poslední tři dny v roce',
          description: 'Rod se schází v Síni předků.' }
      ],
      note: ''
    };

    t.focusId = P.hrd;
    t.view = { up: Infinity, down: Infinity };
    S.state.settings.collateral = 'all';
    S.emit('demo');
    App.go('prehled');
  }

  global.FG = global.FG || {};
  global.FG.App = App;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else boot();
})(window);
