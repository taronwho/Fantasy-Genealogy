/* Kroniky rodů — propojení všech částí */
(function (global) {
  'use strict';

  var S, UI, View, Layout, W, Pages;
  var stage, pageEl, treeSection;
  var currentLayout = null;
  var focusHistory = [];
  var pendingView = 'fit';
  var skrytiCil = null;   // osoba stranou stromu, na kterou míří tlačítko

  /* primary = na mobilu zůstává ve spodní liště, ostatní jsou pod „Více" */
  var SECTIONS = [
    { id: 'prehled', label: 'Přehled', icon: 'home', primary: true },
    { id: 'postava', label: 'Postavy', icon: 'person', primary: true },
    { id: 'misto', label: 'Místa', icon: 'place', primary: true },
    { id: 'narod', label: 'Národy', icon: 'flag' },
    { id: 'udalost', label: 'Události', icon: 'event', primary: true },
    { id: 'kalendar', label: 'Kalendář', icon: 'moon' },
    { id: 'zapis', label: 'Zápisy', icon: 'book' },
    { id: 'rodokmeny', label: 'Rodokmeny', icon: 'trees', primary: true }
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
    View.onDrag = dragPerson;
    UI.orbit.mount(treeSection, onOrbitAction);

    initHistory();
    Sync = global.FG.Sync;
    Sync.onStav(function (stav) {
      if (stav === 'chyba' && cloudStavMinuly !== 'chyba') {
        UI.toast('Záloha do cloudu se nepovedla: ' + Sync.zprava, 'warn');
      }
      cloudStavMinuly = stav;
      UI.cloudRefresh();
      if (App.section === 'prehled' && !App.detail) App.render();
    });
    global.document.addEventListener('visibilitychange', function () {
      if (global.document.visibilityState === 'hidden' && cloudCekani) App.cloudUloz();
    });
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
      cloudNaplanuj();
    });

    var last = S.state.settings.section;
    if (last && (last === 'prehled' || last === 'kalendar' || last === 'rodokmeny' ||
      global.FG.World.TYPES[last])) {
      App.section = last;
    }
    App.render();
    if (firstRun) welcome();
    App.cloudStart();

    global.addEventListener('resize', function () {
      if (View.selectedId) View.select(View.selectedId);
    });
  }

  /* ---------------- záloha do cloudu ---------------- */
  /* Svět žije v prohlížeči; pokud je nastavené propojení s GitHubem,
     po každé změně se navíc uloží do soukromého repozitáře uživatele. */

  var Sync = null;                 // FG.Sync, doplní se v init()
  var cloudCekani = null;
  var cloudTicho = false;          // při načítání z cloudu zpět neukládáme
  var cloudPrvni = true;
  var cloudStavMinuly = 'off';

  function cloudNaplanuj() {
    if (!Sync || !Sync.zapnuto() || cloudTicho) return;
    clearTimeout(cloudCekani);
    cloudCekani = setTimeout(function () { App.cloudUloz(); }, 2500);
    UI.cloudRefresh();
  }

  function cloudSouhrnMistni() {
    try { return UI.cloudSouhrn(JSON.parse(S.exportJSON())); }
    catch (e) { return 'neznámý obsah'; }
  }

  /* dvě různé verze — rozhodnout musí uživatel, nic se nepřepíše samo */
  function cloudVolba(data, r) {
    UI.modal({
      title: 'V cloudu je jiná verze',
      wide: true,
      content: UI.h('div', {}, [
        UI.h('p', {
          class: 'dialog-text',
          text: 'Záloha v cloudu se liší od toho, co máte otevřené tady. ' +
            'Vyberte, která verze platí dál — druhá se přepíše.'
        }),
        UI.h('div', { class: 'card-list' }, [
          UI.h('div', { class: 'wide-row' }, [
            UI.h('span', { class: 'ent-name', text: 'V cloudu' }),
            UI.h('span', {
              class: 'ent-meta',
              text: UI.cloudSouhrn(data) + '  ·  ' + UI.kdyText(data.changedAt)
            })
          ]),
          UI.h('div', { class: 'wide-row' }, [
            UI.h('span', { class: 'ent-name', text: 'Zde v prohlížeči' }),
            UI.h('span', {
              class: 'ent-meta',
              text: cloudSouhrnMistni() + '  ·  ' + UI.kdyText(S.state.changedAt)
            })
          ])
        ])
      ]),
      buttons: [
        { label: 'Rozhodnu později' },
        {
          label: 'Nechat zdejší', action: function () {
            Sync.setConfig({ sha: r.sha });
            App.cloudUloz('Přepsáno verzí z prohlížeče');
          }
        },
        {
          label: 'Načíst z cloudu', kind: 'primary', action: function () {
            App.cloudPrevzit(r);
          }
        }
      ]
    });
  }

  /* ---------------- historie prohlížeče ---------------- */
  /* Tlačítko Zpět na telefonu má vracet stejně jako Zpět v aplikaci.
     Za každý krok proto vložíme jeden záznam do historie prohlížeče a
     samotný návrat vždy vede přes ni — ať se obojí nerozejde. */

  var histDepth = 0;
  var hasHistory = !!(global.history && global.history.pushState);

  function pushHistory() {
    if (!hasHistory) return;
    histDepth += 1;
    try { global.history.pushState({ fg: histDepth }, ''); }
    catch (e) { histDepth -= 1; hasHistory = false; }
  }

  function initHistory() {
    if (!hasHistory) return;
    try { global.history.replaceState({ fg: 0 }, ''); }
    catch (e) { hasHistory = false; return; }      // např. spuštění ze souboru
    global.addEventListener('popstate', function () {
      // shora dolů: dialog → kruhová nabídka → krok zpět ve světě
      if (UI.closeTop()) { pushHistory(); return; }
      if (UI.orbit.id) { View.select(null); pushHistory(); return; }
      if (histDepth > 0) histDepth -= 1;
      App.backNow();
    });
  }

  /* Kam se člověk vrací: kromě části světa i to, kam byl seznam odrolovaný. */
  function here() {
    return {
      section: App.section,
      detail: App.detail,
      scroll: pageEl ? pageEl.scrollTop : 0
    };
  }

  function scrollTo(y) {
    if (!pageEl) return;
    pageEl.scrollTop = y || 0;
    // po dokreslení (písma, obrázky) ještě jednou, ať to opravdu sedí
    global.requestAnimationFrame(function () { pageEl.scrollTop = y || 0; });
  }

  /* ---------------- rozcestník ---------------- */

  var App = {
    section: 'prehled',
    detail: null,
    history: [],

    go: function (section, skipHistory) {
      if (!skipHistory) {
        this.history.push(here());
        pushHistory();
      }
      this.section = section;
      this.detail = null;
      remember(section);
      this.render();
    },

    open: function (id, skipHistory) {
      if (!skipHistory) {
        this.history.push(here());
        pushHistory();
      }
      var e = W.get(S.activeWorld(), id);
      if (e && W.TYPES[e.type]) this.section = e.type;
      this.detail = id;
      remember(this.section);
      this.render();
    },

    /* návrat pouštíme historií prohlížeče, ať tlačítko na telefonu
       i tlačítko v aplikaci dělají totéž */
    back: function () {
      if (hasHistory && histDepth > 0) { global.history.back(); return; }
      this.backNow();
    },

    backNow: function () {
      var prev = this.history.pop();
      if (prev) {
        this.section = prev.section;
        this.detail = prev.detail;
      } else {
        this.section = 'prehled';
        this.detail = null;
      }
      remember(this.section);
      this.render();
      scrollTo(prev ? prev.scroll : 0);
    },

    /* ---------- záloha do cloudu ---------- */

    cloudCeka: function () { return !!cloudCekani; },

    cloudUloz: function (popis) {
      clearTimeout(cloudCekani);
      cloudCekani = null;
      if (!Sync || !Sync.zapnuto()) return;
      Sync.push(S.exportJSON(), popis).then(function () {
        if (cloudPrvni) { cloudPrvni = false; UI.toast('Svět uložen do cloudu'); }
      }).catch(function (e) {
        if (e.stav === 409 || e.stav === 422) {
          Sync.pull().then(function (r) {
            if (!r) return;
            var data = null;
            try { data = JSON.parse(r.text); } catch (x) {}
            if (data) cloudVolba(data, r);
          }).catch(function () {});
        }
      });
    },

    cloudPrevzit: function (r) {
      cloudTicho = true;
      try {
        S.importJSON(r.text, 'replace');
        Sync.setConfig({ sha: r.sha, kdy: Date.now() });
        UI.toast('Načteno z cloudu');
      } catch (e) {
        UI.toast('Zálohu se nepodařilo načíst: ' + e.message, 'warn');
      }
      cloudTicho = false;
    },

    cloudNacti: function () {
      if (!Sync || !Sync.zapnuto()) { UI.cloudDialog(); return; }
      Sync.pull().then(function (r) {
        if (!r) { UI.toast('V cloudu zatím nic není.', 'warn'); return; }
        UI.confirm('Načíst z cloudu?',
          'Nahradí to všechna data v tomto prohlížeči. Vrátit lze pomocí Ctrl+Z.',
          function () { App.cloudPrevzit(r); }, 'Načíst');
      }).catch(function (e) { UI.toast(e.message, 'warn'); });
    },

    /* po spuštění a po propojení: srovnat, co je tady a co v cloudu */
    cloudStart: function () {
      if (!Sync || !Sync.zapnuto()) return;
      Sync.pull().then(function (r) {
        if (!r) { App.cloudUloz('První záloha světa'); return; }
        var data = null;
        try { data = JSON.parse(r.text); } catch (e) {}
        if (!data) { App.cloudUloz(); return; }
        if (r.sha === Sync.znameSha()) {
          // v cloudu leží přesně naše poslední uložení
          if ((S.state.changedAt || 0) > (Sync.config().kdy || 0)) App.cloudUloz();
          return;
        }
        cloudVolba(data, r);
      }).catch(function () {});
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
        class: 'side-link', type: 'button', 'data-sec': sec.id,
        'data-primary': sec.primary ? '1' : '0', title: sec.label
      }, [
        UI.h('span', { class: 'side-ico', html: UI.icon(sec.icon, 20) }),
        UI.h('span', { class: 'side-label', text: sec.label })
      ]);
      b.addEventListener('click', function () { App.go(sec.id); });
      nav.appendChild(b);
    });
    var more = UI.h('button', {
      class: 'side-link more-link', type: 'button', title: 'Další části světa'
    }, [
      UI.h('span', { class: 'side-ico', html: UI.icon('more', 20) }),
      UI.h('span', { class: 'side-label', text: 'Více' })
    ]);
    more.addEventListener('click', moreMenu);
    nav.appendChild(more);
    q('#btn-world').addEventListener('click', function () { UI.worldManager(); });
  }

  /* nabídka zbylých částí — na mobilu se do lišty nevejdou */
  function moreMenu() {
    var m;
    var list = UI.h('div', { class: 'card-list' });
    function row(icon, label, meta, fn) {
      list.appendChild(UI.h('button', {
        class: 'ent-row with-ico', type: 'button',
        onclick: function () { m.close(); fn(); }
      }, [
        UI.h('span', { class: 'row-ico', html: UI.icon(icon, 20) }),
        UI.h('span', { class: 'ent-main' }, [UI.h('span', { class: 'ent-name', text: label })]),
        UI.h('span', { class: 'ent-meta', text: meta || '' })
      ]));
    }
    var world = S.activeWorld();
    SECTIONS.forEach(function (sec) {
      if (sec.primary) return;
      var n = W.TYPES[sec.id] ? W.count(world, sec.id) : '';
      row(sec.icon, sec.label, n === '' ? '' : String(n), function () { App.go(sec.id); });
    });
    row('search', 'Hledat ve světě', '', function () { UI.worldSearch(); });
    row('world', 'Světy a zálohy', world.name, function () { UI.worldManager(); });
    row('gear', 'Nastavení', '', function () { UI.settings(); });
    m = UI.modal({ title: 'Další části světa', content: list, buttons: [{ label: 'Zavřít' }] });
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
    updateSkryti(tree, total - shown);
    updatePosun(tree);
  }

  /* Ručně posunuté karty jde vrátit tam, kam je vypočítá aplikace.
     Bez toho by se z nepovedeného přesunu šlo dostat jen krokem zpět. */
  function updatePosun(tree) {
    var btn = q('#btn-posun');
    if (!btn) return;
    var ids = S.nudged(tree);
    if (!ids.length) { btn.hidden = true; return; }
    btn.hidden = false;
    btn.textContent = ids.length + ' posunut' +
      (ids.length === 1 ? 'á' : ids.length < 5 ? 'é' : 'ých');
    btn.title = 'Ručně přesunuté karty: ' +
      ids.map(function (id) { return S.label(tree, id); }).join(', ') +
      '. Klepnutím je vrátíte tam, kam je umístí aplikace.';
  }

  function srovnejPosuny() {
    var tree = S.activeTree();
    if (!tree) return;
    var ids = S.nudged(tree);
    if (!ids.length) return;
    UI.confirm('Srovnat posunuté karty?',
      'Vrátí se na místo, které jim vypočítá aplikace — jde o ' + ids.length +
      ' kartu/karty: ' + ids.map(function (id) { return S.label(tree, id); }).join(', ') +
      '. Vrátit lze pomocí Ctrl+Z.',
      function () {
        S.clearNudges(tree);
        pendingView = 'fit';
        UI.toast('Karty srovnány');
      }, 'Srovnat');
  }

  /* Kdo se nekreslí, není poznat — a nastavení, které ho schovává, může
     být na každém zařízení jiné. Tlačítko proto řekne kolik a proč,
     a jedním klepnutím zobrazí celý rod. */
  function updateSkryti(tree, kolik) {
    var btn = q('#btn-skryti');
    if (!btn) return;
    if (kolik <= 0) { btn.hidden = true; skrytiCil = null; return; }
    var set = S.state.settings;
    var vetve = set.collateral !== 'all';
    var pokoleni = tree.view.up !== Infinity || tree.view.down !== Infinity;
    btn.hidden = false;
    if (vetve || pokoleni) {
      skrytiCil = null;
      btn.textContent = kolik + ' skryt' + (kolik === 1 ? 'á' : kolik < 5 ? 'é' : 'ých');
      var duvod = [];
      if (vetve) {
        duvod.push('vedlejší větve jsou omezené na „' +
          (set.collateral === 'none' ? 'Jen přímou linii' : 'Se sourozenci') + '“');
      }
      if (pokoleni) duvod.push('je omezený počet pokolení');
      btn.title = kolik + ' příbuzných se nekreslí, protože ' + duvod.join(' a ') +
        '. Klepnutím zobrazíte celý rod.';
      return;
    }
    // Nic je neschovává — prostě nemají vazbu na nikoho ve stromu.
    var stranou = Object.keys(tree.people).filter(function (id) {
      return !currentLayout.index[id];
    });
    skrytiCil = stranou[0] || null;
    btn.textContent = kolik + ' bez vazby';
    btn.title = 'Tyto osoby nemají vazbu na nikoho v rodokmenu, takže je není ' +
      'kam nakreslit: ' + stranou.map(function (id) { return S.label(tree, id); }).join(', ') +
      '. Klepnutím se na první z nich zaměříte.';
  }

  function onSkrytiClick() {
    var tree = S.activeTree();
    if (!tree) return;
    if (skrytiCil) { setFocus(skrytiCil); return; }
    S.state.settings.collateral = 'all';
    tree.view.up = Infinity;
    tree.view.down = Infinity;
    pendingView = 'fit';
    S.emit('settings');
    UI.toast('Zobrazen celý rod');
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
    q('#btn-skryti').addEventListener('click', onSkrytiClick);
    q('#btn-posun').addEventListener('click', srovnejPosuny);
    var misto = q('#cloud-tool');
    if (misto) misto.appendChild(UI.cloudTlacitko({ tool: true }));
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
    if (!S.canMove(tree, id, -1) && !canSwapSide(id, -1)) disabled.push('left');
    if (!S.canMove(tree, id, 1) && !canSwapSide(id, 1)) disabled.push('right');
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
      case 'left': movePerson(id, -1); break;
      case 'right': movePerson(id, 1); break;
      case 'focus': setFocus(id); break;
      case 'detail': View.select(null); App.open(id); break;
      case 'delete':
        UI.confirm('Smazat osobu ' + S.label(tree, id) + '?',
          'Osoba se odstraní ze stromu i ze světa. Vrátit lze pomocí Ctrl+Z.',
          function () { S.deletePerson(tree, id); UI.toast('Osoba smazána'); }, 'Smazat');
        break;
    }
  }

  /* Dvojice partnerů stojící vedle sebe — u ní má posun doleva/doprava
     význam „přehoď mě na druhou stranu partnera". */
  function partnerPair(id) {
    var tree = S.activeTree();
    var L = View.layout;
    var me = L && L.index[id];
    if (!me) return null;
    var found = null;
    S.unionsOf(tree, id).forEach(function (u) {
      u.partners.forEach(function (pid) {
        if (found || pid === id) return;
        var other = L.index[pid];
        if (!other || other.gen !== me.gen) return;
        var lo = Math.min(me.x, other.x), hi = Math.max(me.x, other.x);
        var mezi = L.persons.some(function (n) {
          return n.gen === me.gen && n.id !== id && n.id !== pid && n.x > lo && n.x < hi;
        });
        if (mezi) return;                       // nesousedí, přehazovat nedává smysl
        found = { unionId: u.id, other: pid, left: me.x < other.x };
      });
    });
    return found;
  }

  function canSwapSide(id, dir) {
    var p = partnerPair(id);
    return !!p && (dir < 0 ? !p.left : p.left);
  }

  /* Přetažení karty = volná vodorovná poloha. Rozvržení počítá aplikace,
     ale poslední slovo má autor — kam kartu položí, tam zůstane. Řada
     bývá zaplněná, takže se karta klidně smí překrýt s jinou; jen to
     nesmí proběhnout potichu, aby se nikdo neschoval pod sousedem. */
  function dragPerson(id, dx) {
    var tree = S.activeTree();
    if (!S.nudge(tree, id, dx)) return;
    // nabídku po přetažení neotvíráme, jinak by zakryla, co se právě stalo
    var pres = View.kolize(id, 0);
    UI.toast(pres.length
      ? S.label(tree, id) + ' překrývá: ' + pres.join(', ') + ' — Ctrl+Z vrátí zpět'
      : S.label(tree, id) + ' přesunuta — Ctrl+Z vrátí zpět',
      pres.length ? 'warn' : '');
  }

  /* posun karty v řadě — po překreslení vrátíme nabídku na nové místo */
  function movePerson(id, dir) {
    var tree = S.activeTree();
    // šipky mění pořadí ve stromu, takže ruční posun té karty pozbývá smyslu
    S.resetNudge(tree, id, true);
    if (S.movePerson(tree, id, dir)) { View.select(id); return; }
    var p = partnerPair(id);
    if (p && (dir < 0 ? !p.left : p.left)) {
      S.setUnionSide(tree, p.unionId, dir < 0 ? id : p.other);
      View.select(id);
      return;
    }
    UI.toast('Dál už to nejde');
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
