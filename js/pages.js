/* Kroniky rodů — stránky světa
 * Seznamy, detail entity s vazbami a zpětnými odkazy, časová osa a kalendář.
 * Všechno se skládá podle popisu typů ve world.js, takže přidání dalšího
 * druhu záznamu je otázkou jednoho záznamu ve World.TYPES.
 */
(function (global) {
  'use strict';

  var h, UI, S, W;

  function init() {
    UI = global.FG.UI; S = global.FG.Store; W = global.FG.World; h = UI.h;
  }

  function world() { return S.activeWorld(); }

  /* ---------- drobné stavební prvky ---------- */

  function pageHead(title, sub, actions) {
    return h('header', { class: 'page-head' }, [
      h('div', {}, [
        h('h1', { class: 'page-title', text: title }),
        sub ? h('p', { class: 'page-sub', text: sub }) : null
      ]),
      actions ? h('div', { class: 'page-actions' }, actions) : null
    ]);
  }

  function typeChip(type) {
    var spec = W.TYPES[type];
    return h('span', { class: 'type-chip t-' + type, text: spec ? spec.label : type });
  }

  function entRow(e, meta) {
    var row = h('button', {
      class: 'ent-row', type: 'button',
      onclick: function () { global.FG.App.open(e.id); }
    }, [
      h('span', { class: 'ent-main' }, [
        h('span', { class: 'ent-name', text: (e.name || '').trim() || 'Bez názvu' }),
        e.alias ? h('span', { class: 'ent-alias', text: e.alias }) : null
      ]),
      h('span', { class: 'ent-meta', text: meta || defaultMeta(e) })
    ]);
    return row;
  }

  function defaultMeta(e) {
    var w = world();
    if (e.type === 'postava') {
      var life = S.lifespan(e);
      var place = e.misto ? W.label(w, e.misto) : '';
      return [life, place].filter(Boolean).join('  ·  ');
    }
    if (e.type === 'misto') {
      return [e.druh, e.obyvatel].filter(Boolean).join('  ·  ');
    }
    if (e.type === 'udalost') {
      return [e.datum, e.epocha].filter(Boolean).join('  ·  ');
    }
    if (e.type === 'narod') return e.alias ? '' : '';
    return '';
  }

  function emptyNote(text) {
    return h('p', { class: 'empty-note', text: text });
  }

  /* text s [[odkazy]] převedený na klikatelné odkazy */
  function richText(text) {
    var box = h('div', { class: 'rich' });
    (text || '').split(/\n{2,}/).forEach(function (para) {
      var p = h('p', {});
      var rest = para, re = /\[\[([^\]]+)\]\]/g, last = 0, m;
      while ((m = re.exec(para))) {
        if (m.index > last) p.appendChild(document.createTextNode(para.slice(last, m.index)));
        var name = m[1].trim();
        var target = W.findByName(world(), name);
        p.appendChild(h('button', {
          class: 'wiki' + (target ? '' : ' missing'), type: 'button', text: name,
          title: target ? 'Otevřít' : 'Takový záznam zatím neexistuje',
          onclick: (function (nm, t) {
            return function () {
              if (t) global.FG.App.open(t.id);
              else global.FG.Pages.createNamed(nm);
            };
          })(name, target)
        }));
        last = m.index + m[0].length;
      }
      if (last < para.length) p.appendChild(document.createTextNode(para.slice(last)));
      box.appendChild(p);
    });
    return box;
  }

  /* ---------- přehled ---------- */

  function overview() {
    var w = world();
    var page = h('div', { class: 'page-inner' });
    page.appendChild(pageHead(w.name, 'Přehled světa', [
      h('button', {
        class: 'btn ghost', type: 'button', text: 'Přejmenovat svět',
        onclick: function () { Pages.renameWorld(); }
      })
    ]));

    var grid = h('div', { class: 'tiles' });
    W.TYPE_ORDER.forEach(function (type) {
      var spec = W.TYPES[type];
      var n = W.count(w, type);
      grid.appendChild(h('button', {
        class: 'tile', type: 'button',
        onclick: function () { global.FG.App.go(type); }
      }, [
        h('span', { class: 'tile-ico', html: UI.icon(spec.icon, 26) }),
        h('strong', { class: 'tile-n', text: String(n) }),
        h('span', { class: 'tile-l', text: spec.plural })
      ]));
    });
    var trees = S.trees().length;
    grid.appendChild(h('button', {
      class: 'tile', type: 'button',
      onclick: function () { global.FG.App.go('rodokmeny'); }
    }, [
      h('span', { class: 'tile-ico', html: UI.icon('trees', 26) }),
      h('strong', { class: 'tile-n', text: String(trees) }),
      h('span', { class: 'tile-l', text: trees === 1 ? 'Rodokmen' : 'Rodokmeny' })
    ]));
    page.appendChild(grid);

    var cal = W.calendarSummary(w);
    if (cal) {
      page.appendChild(h('button', {
        class: 'wide-row', type: 'button',
        onclick: function () { global.FG.App.go('kalendar'); }
      }, [
        h('span', { class: 'ent-name', text: w.calendar.name || 'Kalendář světa' }),
        h('span', { class: 'ent-meta', text: cal })
      ]));
    }

    var recent = W.all(w).filter(function (e) { return e.name; }).slice(0, 8);
    if (recent.length) {
      page.appendChild(h('h2', { class: 'sec-title', text: 'Záznamy ve světě' }));
      var list = h('div', { class: 'card-list' });
      recent.forEach(function (e) {
        list.appendChild(entRow(e, W.TYPES[e.type] ? W.TYPES[e.type].label : ''));
      });
      page.appendChild(list);
    } else {
      page.appendChild(emptyNote(
        'Svět je zatím prázdný. Začněte třeba postavou nebo místem — ' +
        'všechno se pak dá provázat mezi sebou.'));
    }
    return page;
  }

  /* ---------- seznam jednoho typu ---------- */

  function listPage(type) {
    var w = world();
    var spec = W.TYPES[type];
    var page = h('div', { class: 'page-inner' });
    var query = Pages.filters[type] || '';

    page.appendChild(pageHead(spec.plural, W.count(w, type) + ' ' + pocet(W.count(w, type)), [
      h('button', {
        class: 'btn primary', type: 'button', text: '+ ' + spec.article,
        onclick: function () { Pages.editEntity(null, type); }
      })
    ]));

    var search = h('input', {
      type: 'search', placeholder: 'Hledat mezi ' + spec.plural.toLowerCase() + '…',
      value: query
    });
    search.addEventListener('input', function () {
      Pages.filters[type] = search.value;
      var box = page.querySelector('.list-body');
      box.textContent = '';
      box.appendChild(listBody(type, search.value));
    });
    page.appendChild(h('div', { class: 'toolbar' }, [search]));
    page.appendChild(h('div', { class: 'list-body' }, [listBody(type, query)]));
    return page;
  }

  function pocet(n) {
    if (n === 1) return 'záznam';
    if (n >= 2 && n <= 4) return 'záznamy';
    return 'záznamů';
  }

  function listBody(type, query) {
    var w = world();
    var spec = W.TYPES[type];
    var box = h('div', {});
    var items = query ? W.search(w, query, type) : W.all(w, type);

    if (!items.length) {
      box.appendChild(emptyNote(query ? 'Nic nenalezeno.' : 'Zatím tu nic není.'));
      return box;
    }

    // místa a národy umí strom podle nadřazenosti
    if (spec.tree && !query) {
      box.appendChild(hierarchy(type));
      return box;
    }

    if (spec.groupBy && !query) {
      var groups = {};
      items.forEach(function (e) {
        var key = e[spec.groupBy] || '';
        var label = key && W.get(w, key) ? W.label(w, key) : (key || 'Bez zařazení');
        (groups[label] = groups[label] || []).push(e);
      });
      Object.keys(groups).sort(function (a, b) {
        if (a === 'Bez zařazení') return 1;
        if (b === 'Bez zařazení') return -1;
        return a.localeCompare(b, 'cs');
      }).forEach(function (label) {
        box.appendChild(h('h2', { class: 'group-title', text: label }));
        var list = h('div', { class: 'card-list' });
        groups[label].forEach(function (e) { list.appendChild(entRow(e)); });
        box.appendChild(list);
      });
      return box;
    }

    var list = h('div', { class: 'card-list' });
    items.forEach(function (e) { list.appendChild(entRow(e)); });
    box.appendChild(list);
    return box;
  }

  function hierarchy(type) {
    var w = world();
    var box = h('div', { class: 'hier' });
    function level(parentId, depth) {
      var kids = parentId === null ? W.roots(w, type) : W.childrenOf(w, type, parentId);
      if (!kids.length) return null;
      var ul = h('div', { class: 'hier-level', style: depth ? 'margin-left:18px' : '' });
      kids.forEach(function (e) {
        var sub = level(e.id, depth + 1);
        ul.appendChild(h('div', { class: 'hier-item' }, [
          entRow(e),
          sub
        ]));
      });
      return ul;
    }
    box.appendChild(level(null, 0));
    return box;
  }

  /* ---------- časová osa ---------- */

  function timelinePage() {
    var w = world();
    var page = h('div', { class: 'page-inner' });
    var events = W.timeline(w);
    page.appendChild(pageHead('Události', events.length + ' ' + pocet(events.length), [
      h('button', {
        class: 'btn primary', type: 'button', text: '+ Nová událost',
        onclick: function () { Pages.editEntity(null, 'udalost'); }
      })
    ]));

    if (!events.length) {
      page.appendChild(emptyNote(
        'Zapište první událost — u každé si můžete říct, kdy se stala, ' +
        'kde a koho se týkala.'));
      return page;
    }

    var groups = [];
    var current = null;
    events.forEach(function (e) {
      var key = (e.epocha || '').trim() || 'Bez zařazení';
      if (!current || current.key !== key) {
        current = { key: key, items: [] };
        groups.push(current);
      }
      current.items.push(e);
    });

    groups.forEach(function (g) {
      page.appendChild(h('h2', { class: 'group-title', text: g.key }));
      var tl = h('div', { class: 'tl' });
      g.items.forEach(function (e) {
        tl.appendChild(h('button', {
          class: 'tl-item', type: 'button',
          onclick: function () { global.FG.App.open(e.id); }
        }, [
          h('span', { class: 'tl-dot' }),
          h('span', { class: 'tl-year', text: e.datum || '—' }),
          h('span', { class: 'tl-name', text: (e.name || '').trim() || 'Bez názvu' }),
          h('span', { class: 'tl-where', text: (e.mista || []).map(function (id) {
            return W.label(w, id);
          }).filter(Boolean).join(', ') })
        ]));
      });
      page.appendChild(tl);
    });
    return page;
  }

  /* ---------- kalendář ---------- */

  function calendarPage() {
    var w = world();
    var c = w.calendar;
    var page = h('div', { class: 'page-inner' });
    page.appendChild(pageHead(c.name || 'Kalendář světa', W.calendarSummary(w), [
      h('button', {
        class: 'btn ghost', type: 'button', text: 'Upravit kalendář',
        onclick: function () { Pages.editCalendar(); }
      })
    ]));

    if (!c.months.length && !c.holidays.length) {
      page.appendChild(emptyNote(
        'Zatím tu není žádný kalendář. Zadejte měsíce a svátky svého světa — ' +
        'budete se na ně moci odvolávat u událostí.'));
      return page;
    }

    if (c.months.length) {
      page.appendChild(h('h2', { class: 'sec-title', text: 'Měsíce' }));
      var grid = h('div', { class: 'months' });
      c.months.forEach(function (m, i) {
        grid.appendChild(h('div', { class: 'month' }, [
          h('span', { class: 'month-n', text: (i + 1) + '.' }),
          h('strong', { class: 'month-name', text: m.name || '—' }),
          m.translation ? h('em', { class: 'month-tr', text: m.translation }) : null,
          m.season ? h('span', { class: 'month-season', text: m.season }) : null
        ]));
      });
      page.appendChild(grid);
    }

    if (c.holidays.length) {
      page.appendChild(h('h2', { class: 'sec-title', text: 'Svátky' }));
      var list = h('div', { class: 'card-list' });
      c.holidays.forEach(function (s) {
        list.appendChild(h('div', { class: 'ent-row static' }, [
          h('span', { class: 'ent-main' }, [
            h('span', { class: 'ent-name', text: s.name || '—' }),
            s.translation ? h('span', { class: 'ent-alias', text: s.translation }) : null,
            s.description ? h('span', { class: 'holiday-desc', text: s.description }) : null
          ]),
          h('span', { class: 'ent-meta', text: s.when || '' })
        ]));
      });
      page.appendChild(list);
    }

    if (c.note) {
      page.appendChild(h('h2', { class: 'sec-title', text: 'Zvláštnosti' }));
      page.appendChild(richText(c.note));
    }
    return page;
  }

  /* ---------- detail entity ---------- */

  function detailPage(id) {
    var w = world();
    var e = W.get(w, id);
    var page = h('div', { class: 'page-inner' });
    if (!e) {
      page.appendChild(emptyNote('Záznam už neexistuje.'));
      return page;
    }
    var spec = W.TYPES[e.type];

    page.appendChild(h('button', {
      class: 'back-link', type: 'button', text: '‹ Zpět',
      onclick: function () { global.FG.App.back(); }
    }));

    page.appendChild(h('header', { class: 'detail-head' }, [
      h('div', {}, [
        typeChip(e.type),
        h('h1', { class: 'page-title', text: (e.name || '').trim() || 'Bez názvu' }),
        e.alias ? h('p', { class: 'detail-alias', text: e.alias }) : null
      ]),
      h('div', { class: 'page-actions' }, [
        e.type === 'postava'
          ? (S.treeOf(w, e.id)
              ? h('button', {
                  class: 'btn ghost', type: 'button', text: 'V rodokmenu',
                  onclick: function () { global.FG.App.showInTree(e.id); }
                })
              : h('button', {
                  class: 'btn ghost', type: 'button', text: 'Do rodokmenu',
                  onclick: function () { Pages.addToTree(e.id); }
                }))
          : null,
        h('button', {
          class: 'btn ghost', type: 'button', text: 'Upravit',
          onclick: function () { Pages.editEntity(e.id); }
        })
      ])
    ]));

    // pole
    var dl = h('div', { class: 'fields' });
    spec.fields.forEach(function (f) {
      if (f.k === 'note' || f.t === 'long') return;
      if (f.k === 'alias' && e.alias) return;      // přídomek už stojí pod nadpisem
      var val = e[f.k];
      if (f.t === 'ref') {
        if (!val || !W.get(w, val)) return;
        dl.appendChild(fieldRow(f.l, refChip(val)));
      } else if (f.t === 'refs') {
        if (!val || !val.length) return;
        var chips = h('span', { class: 'chip-row' });
        val.forEach(function (rid) { if (W.get(w, rid)) chips.appendChild(refChip(rid)); });
        if (chips.children.length) dl.appendChild(fieldRow(f.l, chips));
      } else if (f.t === 'gender') {
        if (!val || val === 'x') return;
        dl.appendChild(fieldRow(f.l, h('span', { text: val === 'm' ? 'muž' : 'žena' })));
      } else if (val) {
        dl.appendChild(fieldRow(f.l, h('span', { text: val })));
      }
    });
    if (dl.children.length) page.appendChild(dl);

    // dlouhé texty
    spec.fields.forEach(function (f) {
      if (f.t !== 'long' || !e[f.k]) return;
      page.appendChild(h('h2', { class: 'sec-title', text: f.l }));
      page.appendChild(richText(e[f.k]));
    });

    // rodinné vazby
    if (e.type === 'postava') {
      var tree = S.treeOf(w, e.id);
      if (tree) {
        var rels = [];
        S.parentsOf(tree, e.id).forEach(function (p) { rels.push(['Rodič', p]); });
        S.partnersOf(tree, e.id).forEach(function (p) { rels.push(['Partner', p]); });
        S.childrenOf(tree, e.id).forEach(function (p) { rels.push(['Dítě', p]); });
        S.siblingsOf(tree, e.id).forEach(function (p) { rels.push(['Sourozenec', p]); });
        if (rels.length) {
          page.appendChild(h('h2', { class: 'sec-title', text: 'Rodina' }));
          var fam = h('div', { class: 'chip-row' });
          rels.forEach(function (r) {
            fam.appendChild(refChip(r[1], r[0]));
          });
          page.appendChild(fam);
        }
      }
    }

    // co je uvnitř (místa, národy)
    if (spec.tree) {
      var kids = W.childrenOf(w, e.type, e.id);
      if (kids.length) {
        page.appendChild(h('h2', { class: 'sec-title', text: 'Uvnitř' }));
        var list = h('div', { class: 'card-list' });
        kids.forEach(function (k) { list.appendChild(entRow(k)); });
        page.appendChild(list);
      }
    }

    // zpětné odkazy
    var back = W.backlinks(w, e.id);
    if (back.length) {
      page.appendChild(h('h2', { class: 'sec-title', text: 'Zmíněno v' }));
      var bl = h('div', { class: 'card-list' });
      back.forEach(function (b) {
        bl.appendChild(entRow(b.entity, b.why));
      });
      page.appendChild(bl);
    }

    page.appendChild(h('div', { class: 'detail-foot' }, [
      h('button', {
        class: 'mini danger', type: 'button', text: 'Smazat záznam',
        onclick: function () {
          UI.confirm('Smazat ' + (e.name || 'záznam') + '?',
            'Záznam zmizí ze světa i ze všech vazeb. Vrátit lze pomocí Ctrl+Z.',
            function () {
              S.snapshot();
              W.remove(world(), e.id);
              S.emit('entity-delete');
              global.FG.App.back();
              UI.toast('Smazáno');
            }, 'Smazat');
        }
      })
    ]));
    return page;
  }

  function fieldRow(label, value) {
    return h('div', { class: 'field-row' }, [
      h('span', { class: 'field-key', text: label }),
      h('span', { class: 'field-val' }, [value])
    ]);
  }

  function refChip(id, prefix) {
    var w = world();
    var e = W.get(w, id);
    if (!e) return h('span', { text: '—' });
    return h('button', {
      class: 'ref-chip t-' + e.type, type: 'button',
      onclick: function () { global.FG.App.open(id); }
    }, [
      prefix ? h('span', { class: 'ref-pre', text: prefix }) : null,
      h('span', { text: (e.name || '').trim() || 'Bez názvu' })
    ]);
  }

  var Pages = {
    filters: {},

    init: init,

    render: function (host, section, detailId) {
      init();
      host.textContent = '';
      var node;
      if (detailId) node = detailPage(detailId);
      else if (section === 'prehled') node = overview();
      else if (section === 'udalost') node = timelinePage();
      else if (section === 'kalendar') node = calendarPage();
      else if (W.TYPES[section]) node = listPage(section);
      else node = overview();
      host.appendChild(node);
      host.scrollTop = 0;
    },

    /* ---------- úpravy ---------- */

    editEntity: function (id, type, opts) {
      opts = opts || {};
      var w = world();
      var e = id ? W.get(w, id) : null;
      type = e ? e.type : type;
      var spec = W.TYPES[type];
      var name = h('input', { type: 'text', value: e ? e.name : '', placeholder: 'Název' });
      var content = h('div', {}, [UI.field('Název', name)]);
      var inputs = {};

      spec.fields.forEach(function (f) {
        var cur = e ? e[f.k] : (f.t === 'refs' ? [] : '');
        var el;
        if (f.t === 'long') {
          el = h('textarea', { rows: f.k === 'note' ? '5' : '3',
            placeholder: 'Odkaz na jiný záznam zapíšete jako [[Jméno]]' });
          el.value = cur || '';
        } else if (f.t === 'select') {
          el = h('select', {});
          el.appendChild(h('option', { value: '', text: '—' }));
          f.options.forEach(function (o) {
            var opt = h('option', { value: o, text: o });
            if (o === cur) opt.selected = true;
            el.appendChild(opt);
          });
        } else if (f.t === 'gender') {
          el = h('select', {});
          [['x', 'neurčeno'], ['m', 'muž'], ['f', 'žena']].forEach(function (o) {
            var opt = h('option', { value: o[0], text: o[1] });
            if (o[0] === (cur || 'x')) opt.selected = true;
            el.appendChild(opt);
          });
        } else if (f.t === 'ref' || f.t === 'refs') {
          el = Pages.refField(f, cur, e ? e.id : null);
        } else {
          el = h('input', { type: 'text', value: cur || '' });
        }
        inputs[f.k] = el;
        content.appendChild(UI.field(f.l, el.field || el));
      });

      if (opts.extra) content.appendChild(opts.extra);

      UI.modal({
        title: opts.title || (e ? 'Upravit záznam' : spec.article),
        wide: true,
        content: content,
        buttons: [
          { label: 'Zrušit' },
          {
            label: 'Uložit', kind: 'primary',
            action: function () {
              var nm = name.value.trim();
              if (!nm) { UI.toast('Vyplňte název.', 'warn'); return false; }
              var target = e || W.create(world(), type, {});
              S.batch(function () {
                target.name = nm;
                spec.fields.forEach(function (f) {
                  var el = inputs[f.k];
                  target[f.k] = el.read ? el.read() : el.value;
                });
                if (opts.onSave) opts.onSave(target);
              });
              if (!e) global.FG.App.open(target.id);
              UI.toast('Uloženo');
            }
          }
        ]
      });
    },

    /* políčko pro odkaz na jiný záznam */
    refField: function (f, value, selfId) {
      var w = world();
      var multi = f.t === 'refs';
      var chosen = multi ? (value || []).slice() : (value ? [value] : []);
      var box = h('div', { class: 'ref-field' });
      var chips = h('div', { class: 'chip-row' });
      var search = h('input', {
        type: 'search',
        placeholder: 'Hledat ' + (W.TYPES[f.to] ? W.TYPES[f.to].plural.toLowerCase() : '') + '…'
      });
      var results = h('div', { class: 'ref-results' });

      function drawChips() {
        chips.textContent = '';
        chosen.forEach(function (id) {
          var e = W.get(w, id);
          if (!e) return;
          chips.appendChild(h('button', {
            class: 'ref-chip removable t-' + e.type, type: 'button',
            title: 'Odebrat',
            onclick: function () {
              chosen = chosen.filter(function (x) { return x !== id; });
              drawChips();
            }
          }, [h('span', { text: e.name || 'Bez názvu' }), h('span', { class: 'x', text: '×' })]));
        });
        if (!chosen.length) {
          chips.appendChild(h('span', { class: 'ent-meta', text: 'nevyplněno' }));
        }
      }

      function drawResults() {
        results.textContent = '';
        var q = search.value.trim();
        if (!q) return;
        var found = W.search(w, q, f.to).filter(function (e) {
          return e.id !== selfId && chosen.indexOf(e.id) === -1;
        }).slice(0, 8);
        found.forEach(function (e) {
          results.appendChild(h('button', {
            class: 'pick', type: 'button',
            onclick: function () {
              if (multi) chosen.push(e.id); else chosen = [e.id];
              search.value = '';
              drawChips(); drawResults();
            }
          }, [
            h('span', { class: 'pick-name', text: e.name }),
            h('span', { class: 'pick-meta', text: defaultMeta(e) })
          ]));
        });
        if (!found.length) {
          results.appendChild(h('button', {
            class: 'pick', type: 'button',
            onclick: function () {
              var e = W.create(w, f.to, { name: q });
              if (multi) chosen.push(e.id); else chosen = [e.id];
              search.value = '';
              drawChips(); drawResults();
              UI.toast('Založeno: ' + q);
            }
          }, [h('span', { class: 'pick-name', text: '+ Založit „' + q + '"' })]));
        }
      }

      search.addEventListener('input', drawResults);
      drawChips();
      box.appendChild(chips);
      box.appendChild(search);
      box.appendChild(results);
      box.read = function () { return multi ? chosen : (chosen[0] || ''); };
      box.field = box;
      return box;
    },

    /* zařazení postavy do některého z rodokmenů */
    addToTree: function (personId) {
      var w = world();
      var m;
      var list = h('div', { class: 'card-list' });
      S.trees().forEach(function (t) {
        list.appendChild(h('button', {
          class: 'ent-row', type: 'button',
          onclick: function () { m.close(); put(t); }
        }, [
          h('span', { class: 'ent-main' }, [
            h('span', { class: 'ent-name', text: t.name })
          ]),
          h('span', {
            class: 'ent-meta',
            text: Object.keys(t.people).length + ' osob'
          })
        ]));
      });

      function put(tree) {
        S.batch(function () {
          tree.people[personId] = W.get(w, personId);
          if (!tree.focusId || !tree.people[tree.focusId]) tree.focusId = personId;
          w.activeTreeId = tree.id;
        });
        UI.toast('Přidáno do rodokmenu ' + tree.name);
        global.FG.App.showInTree(personId);
      }

      m = UI.modal({
        title: 'Do kterého rodokmenu?',
        content: h('div', {}, [
          h('p', {
            class: 'dialog-text',
            text: 'Postava se do stromu vloží jako samostatná karta. ' +
              'Vazby k rodičům, partnerům a dětem pak přidáte přímo ve stromu.'
          }),
          list,
          h('div', { class: 'manager-tools' }, [
            h('button', {
              class: 'btn ghost', type: 'button', text: '+ Nový rodokmen',
              onclick: function () {
                var input = h('input', { type: 'text', placeholder: 'Název rodu' });
                m.close();
                UI.modal({
                  title: 'Nový rodokmen',
                  content: UI.field('Název', input),
                  buttons: [
                    { label: 'Zrušit' },
                    {
                      label: 'Založit', kind: 'primary',
                      action: function () {
                        var t = S.createTree(input.value.trim() || 'Nový rod');
                        // nový strom zakládá prázdnou postavu, tu nepotřebujeme
                        Object.keys(t.people).forEach(function (pid) {
                          var p = t.people[pid];
                          if (!p.name && !p.birth && !p.death) {
                            delete t.people[pid];
                            W.remove(world(), pid);
                          }
                        });
                        put(t);
                      }
                    }
                  ]
                });
              }
            })
          ])
        ]),
        buttons: [{ label: 'Zrušit' }]
      });
    },

    createNamed: function (name) {
      var content = h('div', {}, [
        h('p', { class: 'dialog-text', text: 'Záznam „' + name + '" zatím neexistuje. Jako co ho založit?' })
      ]);
      var m;
      var list = h('div', { class: 'card-list' });
      W.TYPE_ORDER.forEach(function (type) {
        list.appendChild(h('button', {
          class: 'ent-row', type: 'button',
          onclick: function () {
            S.snapshot();
            var e = W.create(world(), type, { name: name });
            S.emit('entity-create');
            m.close();
            global.FG.App.open(e.id);
          }
        }, [
          h('span', { class: 'ent-main' }, [
            h('span', { class: 'ent-name', text: W.TYPES[type].label })
          ])
        ]));
      });
      content.appendChild(list);
      m = UI.modal({ title: 'Nový záznam', content: content, buttons: [{ label: 'Zrušit' }] });
    },

    renameWorld: function () {
      var w = world();
      var input = h('input', { type: 'text', value: w.name, maxlength: '60' });
      UI.modal({
        title: 'Název světa',
        content: UI.field('Jak se svět jmenuje', input),
        buttons: [
          { label: 'Zrušit' },
          {
            label: 'Uložit', kind: 'primary',
            action: function () {
              S.renameWorld(w.id, input.value.trim() || 'Svět bez jména');
            }
          }
        ]
      });
    },

    editCalendar: function () {
      var w = world();
      var c = w.calendar;
      var name = h('input', { type: 'text', value: c.name || '', placeholder: 'Např. Ciadský kalendář' });
      var dim = h('input', { type: 'text', value: c.daysInMonth || '', placeholder: '40' });
      var diy = h('input', { type: 'text', value: c.daysInYear || '', placeholder: '400' });
      var months = h('textarea', { rows: '8',
        placeholder: 'Jeden měsíc na řádek: název | překlad | období' });
      months.value = (c.months || []).map(function (m) {
        return [m.name, m.translation, m.season].filter(Boolean).join(' | ');
      }).join('\n');
      var holidays = h('textarea', { rows: '6',
        placeholder: 'Jeden svátek na řádek: název | překlad | kdy | popis' });
      holidays.value = (c.holidays || []).map(function (s) {
        return [s.name, s.translation, s.when, s.description].filter(Boolean).join(' | ');
      }).join('\n');
      var note = h('textarea', { rows: '3', placeholder: 'Zatmění, úkazy, zvláštnosti…' });
      note.value = c.note || '';

      UI.modal({
        title: 'Kalendář světa', wide: true,
        content: h('div', {}, [
          UI.field('Název kalendáře', name),
          h('div', { class: 'row2' }, [
            UI.field('Dní v měsíci', dim),
            UI.field('Dní v roce', diy)
          ]),
          UI.field('Měsíce', months),
          UI.field('Svátky', holidays),
          UI.field('Zvláštnosti', note)
        ]),
        buttons: [
          { label: 'Zrušit' },
          {
            label: 'Uložit', kind: 'primary',
            action: function () {
              S.snapshot();
              c.name = name.value.trim();
              c.daysInMonth = dim.value.trim();
              c.daysInYear = diy.value.trim();
              c.months = months.value.split('\n').map(function (line) {
                var parts = line.split('|').map(function (x) { return x.trim(); });
                return parts[0] ? { name: parts[0], translation: parts[1] || '', season: parts[2] || '' } : null;
              }).filter(Boolean);
              c.holidays = holidays.value.split('\n').map(function (line) {
                var parts = line.split('|').map(function (x) { return x.trim(); });
                return parts[0] ? {
                  name: parts[0], translation: parts[1] || '',
                  when: parts[2] || '', description: parts[3] || ''
                } : null;
              }).filter(Boolean);
              c.note = note.value.trim();
              S.emit('calendar-save');
              UI.toast('Kalendář uložen');
            }
          }
        ]
      });
    }
  };

  global.FG = global.FG || {};
  global.FG.Pages = Pages;
})(window);
