/* Kroniky rodů — propojení všech částí */
(function (global) {
  'use strict';

  var S, UI, View, Layout;
  var stage, orbitHost;
  var currentLayout = null;
  var focusHistory = [];
  var pendingView = 'fit';

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

  function boot() {
    S = global.FG.Store; UI = global.FG.UI; View = global.FG.View; Layout = global.FG.Layout;

    var firstRun = false;
    try { firstRun = !global.localStorage.getItem('kroniky-rodu:v1'); } catch (e) { firstRun = true; }

    S.load();
    stage = q('#stage');
    orbitHost = q('#app');

    View.init(stage);
    View.onSelect = onSelect;
    View.onAction = onCanvasAction;
    UI.orbit.mount(orbitHost, onOrbitAction);

    buildRails();
    bindTools();
    bindKeys();
    paintIcons();

    S.onChange(function (reason) {
      if (reason === 'tree-switch' || reason === 'import' || reason === 'tree-create' ||
        reason === 'undo' || reason === 'redo' || reason === 'view' || reason === 'tree-delete') {
        pendingView = 'fit';
      } else if (reason === 'focus') {
        pendingView = 'center';
      }
      if (reason !== 'person-update' && reason !== 'settings') View.select(null);
      render();
    });

    render();
    View.fit(false);

    if (firstRun) welcome();
    else showHint('Klepnutím na kartu otevřete nabídku. Tažením posouváte, kolečkem přibližujete.', 5200);

    global.addEventListener('resize', function () {
      if (View.selectedId) View.select(View.selectedId);
    });
  }

  /* ---------------- vykreslení ---------------- */

  function render() {
    var tree = S.activeTree();
    if (!tree) return;
    var set = S.state.settings;
    document.body.setAttribute('data-theme', set.theme);

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

  /* ---------------- lišty ---------------- */

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
          var tree = S.activeTree();
          var patch = {};
          patch[key] = o.v;
          S.setView(tree, patch);
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
    document.querySelectorAll('.tool').forEach(function (btn) {
      btn.addEventListener('click', function () { tool(btn.getAttribute('data-act')); });
    });
    q('#btn-trees').addEventListener('click', function () { UI.treeManager(); });
  }

  function tool(act) {
    var tree = S.activeTree();
    switch (act) {
      case 'settings': UI.settings(); break;
      case 'search':
        UI.searchDialog(tree, function (id) {
          if (currentLayout.index[id]) {
            View.centerOn(id, true, true);
            View.select(id);
          } else {
            setFocus(id);
            UI.toast('Zaměřeno na ' + S.label(tree, id));
          }
        });
        break;
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
      case 'delete':
        UI.confirm('Smazat osobu ' + S.label(tree, id) + '?',
          'Osoba se odstraní ze stromu, její vazby zaniknou. Vrátit lze pomocí Ctrl+Z.',
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

      switch (k) {
        case 'escape': View.select(null); break;
        case 'f': ev.preventDefault(); tool('search'); break;
        case 't': UI.treeManager(); break;
        case 'e': tool('export'); break;
        case 'n': UI.settings(); break;
        case '0': View.fit(true); break;
        case 'c': View.centerOn(tree.focusId, true, true); break;
        case '+': case '=': View.zoomBy(1.2); break;
        case '-': View.zoomBy(1 / 1.2); break;
        case 'backspace': ev.preventDefault(); focusBack(); break;
        case 'enter': if (sel) UI.editPerson(tree, sel); break;
        case 'delete':
          if (sel) onOrbitAction('delete', sel);
          break;
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
    var m = UI.modal({
      title: 'Vítejte v Kronikách rodů',
      content: UI.h('div', {}, [
        UI.h('p', {
          class: 'dialog-text',
          text: 'Zakládejte rodokmeny pro postavy svého fantasy světa — bez omezení počtu ' +
            'pokolení i větví. Klepnutím na kartu osoby otevřete kruhovou nabídku, ' +
            'kde přidáte rodiče, partnera či potomka, propojíte vzdálené větve ' +
            'nebo osobu zaměříte a rozvinete strom kolem ní.'
        }),
        UI.h('p', {
          class: 'dialog-text',
          text: 'Vlevo nahoře nastavíte, kolik pokolení předků se má zobrazit, ' +
            'vlevo dole totéž pro potomky. Hotový strom uložíte jako obrázek ve formátu A5.'
        })
      ]),
      buttons: [
        {
          label: 'Prohlédnout ukázku',
          action: function () {
            var t = demoTree();
            S.setActiveTree(t.id);
            UI.toast('Ukázkový rod otevřen — zkuste si v něm klikat');
          }
        },
        {
          label: 'Založit vlastní rod', kind: 'primary',
          action: function () {
            var tree = S.activeTree();
            setTimeout(function () {
              View.select(tree.focusId);
              showHint('Začněte tím, že první postavě vyplníte jméno — Upravit v nabídce.', 6000);
            }, 220);
          }
        }
      ]
    });
    return m;
  }

  function demoTree() {
    var t = S.createTree('Rod Havraního hvozdu');
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
    // dva plnohodnotné svazky za sebou, každý s vlastními potomky
    var u4a = union(P.hrd, P.zena1, '925', '945'); kids(u4a, P.syn0);
    var u4 = union(P.hrd, P.zena, '950'); kids(u4, P.syn, P.dcera);
    var u5 = union(P.syn); kids(u5, P.vnuk);

    // původní prázdná osoba z nového stromu už není potřeba
    Object.keys(t.people).forEach(function (id) {
      var p = t.people[id];
      if (!p.name && !p.birth && !p.death && !p.note) delete t.people[id];
    });
    S.prune(t);
    t.focusId = P.hrd;
    t.view = { up: Infinity, down: Infinity };
    S.state.settings.collateral = 'all';
    S.emit('demo');
    return t;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else boot();
})(window);
