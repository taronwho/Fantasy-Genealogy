/* Kroniky rodů — dialogy, formuláře a kruhové menu */
(function (global) {
  'use strict';

  function h(tag, attrs, kids) {
    var e = document.createElement(tag);
    if (attrs) {
      for (var k in attrs) {
        if (k === 'class') e.className = attrs[k];
        else if (k === 'html') e.innerHTML = attrs[k];
        else if (k === 'text') e.textContent = attrs[k];
        else if (k.indexOf('on') === 0) e.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) e.setAttribute(k, attrs[k]);
      }
    }
    (kids || []).forEach(function (c) {
      if (c === null || c === undefined) return;
      e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return e;
  }

  var ICONS = {
    edit: '<path d="M4 20h4L20 8l-4-4L4 16v4z"/><path d="M14 6l4 4"/>',
    parents: '<circle cx="6" cy="7" r="2.6"/><circle cx="18" cy="7" r="2.6"/><path d="M6 10v3h12v-3M12 13v7"/>',
    partner: '<circle cx="6" cy="12" r="2.6"/><circle cx="18" cy="12" r="2.6"/><path d="M9 12h6"/><path d="M13 9.5l2 2.5-2 2.5"/>',
    child: '<circle cx="12" cy="17" r="2.6"/><path d="M12 4v9"/><path d="M9 10l3 3 3-3"/>',
    link: '<path d="M9.5 14.5l5-5"/><path d="M12 7l2-2a3.5 3.5 0 015 5l-2 2"/><path d="M12 17l-2 2a3.5 3.5 0 01-5-5l2-2"/>',
    unlink: '<path d="M12 7l2-2a3.5 3.5 0 015 5l-2 2"/><path d="M12 17l-2 2a3.5 3.5 0 01-5-5l2-2"/><path d="M4 4l16 16"/>',
    trash: '<path d="M5 7h14"/><path d="M9 7V5h6v2"/><path d="M7 7l1 13h8l1-13"/>',
    cloud: '<path d="M7.5 19h9.2a3.8 3.8 0 100-7.6 5.4 5.4 0 00-10.4 1.2A3.2 3.2 0 007.5 19z"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    left: '<path d="M13.5 6.5L8 12l5.5 5.5"/><path d="M19 12H8.4"/>',
    right: '<path d="M10.5 6.5L16 12l-5.5 5.5"/><path d="M5 12h10.6"/>',
    focus: '<circle cx="12" cy="12" r="3.2"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/><circle cx="12" cy="12" r="8"/>',
    search: '<circle cx="11" cy="11" r="6.4"/><path d="M16 16l4.5 4.5"/>',
    gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.8l1.4 2.6 2.9-.5.6 2.9 2.6 1.4-1.5 2.5 1.5 2.5-2.6 1.4-.6 2.9-2.9-.5L12 21.2l-1.4-2.6-2.9.5-.6-2.9-2.6-1.4L6 12.3 4.5 9.8l2.6-1.4.6-2.9 2.9.5z"/>',
    image: '<rect x="3.5" y="5" width="17" height="14" rx="2.5"/><circle cx="9" cy="10" r="1.8"/><path d="M4.5 17l4.5-4.5 3.5 3.5 3-2.5 4 4"/>',
    trees: '<path d="M4 6h16M4 12h16M4 18h10"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    fit: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    undo: '<path d="M9 7L4 12l5 5"/><path d="M4 12h9a6 6 0 010 12h-3"/>',
    more: '<circle cx="6" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="18" cy="12" r="1.6"/>',
    person: '<circle cx="12" cy="8" r="3.6"/><path d="M5 20c0-3.9 3.1-6.4 7-6.4s7 2.5 7 6.4"/>',
    world: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17"/><path d="M12 3.5c2.4 2.3 3.6 5.2 3.6 8.5s-1.2 6.2-3.6 8.5c-2.4-2.3-3.6-5.2-3.6-8.5S9.6 5.8 12 3.5z"/>',
    home: '<path d="M4 11l8-6.5 8 6.5"/><path d="M6.5 10v9h11v-9"/>',
    place: '<path d="M12 21s6.5-6 6.5-10.5A6.5 6.5 0 005.5 10.5C5.5 15 12 21 12 21z"/><circle cx="12" cy="10.5" r="2.4"/>',
    flag: '<path d="M6 21V4"/><path d="M6 4.5h11l-2 3.5 2 3.5H6"/>',
    event: '<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3.5v3M16 3.5v3"/>',
    moon: '<path d="M20.5 14.8A8.6 8.6 0 019.2 3.5a8.6 8.6 0 1011.3 11.3z"/>',
    book: '<path d="M5 4.5h6.5a2.5 2.5 0 012.5 2.5v13a2 2 0 00-2-2H5z"/><path d="M19 4.5h-4.5a2.5 2.5 0 00-2.5 2.5v13a2 2 0 012-2H19z"/>'
  };

  function icon(name, size) {
    var s = size || 22;
    return '<svg viewBox="0 0 24 24" width="' + s + '" height="' + s + '" fill="none" ' +
      'stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' +
      (ICONS[name] || '') + '</svg>';
  }

  /* název souboru bez diakritiky — prohlížeče s ní zacházejí různě */
  var DIA = {
    'á':'a','č':'c','ď':'d','é':'e','ě':'e','í':'i','ň':'n','ó':'o','ř':'r',
    'š':'s','ť':'t','ú':'u','ů':'u','ý':'y','ž':'z','ä':'a','ö':'o','ü':'u',
    'ĺ':'l','ľ':'l','ŕ':'r','ô':'o'
  };
  function asciiSlug(text, fallback) {
    var out = (text || '').toLowerCase().replace(/[^a-z0-9]/g, function (ch) {
      return DIA[ch] !== undefined ? DIA[ch] : '-';
    });
    out = out.replace(/-+/g, '-').replace(/^-|-$/g, '');
    return out || fallback || 'rodokmen';
  }

  var UI = {
    h: h, icon: icon, ICONS: ICONS, asciiSlug: asciiSlug,
    onRefresh: function () {},

    /* ---------- drobnosti ---------- */

    toast: function (msg, kind) {
      var wrap = document.getElementById('toasts');
      var t = h('div', { class: 'toast' + (kind ? ' toast-' + kind : ''), text: msg });
      wrap.appendChild(t);
      setTimeout(function () { t.classList.add('out'); }, 3200);
      setTimeout(function () { t.remove(); }, 3700);
    },

    /* ---------- vrstvy nad stránkou ---------- */
    // Dialogy a náhled obrázku se hlásí sem, aby je šlo zavřít shora dolů —
    // třeba tlačítkem Zpět na telefonu.
    layers: [],

    pushLayer: function (closeFn) {
      var self = this, entry = { close: closeFn };
      this.layers.push(entry);
      return function () {
        var i = self.layers.indexOf(entry);
        if (i !== -1) self.layers.splice(i, 1);
      };
    },

    /* zavře nejvýše položenou vrstvu; vrací, jestli bylo co zavřít */
    closeTop: function () {
      var top = this.layers.pop();
      if (!top) return false;
      top.close();
      return true;
    },

    modal: function (opts) {
      var self = this;
      var back = h('div', { class: 'modal-back' });
      var body = h('div', { class: 'modal-body' }, opts.content ? [opts.content] : []);
      var foot = h('div', { class: 'modal-foot' });
      var box = h('div', { class: 'modal' + (opts.wide ? ' modal-wide' : '') }, [
        h('div', { class: 'modal-head' }, [
          h('h2', { text: opts.title || '' }),
          h('button', {
            class: 'icon-btn ghost', html: icon('close', 20), title: 'Zavřít',
            onclick: function () { close(); }
          })
        ]),
        body, foot
      ]);
      (opts.buttons || []).forEach(function (b) {
        foot.appendChild(h('button', {
          class: 'btn ' + (b.kind || 'ghost'),
          text: b.label,
          onclick: function () {
            if (!b.action || b.action() !== false) close();
          }
        }));
      });
      back.appendChild(box);
      back.addEventListener('mousedown', function (ev) {
        if (ev.target === back) close();
      });
      document.body.appendChild(back);
      var offLayer = UI.pushLayer(function () { close(); });
      requestAnimationFrame(function () { back.classList.add('in'); });
      var first = box.querySelector('input,textarea,select,button.primary');
      if (first) setTimeout(function () { first.focus(); }, 60);

      function close() {
        if (offLayer) offLayer();
        back.classList.remove('in');
        document.removeEventListener('keydown', onKey);
        setTimeout(function () { back.remove(); }, 160);
        if (opts.onClose) opts.onClose();
      }
      function onKey(ev) {
        if (ev.key === 'Escape') { ev.stopPropagation(); close(); }
        else if (ev.key === 'Enter' && (ev.metaKey || ev.ctrlKey)) {
          var p = box.querySelector('.btn.primary');
          if (p) p.click();
        }
      }
      document.addEventListener('keydown', onKey);
      return { close: close, box: box, body: body };
    },

    confirm: function (title, text, onYes, yesLabel) {
      this.modal({
        title: title,
        content: h('p', { class: 'dialog-text', text: text }),
        buttons: [
          { label: 'Zrušit' },
          { label: yesLabel || 'Potvrdit', kind: 'primary danger', action: onYes }
        ]
      });
    },

    field: function (label, input, hint) {
      return h('label', { class: 'field' }, [
        h('span', { class: 'field-label', text: label }),
        input,
        hint ? h('span', { class: 'field-hint', text: hint }) : null
      ]);
    },

    /* ---------- formulář osoby ---------- */

    personForm: function (person, opts) {
      opts = opts || {};
      person = person || {};
      var name = h('input', { type: 'text', value: person.name || '', placeholder: opts.placeholder || 'Např. Aeldrin Světlonoš', maxlength: '80' });
      var birth = h('input', { type: 'text', value: person.birth || '', placeholder: 'např. 1042 t.v.' });
      var death = h('input', { type: 'text', value: person.death || '', placeholder: 'prázdné = žije' });
      var note = h('textarea', { rows: '3', placeholder: 'Rod, tituly, osud, poznámky…' });
      note.value = person.note || '';

      var gender = person.gender || 'x';
      var genderBtns = ['m', 'f', 'x'].map(function (g) {
        var labels = { m: 'Muž', f: 'Žena', x: 'Neurčeno' };
        return h('button', {
          type: 'button',
          class: 'seg' + (gender === g ? ' on' : '') + ' seg-' + g,
          text: labels[g],
          onclick: function (ev) {
            gender = g;
            var sibs = ev.target.parentNode.querySelectorAll('.seg');
            for (var i = 0; i < sibs.length; i++) sibs[i].classList.remove('on');
            ev.target.classList.add('on');
          }
        });
      });

      var wrap = h('div', { class: 'form' }, [
        opts.heading ? h('h3', { class: 'form-heading', text: opts.heading }) : null,
        this.field('Jméno', name),
        h('div', { class: 'field' }, [
          h('span', { class: 'field-label', text: 'Pohlaví' }),
          h('div', { class: 'segmented' }, genderBtns)
        ]),
        h('div', { class: 'row2' }, [
          this.field('Narození', birth),
          this.field('Úmrtí', death)
        ]),
        this.field('Poznámka', note)
      ]);

      wrap.read = function () {
        return {
          name: name.value.trim(), gender: gender,
          birth: birth.value.trim(), death: death.value.trim(),
          note: note.value.trim()
        };
      };
      wrap.isEmpty = function () { return !name.value.trim() && !birth.value.trim() && !death.value.trim(); };
      wrap.focusName = function () { name.focus(); };
      return wrap;
    },

    /* ---------- konkrétní dialogy ---------- */

    /* Úprava osoby z rodokmenu = úprava celého záznamu ve světě,
       navíc s obdobími jejích svazků. */
    editPerson: function (tree, id) {
      var S = global.FG.Store;
      var p = tree.people[id];
      if (!p) return;

      var rows = [];
      var extra = null;
      var unions = S.unionsOf(tree, id);
      if (unions.length) {
        extra = h('div', { class: 'union-edit' }, [
          h('h3', { class: 'form-heading', text: 'Svazky' })
        ]);
        unions.forEach(function (u) {
          var other = u.partners.filter(function (x) { return x !== id; })[0];
          var from = h('input', { type: 'text', value: u.start || '', placeholder: 'od' });
          var to = h('input', { type: 'text', value: u.end || '', placeholder: 'do' });
          rows.push({ id: u.id, from: from, to: to });
          extra.appendChild(h('div', { class: 'union-row' }, [
            h('span', {
              class: 'union-who',
              text: other ? S.label(tree, other) : 'Bez partnera'
            }),
            from, to
          ]));
        });
        extra.appendChild(h('p', {
          class: 'dialog-text small',
          text: 'Roky, kdy svazek trval. Poznámku k němu přidáte klepnutím ' +
            'na kosočtverec mezi kartami ve stromu.'
        }));
      }

      global.FG.Pages.editEntity(id, 'postava', {
        title: 'Upravit postavu',
        extra: extra,
        onSave: function () {
          rows.forEach(function (r) {
            S.updateUnion(tree, r.id, {
              start: r.from.value.trim(), end: r.to.value.trim()
            });
          });
        }
      });
    },

    /* období a poznámka jednoho svazku — otevře se klepnutím na jeho značku */
    unionDialog: function (tree, unionId) {
      var S = global.FG.Store;
      var u = tree.unions[unionId];
      if (!u) return;
      var names = u.partners.map(function (pid) { return S.label(tree, pid); });
      var from = h('input', { type: 'text', value: u.start || '', placeholder: 'např. 1042' });
      var to = h('input', { type: 'text', value: u.end || '', placeholder: 'prázdné = trvá' });
      var note = h('textarea', { rows: '3', placeholder: 'Okolnosti sňatku, rozchodu…' });
      note.value = u.note || '';
      var kids = u.children.length;
      var m;

      var content = h('div', {}, [
        h('p', { class: 'dialog-text', text: names.join('  ·  ') }),
        h('div', { class: 'row2' }, [
          UI.field('Od', from),
          UI.field('Do', to)
        ]),
        UI.field('Poznámka', note),
        h('p', {
          class: 'dialog-text small',
          text: kids
            ? (kids === 1 ? 'Ze svazku pochází 1 potomek.'
                          : 'Ze svazku pochází ' + kids + ' potomků.')
            : 'Svazek zatím nemá potomky.'
        }),
        u.partners.length >= 2
          ? h('button', {
              class: 'mini', type: 'button', text: 'Prohodit strany',
              onclick: function () {
                var L = global.FG.View.layout;
                var a = u.partners[0], b = u.partners[1];
                var na = L && L.index[a], nb = L && L.index[b];
                // vlevo bude ten, kdo teď stojí vpravo
                var novy = (na && nb && na.x < nb.x) ? b : a;
                if (S.setUnionSide(tree, u.id, novy)) {
                  m.close();
                  UI.toast(S.label(tree, novy) + ' stojí vlevo');
                }
              }
            })
          : null,
        u.partners.length >= 2
          ? UI.field('Kreslit u rodiny', h('div', { class: 'segmented' },
              u.partners.map(function (pid) {
                return h('button', {
                  type: 'button',
                  class: 'seg' + (u.anchor === pid ? ' on' : ''),
                  text: S.label(tree, pid),
                  title: 'Dvojice se bude kreslit u předků této osoby',
                  onclick: function () {
                    if (S.setUnionAnchor(tree, u.id, u.anchor === pid ? '' : pid)) {
                      m.close();
                      UI.toast(u.anchor
                        ? 'Dvojice se kreslí u rodiny ' + S.label(tree, u.anchor)
                        : 'Umístění dvojice ponecháno na aplikaci');
                    }
                  }
                });
              })))
          : null,
        u.partners.length >= 2
          ? h('button', {
              class: 'mini danger', type: 'button', text: 'Rozdělit svazek',
              onclick: function () {
                m.close();
                UI.confirm('Rozdělit svazek?',
                  'Partneři přestanou být spojeni. ' +
                  (kids ? 'Potomci zůstanou u ' + names[0] + '. ' : '') +
                  'Vrátit lze pomocí Ctrl+Z.',
                  function () {
                    S.unlink(tree, u.partners[0], {
                      kind: 'partner', unionId: u.id, targetId: u.partners[1]
                    });
                    UI.toast('Svazek rozdělen');
                  }, 'Rozdělit');
              }
            })
          : null
      ]);

      m = this.modal({
        title: 'Svazek',
        content: content,
        buttons: [
          { label: 'Zrušit' },
          {
            label: 'Uložit', kind: 'primary',
            action: function () {
              S.updateUnion(tree, unionId, {
                start: from.value.trim(), end: to.value.trim(), note: note.value.trim()
              });
              UI.toast('Svazek uložen');
            }
          }
        ]
      });
    },

    /* ---------- výběr osoby, která už ve stromu je ---------- */

    /* Výběr postavy — nabízí všechny postavy světa, nejen ty, které
       už v tomto rodokmenu jsou. Vybraná postava se do stromu doplní. */
    picker: function (tree, opts) {
      opts = opts || {};
      var S = global.FG.Store;
      var W = global.FG.World;
      var world = S.activeWorld();
      var exclude = opts.exclude || [];
      var selected = null;
      var search = h('input', { type: 'search', placeholder: 'Hledat jméno…' });
      var list = h('div', { class: 'pick-list' });

      function where(id) {
        if (tree.people[id]) return 'v tomto rodokmenu';
        var other = S.treeOf(world, id);
        if (other) return 'v rodokmenu ' + other.name;
        return 'zatím mimo rodokmeny';
      }

      function draw() {
        list.textContent = '';
        var q = search.value.trim().toLowerCase();
        var items = W.all(world, 'postava').filter(function (e) {
          return exclude.indexOf(e.id) === -1;
        });
        if (q) {
          items = items.filter(function (e) {
            return ((e.name || '') + ' ' + (e.alias || '') + ' ' + (e.note || ''))
              .toLowerCase().indexOf(q) !== -1;
          });
        }
        if (!items.length) {
          list.appendChild(h('div', {
            class: 'pick-empty',
            text: q ? 'Nic nenalezeno.' : (opts.empty || 'Ve světě zatím není jiná postava.')
          }));
        }
        items.slice(0, 150).forEach(function (e) {
          list.appendChild(h('button', {
            class: 'pick' + (e.id === selected ? ' on' : ''), type: 'button',
            onclick: function () {
              selected = e.id;
              draw();
              if (opts.onPick) opts.onPick(e.id);
            }
          }, [
            h('span', { class: 'pick-name', text: (e.name || '').trim() || 'Bez jména' }),
            h('span', {
              class: 'pick-meta',
              text: [S.lifespan(e), where(e.id)].filter(Boolean).join('  ·  ')
            })
          ]));
        });
      }
      search.addEventListener('input', draw);
      draw();

      var wrap = h('div', { class: 'picker' }, [
        UI.field(opts.label || 'Postava ve světě', search),
        list
      ]);
      wrap.selected = function () { return selected; };
      return wrap;
    },

    segmented: function (options, value, onPick) {
      var box = h('div', { class: 'segmented' });
      options.forEach(function (o) {
        box.appendChild(h('button', {
          type: 'button', class: 'seg' + (o.v === value ? ' on' : ''), text: o.l,
          onclick: function (ev) {
            var sibs = box.querySelectorAll('.seg');
            for (var i = 0; i < sibs.length; i++) sibs[i].classList.remove('on');
            ev.currentTarget.classList.add('on');
            onPick(o.v);
          }
        }));
      });
      return box;
    },

    /* přepínač mezi „založit novou postavu" a „vzít někoho ze stromu" */
    sourceSwitch: function (newBlock, pickBlock, labels) {
      var mode = 'new';
      function apply() {
        newBlock.style.display = mode === 'new' ? '' : 'none';
        pickBlock.style.display = mode === 'new' ? 'none' : '';
      }
      var box = h('div', { class: 'field' }, [
        h('span', { class: 'field-label', text: 'Koho přidat' }),
        UI.segmented([
          { v: 'new', l: (labels && labels.newLabel) || 'Novou postavu' },
          { v: 'pick', l: (labels && labels.pickLabel) || 'Ze stromu' }
        ], mode, function (v) { mode = v; apply(); })
      ]);
      apply();
      box.mode = function () { return mode; };
      return box;
    },

    /* ---------- přidávání příbuzných ---------- */

    addParents: function (tree, id) {
      var S = global.FG.Store;
      var existing = S.parentsOf(tree, id);
      if (existing.length >= 2) {
        this.toast('Tato osoba už má oba rodiče.', 'warn');
        return;
      }
      var slots = existing.length === 1 ? [{ label: 'Druhý rodič', gender: 'x' }]
        : [{ label: 'Otec', gender: 'm' }, { label: 'Matka', gender: 'f' }];
      var forms = [];
      var newBlock = h('div', {});
      slots.forEach(function (slot) {
        var f = UI.personForm({ gender: slot.gender }, { heading: slot.label });
        forms.push(f);
        newBlock.appendChild(f);
      });

      var pick = this.picker(tree, {
        exclude: existing.concat([id]),
        label: 'Rodičem se stane',
        empty: 'Ve stromu zatím není jiná postava.'
      });
      var sw = this.sourceSwitch(newBlock, pick);

      this.modal({
        title: 'Přidat rodiče', wide: true,
        content: h('div', {}, [
          h('p', {
            class: 'dialog-text',
            text: existing.length === 1
              ? 'Druhý rodič osoby ' + S.label(tree, id) + '.'
              : 'Rodiče osoby ' + S.label(tree, id) + '. Prázdný formulář se přeskočí.'
          }),
          sw, newBlock, pick
        ]),
        buttons: [
          { label: 'Zrušit' },
          {
            label: 'Přidat', kind: 'primary',
            action: function () {
              if (sw.mode() === 'pick') {
                var target = pick.selected();
                if (!target) { UI.toast('Vyberte osobu ze seznamu.', 'warn'); return false; }
                var err = S.link(tree, id, target, 'parent');
                if (err) { UI.toast(err, 'warn'); return false; }
                UI.toast('Rodič připojen');
                return;
              }
              var data = forms.map(function (f) { return f.isEmpty() ? null : f.read(); });
              if (!data.some(function (d) { return !!d; })) {
                UI.toast('Vyplňte alespoň jedno jméno.', 'warn');
                return false;
              }
              S.addParents(tree, id, data[0], data[1]);
              UI.toast('Rodiče přidáni');
            }
          }
        ]
      });
    },

    addPartner: function (tree, id) {
      var S = global.FG.Store;
      var p = tree.people[id];
      var form = this.personForm({
        gender: p.gender === 'm' ? 'f' : p.gender === 'f' ? 'm' : 'x'
      });
      var pick = this.picker(tree, {
        exclude: S.partnersOf(tree, id).concat([id]),
        label: 'Partnerem se stane',
        empty: 'Ve stromu zatím není jiná postava.'
      });
      var sw = this.sourceSwitch(form, pick);

      // období svazku — postava jich může mít víc za sebou a každý je vlastní
      var from = h('input', { type: 'text', placeholder: 'např. 1042' });
      var to = h('input', { type: 'text', placeholder: 'prázdné = trvá' });
      var period = h('div', { class: 'union-period' }, [
        h('h3', { class: 'form-heading', text: 'Období svazku' }),
        h('div', { class: 'row2' }, [UI.field('Od', from), UI.field('Do', to)])
      ]);

      this.modal({
        title: 'Přidat partnera', wide: true,
        content: h('div', {}, [
          h('p', {
            class: 'dialog-text',
            text: 'Partner osoby ' + S.label(tree, id) + '. Můžete založit novou postavu, ' +
              'nebo svazkem spojit dvě, které už ve stromu jsou. ' +
              'Svazků může mít postava víc — každý se svým obdobím i potomky.'
          }),
          sw, form, pick, period
        ]),
        buttons: [
          { label: 'Zrušit' },
          {
            label: 'Přidat', kind: 'primary',
            action: function () {
              var years = { start: from.value.trim(), end: to.value.trim() };
              if (sw.mode() === 'pick') {
                var target = pick.selected();
                if (!target) { UI.toast('Vyberte osobu ze seznamu.', 'warn'); return false; }
                var err = S.link(tree, id, target, 'partner', null, years);
                if (err) { UI.toast(err, 'warn'); return false; }
                UI.toast('Svazek vytvořen');
                return;
              }
              if (form.isEmpty()) { UI.toast('Vyplňte jméno.', 'warn'); return false; }
              S.addPartner(tree, id, form.read(), years);
              UI.toast('Partner přidán');
            }
          }
        ]
      });
    },

    /* Výběr rodičovského svazku. Bez něj by dítě spadlo do prvního svazku,
       tedy i partnerovi — a to bývá špatně, když je druhý rodič neznámý. */
    unionChoice: function (tree, id) {
      var S = global.FG.Store;
      var unions = S.unionsOf(tree, id);
      var sel = h('select', {});
      unions.forEach(function (u) {
        var other = u.partners.filter(function (x) { return x !== id; })[0];
        sel.appendChild(h('option', {
          value: u.id,
          text: other ? 'Spolu s partnerem: ' + S.label(tree, other)
                      : 'Sám/sama (druhý rodič neznámý)'
        }));
      });
      // Když už samostatný svazek existuje, další by byl jeho dvojník —
      // nabídka by pak měla dvě stejně znějící položky.
      var maSolo = unions.some(function (u) { return u.partners.length === 1; });
      if (!maSolo) {
        sel.appendChild(h('option', {
          value: 'new', text: 'Sám/sama (druhý rodič neznámý)'
        }));
      }
      var box = UI.field('Rodičovský svazek', sel);
      if (!unions.length) { sel.value = 'new'; box.style.display = 'none'; }
      return { el: box, value: function () { return sel.value; } };
    },

    addChild: function (tree, id) {
      var S = global.FG.Store;
      var content = h('div', {});
      content.appendChild(h('p', {
        class: 'dialog-text',
        text: 'Dítě osoby ' + S.label(tree, id) + '. Můžete založit novou postavu, ' +
          'nebo pod rodiče zařadit někoho, kdo už ve stromu je.'
      }));
      var choice = this.unionChoice(tree, id);
      content.appendChild(choice.el);

      var form = this.personForm({});
      // vlastní děti ze seznamu nemizí — díky tomu jde dítě přeřadit
      // z páru pod jednoho rodiče a naopak
      var pick = this.picker(tree, {
        exclude: [id],
        label: 'Dítětem se stane',
        empty: 'Ve stromu zatím není jiná postava.'
      });
      var sw = this.sourceSwitch(form, pick);
      content.appendChild(sw);
      content.appendChild(form);
      content.appendChild(pick);

      this.modal({
        title: 'Přidat dítě', wide: true,
        content: content,
        buttons: [
          { label: 'Zrušit' },
          {
            label: 'Přidat', kind: 'primary',
            action: function () {
              var uid = choice.value();
              if (sw.mode() === 'pick') {
                var target = pick.selected();
                if (!target) { UI.toast('Vyberte osobu ze seznamu.', 'warn'); return false; }
                var puvodni = S.parentsOf(tree, target);
                var byloMoje = puvodni.indexOf(id) !== -1;
                var err = S.link(tree, id, target, 'child', uid);
                if (err) { UI.toast(err, 'warn'); return false; }
                var noveRodice = S.parentsOf(tree, target).map(function (x) {
                  return S.label(tree, x);
                }).join(' a ');
                UI.toast(byloMoje
                  ? 'Nyní dítě: ' + noveRodice
                  : (puvodni.length
                      ? 'Dítě připojeno a odpojeno od dosavadních rodičů'
                      : 'Dítě připojeno'));
                return;
              }
              if (form.isEmpty()) { UI.toast('Vyplňte jméno.', 'warn'); return false; }
              S.addChild(tree, id, uid, form.read());
              UI.toast('Dítě přidáno');
            }
          }
        ]
      });
    },

    linkPerson: function (tree, id) {
      var S = global.FG.Store;
      var relation = 'partner';
      var choice = this.unionChoice(tree, id);
      choice.el.style.display = 'none';          // patří jen ke vztahu „dítě"
      var pick = this.picker(tree, {
        exclude: [id],
        label: 'Vyberte postavu',
        empty: 'Ve stromu zatím není jiná postava.'
      });

      this.modal({
        title: 'Propojit s existující osobou',
        wide: true,
        content: h('div', {}, [
          h('p', {
            class: 'dialog-text',
            text: 'Vyberte vztah a osobu. Takto propojíte i větve rodu, ' +
              'které jste zakládali odděleně.'
          }),
          h('div', { class: 'field' }, [
            h('span', {
              class: 'field-label',
              text: 'Vztah k osobě ' + S.label(tree, id)
            }),
            this.segmented([
              { v: 'partner', l: 'Partner' },
              { v: 'parent', l: 'Rodič' },
              { v: 'child', l: 'Dítě' }
            ], relation, function (v) {
              relation = v;
              choice.el.style.display = (v === 'child' && S.unionsOf(tree, id).length) ? '' : 'none';
            })
          ]),
          choice.el,
          pick
        ]),
        buttons: [
          { label: 'Zrušit' },
          {
            label: 'Propojit', kind: 'primary',
            action: function () {
              var target = pick.selected();
              if (!target) { UI.toast('Vyberte osobu ze seznamu.', 'warn'); return false; }
              var err = S.link(tree, id, target, relation,
                relation === 'child' ? choice.value() : null);
              if (err) { UI.toast(err, 'warn'); return false; }
              UI.toast('Propojeno');
            }
          }
        ]
      });
    },

    unlinkPerson: function (tree, id) {
      var S = global.FG.Store;
      var rels = S.relationsOf(tree, id);
      if (!rels.length) {
        this.toast('Tato osoba nemá žádné vazby.', 'warn');
        return;
      }
      var content = h('div', {}, [
        h('p', {
          class: 'dialog-text',
          text: 'Vyberte vazbu, kterou chcete zrušit. Osoby zůstanou ve stromu. ' +
            'Odpojení rodiče se týká jen této osoby — sourozencům rodič zůstane.'
        })
      ]);
      var m;
      var list = h('div', { class: 'pick-list' });
      rels.forEach(function (r) {
        list.appendChild(h('button', {
          class: 'pick', type: 'button',
          onclick: function () {
            S.unlink(tree, id, r);
            if (r.kind === 'parent') {
              // odpojení rodiče se týká jen této osoby, sourozencům zůstává
              var zbyli = S.parentsOf(tree, id).map(function (x) {
                return S.label(tree, x);
              });
              UI.toast(zbyli.length
                ? S.label(tree, id) + ' — rodič už jen ' + zbyli.join(' a ')
                : S.label(tree, id) + ' je teď bez rodičů');
            } else {
              UI.toast('Vazba zrušena');
            }
            m.close();
          }
        }, [h('span', { class: 'pick-name', text: r.label }),
        h('span', { class: 'pick-meta', html: icon('unlink', 16) })]));
      });
      content.appendChild(list);
      m = this.modal({ title: 'Odpojit vazbu', content: content, buttons: [{ label: 'Zavřít' }] });
    },

    /* ---------- správa rodů ---------- */

    treeManager: function () {
      var S = global.FG.Store;
      var m;
      var content = h('div', {});

      function draw() {
        content.textContent = '';
        var list = h('div', { class: 'tree-list' });
        S.trees().forEach(function (t) {
          var st = S.stats(t);
          var active = t.id === S.activeWorld().activeTreeId;
          var row = h('div', { class: 'tree-row' + (active ? ' on' : '') }, [
            h('button', {
              class: 'tree-open', type: 'button',
              onclick: function () { S.setActiveTree(t.id); m.close(); }
            }, [
              h('span', { class: 'tree-name', text: t.name }),
              h('span', { class: 'tree-meta', text: st.people + ' osob · ' + (t.focusId && t.people[t.focusId] ? S.label(t, t.focusId) : '—') })
            ]),
            h('div', { class: 'tree-actions' }, [
              h('button', {
                class: 'mini', type: 'button', text: 'Přejmenovat',
                onclick: function () { UI.renameTreeDialog(t.id, draw); }
              }),
              h('button', {
                class: 'mini', type: 'button', text: 'Kopie',
                onclick: function () { S.duplicateTree(t.id); draw(); UI.toast('Kopie vytvořena'); }
              }),
              h('button', {
                class: 'mini danger', type: 'button', text: 'Smazat',
                onclick: function () {
                  UI.confirm('Smazat rod „' + t.name + '"?',
                    'Smaže se celý strom včetně všech osob. Tuto akci lze vrátit pomocí Ctrl+Z.',
                    function () { S.deleteTree(t.id); draw(); UI.toast('Rod smazán'); }, 'Smazat');
                }
              })
            ])
          ]);
          list.appendChild(row);
        });
        content.appendChild(list);
        content.appendChild(h('div', { class: 'manager-tools' }, [
          h('button', {
            class: 'btn primary', type: 'button', text: '+ Nový rod',
            onclick: function () {
              var t = S.createTree('Nový rod');
              S.setActiveTree(t.id);
              m.close();
              UI.toast('Rod vytvořen — klepněte na kartu a začněte');
            }
          }),
          h('button', {
            class: 'btn ghost', type: 'button', text: 'Zálohovat vše (JSON)',
            onclick: function () { UI.downloadJSON(); }
          }),
          h('button', {
            class: 'btn ghost', type: 'button', text: 'Načíst ze zálohy',
            onclick: function () { UI.importDialog(function () { draw(); }); }
          })
        ]));
      }
      draw();
      m = this.modal({ title: 'Rody a stromy', wide: true, content: content, buttons: [{ label: 'Zavřít' }] });
    },

    /* ---------- světy ---------- */

    worldManager: function () {
      var S = global.FG.Store;
      var W = global.FG.World;
      var m;
      var content = h('div', {});

      function draw() {
        content.textContent = '';
        var list = h('div', { class: 'tree-list' });
        S.worlds().forEach(function (w) {
          var active = w.id === S.state.activeWorldId;
          list.appendChild(h('div', { class: 'tree-row' + (active ? ' on' : '') }, [
            h('button', {
              class: 'tree-open', type: 'button',
              onclick: function () {
                S.setActiveWorld(w.id);
                global.FG.App.go('prehled');
                m.close();
              }
            }, [
              h('span', { class: 'tree-name', text: w.name }),
              h('span', {
                class: 'tree-meta',
                text: W.count(w, 'postava') + ' postav · ' + W.count(w, 'misto') +
                  ' míst · ' + Object.keys(w.trees).length + ' rodokmenů'
              })
            ]),
            h('div', { class: 'tree-actions' }, [
              h('button', {
                class: 'mini', type: 'button', text: 'Přejmenovat',
                onclick: function () {
                  var input = h('input', { type: 'text', value: w.name, maxlength: '60' });
                  UI.modal({
                    title: 'Přejmenovat svět',
                    content: UI.field('Název', input),
                    buttons: [
                      { label: 'Zrušit' },
                      {
                        label: 'Uložit', kind: 'primary',
                        action: function () {
                          S.renameWorld(w.id, input.value.trim() || 'Svět bez jména');
                          draw();
                        }
                      }
                    ]
                  });
                }
              }),
              h('button', {
                class: 'mini danger', type: 'button', text: 'Smazat',
                onclick: function () {
                  m.close();
                  UI.confirm('Smazat svět „' + w.name + '"?',
                    'Zmizí všechny jeho postavy, místa, události i rodokmeny. ' +
                    'Vrátit lze pomocí Ctrl+Z.',
                    function () { S.deleteWorld(w.id); UI.toast('Svět smazán'); }, 'Smazat');
                }
              })
            ])
          ]));
        });
        content.appendChild(list);
        content.appendChild(h('div', { class: 'manager-tools' }, [
          h('button', {
            class: 'btn primary', type: 'button', text: '+ Nový svět',
            onclick: function () {
              var input = h('input', { type: 'text', value: '', placeholder: 'Název světa' });
              UI.modal({
                title: 'Nový svět',
                content: UI.field('Název', input),
                buttons: [
                  { label: 'Zrušit' },
                  {
                    label: 'Založit', kind: 'primary',
                    action: function () {
                      S.createWorld(input.value.trim() || 'Nový svět');
                      global.FG.App.go('prehled');
                      m.close();
                    }
                  }
                ]
              });
            }
          }),
          h('button', {
            class: 'btn ghost', type: 'button', text: 'Zálohovat vše (JSON)',
            onclick: function () { UI.downloadJSON(); }
          }),
          h('button', {
            class: 'btn ghost', type: 'button', text: 'Načíst ze zálohy',
            onclick: function () { UI.importDialog(function () { draw(); }); }
          })
        ]));
      }
      draw();
      m = this.modal({ title: 'Světy', wide: true, content: content, buttons: [{ label: 'Zavřít' }] });
    },

    /* hledání napříč celým světem */
    worldSearch: function () {
      var S = global.FG.Store;
      var W = global.FG.World;
      var world = S.activeWorld();
      var input = h('input', { type: 'search', placeholder: 'Jméno, místo, událost, text…' });
      var list = h('div', { class: 'pick-list' });
      var m;

      function draw() {
        list.textContent = '';
        var q = input.value.trim();
        var res = q ? W.search(world, q) : W.all(world).slice(0, 30);
        if (!res.length) {
          list.appendChild(h('div', { class: 'pick-empty', text: 'Nic nenalezeno.' }));
        }
        res.slice(0, 60).forEach(function (e) {
          var tree = e.type === 'postava' ? S.treeOf(world, e.id) : null;
          var inTree = tree && global.FG.App.section === 'rodokmeny' &&
            tree.id === world.activeTreeId;
          list.appendChild(h('button', {
            class: 'pick', type: 'button',
            onclick: function () {
              m.close();
              if (inTree) {
                if (global.FG.View.layout.index[e.id]) {
                  global.FG.View.centerOn(e.id, true, true);
                  global.FG.View.select(e.id);
                } else {
                  S.setFocus(tree, e.id);
                }
              } else {
                global.FG.App.open(e.id);
              }
            }
          }, [
            h('span', { class: 'pick-name', text: (e.name || '').trim() || 'Bez názvu' }),
            h('span', {
              class: 'pick-meta',
              text: (W.TYPES[e.type] ? W.TYPES[e.type].label : '') +
                (e.alias ? '  ·  ' + e.alias : '')
            })
          ]));
        });
      }
      input.addEventListener('input', draw);
      draw();
      m = this.modal({
        title: 'Hledat ve světě',
        content: h('div', {}, [this.field('Hledat', input), list]),
        buttons: [{ label: 'Zavřít' }]
      });
    },

    renameTreeDialog: function (id, after) {
      var S = global.FG.Store;
      var t = S.activeWorld().trees[id];
      var input = h('input', { type: 'text', value: t.name, maxlength: '60' });
      this.modal({
        title: 'Přejmenovat rod',
        content: this.field('Název', input),
        buttons: [
          { label: 'Zrušit' },
          {
            label: 'Uložit', kind: 'primary',
            action: function () {
              S.renameTree(id, input.value.trim() || 'Bez názvu');
              if (after) after();
            }
          }
        ]
      });
    },

    downloadJSON: function () {
      var S = global.FG.Store;
      var name = 'kroniky-rodu-' + new Date().toISOString().slice(0, 10) + '.json';
      global.FG.Files.save(name, S.exportJSON(), 'application/json', function (ok) {
        if (ok) UI.toast('Záloha uložena');
      });
    },

    importDialog: function (after) {
      var S = global.FG.Store;
      var file = h('input', { type: 'file', accept: '.json,application/json' });
      var mode = 'merge';
      var segs = [
        { v: 'merge', l: 'Přidat k mým rodům' },
        { v: 'replace', l: 'Nahradit vše' }
      ].map(function (o) {
        return h('button', {
          type: 'button', class: 'seg' + (o.v === mode ? ' on' : ''), text: o.l,
          onclick: function (ev) {
            mode = o.v;
            var sibs = ev.target.parentNode.querySelectorAll('.seg');
            for (var i = 0; i < sibs.length; i++) sibs[i].classList.remove('on');
            ev.target.classList.add('on');
          }
        });
      });
      this.modal({
        title: 'Načíst ze zálohy',
        content: h('div', {}, [
          h('p', { class: 'dialog-text', text: 'Vyberte soubor JSON vytvořený touto aplikací.' }),
          h('div', { class: 'field' }, [
            h('span', { class: 'field-label', text: 'Způsob' }),
            h('div', { class: 'segmented' }, segs)
          ]),
          this.field('Soubor', file)
        ]),
        buttons: [
          { label: 'Zrušit' },
          {
            label: 'Načíst', kind: 'primary',
            action: function () {
              var f = file.files && file.files[0];
              if (!f) { UI.toast('Vyberte soubor.', 'warn'); return false; }
              var r = new FileReader();
              r.onload = function () {
                try {
                  S.importJSON(r.result, mode);
                  UI.toast('Data načtena');
                  if (after) after();
                } catch (e) {
                  UI.toast('Soubor se nepodařilo načíst: ' + e.message, 'warn');
                }
              };
              r.readAsText(f);
            }
          }
        ]
      });
    },

    /* ---------- nastavení ---------- */



    /* Tlačítko „uložit" i ukazatel stavu v jednom — sedí v hlavičce stránky
       i mezi nástroji nad rodokmenem. */
    cloudTlacitka: [],

    cloudPopis: function () {
      var C = global.FG.Sync;
      var App = global.FG.App;
      if (!C.zapnuto()) return { text: 'Záloha', tone: 'off', title: 'Nastavit zálohu do cloudu' };
      if (C.stav === 'prace') return { text: 'Ukládám…', tone: 'work', title: 'Ukládám do cloudu' };
      if (C.stav === 'chyba' || C.stav === 'konflikt') {
        return { text: 'Neuloženo', tone: 'bad', title: C.zprava + ' — klepnutím zkusit znovu' };
      }
      if (App && App.cloudCeka && App.cloudCeka()) {
        return { text: 'Ukládá se…', tone: 'work', title: 'Změny se za okamžik uloží — klepnutím hned' };
      }
      var kdy = C.config().kdy;
      return {
        text: kdy ? 'Uloženo' : 'Uložit',
        tone: kdy ? 'ok' : 'off',
        title: kdy ? 'Uloženo do cloudu ' + UI.kdyText(kdy) + ' — klepnutím uložit znovu'
                   : 'Uložit svět do cloudu'
      };
    },

    cloudTlacitko: function (opts) {
      opts = opts || {};
      var b = h('button', {
        class: 'btn ghost cloud-btn' + (opts.tool ? ' tool' : ''),
        type: 'button',
        onclick: function () {
          var C = global.FG.Sync;
          if (!C.zapnuto()) { UI.cloudDialog(); return; }
          global.FG.App.cloudUloz('Ruční záloha světa');
        }
      });
      b.dataset.role = 'cloud';
      if (opts.tool) b.setAttribute('data-act', 'none');
      UI.cloudTlacitka.push(b);
      UI.kresliCloud(b, !!opts.tool);
      return b;
    },

    kresliCloud: function (b, jenIkona) {
      var s2 = UI.cloudPopis();
      b.className = (jenIkona ? 'tool cloud-btn' : 'btn ghost cloud-btn') + ' tone-' + s2.tone;
      b.title = s2.title;
      b.innerHTML = '<span class="cloud-ico">' +
        icon(s2.tone === 'ok' ? 'check' : 'cloud', jenIkona ? 20 : 17) + '</span>' +
        (jenIkona ? '' : '<span class="cloud-txt"></span>');
      var t = b.querySelector('.cloud-txt');
      if (t) t.textContent = s2.text;
    },

    cloudRefresh: function () {
      UI.cloudTlacitka = UI.cloudTlacitka.filter(function (b) { return b.isConnected; });
      UI.cloudTlacitka.forEach(function (b) {
        UI.kresliCloud(b, b.classList.contains('tool'));
      });
    },


    /* ---------- hromadné zařazení míst ---------- */

    /* Města obvykle patří do kraje, ale vyplňovat to u každého zvlášť je
       otrava. Tohle okno zařadí rovnou celou skupinu. */
    zaraditMista: function (opts) {
      opts = opts || {};
      var S = global.FG.Store, W = global.FG.World;
      var w = S.activeWorld();
      var m;

      /* cíl — kam se místa zařadí */
      var cil = h('select', {});
      var nabidka = W.all(w, 'misto').slice();
      nabidka.sort(function (a, b) {
        var ka = a.druh === 'kraj' ? 0 : 1, kb = b.druh === 'kraj' ? 0 : 1;
        return ka - kb || (a.name || '').localeCompare(b.name || '', 'cs');
      });
      cil.appendChild(h('option', { value: '', text: '— nikam (zrušit zařazení) —' }));
      nabidka.forEach(function (x) {
        cil.appendChild(h('option', {
          value: x.id, text: x.name + (x.druh ? ' (' + x.druh + ')' : '')
        }));
      });

      /* které záznamy nabídnout */
      var vse = W.all(w, 'misto').filter(function (x) {
        if (opts.cil && x.id === opts.cil) return false;
        if (opts.narod) return x.narod === opts.narod;
        return true;
      });
      var vybrano = {};
      vse.forEach(function (x) { if (!x.parent) vybrano[x.id] = true; });

      /* Předvolený cíl: kam už většina těch míst patří, jinak první kraj —
         ať se omylem nezruší zařazení jedním klepnutím. */
      var cetnost = {};
      vse.forEach(function (x) {
        if (x.parent) cetnost[x.parent] = (cetnost[x.parent] || 0) + 1;
      });
      var nejcastejsi = Object.keys(cetnost).sort(function (a, b) {
        return cetnost[b] - cetnost[a];
      })[0];
      var prvniKraj = (nabidka.filter(function (x) { return x.druh === 'kraj'; })[0] || {}).id;
      cil.value = opts.cil || nejcastejsi || prvniKraj || '';

      var hledat = h('input', { type: 'search', placeholder: 'Hledat mezi místy…' });
      var seznam = h('div', { class: 'pick-list tall' });
      var pocet = h('p', { class: 'dialog-text small' });

      function spocitej() {
        var n = 0;
        for (var k in vybrano) if (vybrano[k]) n++;
        pocet.textContent = 'Vybráno: ' + n + ' z ' + vse.length;
      }

      function kresli() {
        seznam.textContent = '';
        var q = hledat.value.trim().toLowerCase();
        var items = vse.filter(function (x) {
          return !q || (x.name || '').toLowerCase().indexOf(q) !== -1;
        });
        if (!items.length) {
          seznam.appendChild(h('div', { class: 'pick-empty', text: 'Nic nenalezeno.' }));
        }
        items.forEach(function (x) {
          var box = h('input', { type: 'checkbox' });
          box.checked = !!vybrano[x.id];
          box.addEventListener('change', function () {
            vybrano[x.id] = box.checked; spocitej();
          });
          var kde = x.parent ? W.label(w, x.parent) : '';
          seznam.appendChild(h('label', { class: 'pick check' }, [
            box,
            h('span', { class: 'pick-name', text: x.name || 'Bez názvu' }),
            h('span', {
              class: 'pick-meta',
              text: (x.druh || '') + (kde ? '  ·  nyní v ' + kde : '')
            })
          ]));
        });
        spocitej();
      }
      hledat.addEventListener('input', kresli);
      kresli();

      var content = h('div', {}, [
        h('p', {
          class: 'dialog-text',
          text: opts.narod
            ? 'Zařaďte místa tohoto národa do kraje. Zaškrtnutá jsou ta, ' +
              'která zatím nikam nepatří.'
            : 'Vyberte místa, která sem patří. Zaškrtnutá jsou ta, ' +
              'která zatím nikam nepatří.'
        }),
        UI.field('Zařadit do', cil),
        h('div', { class: 'toolbar' }, [
          hledat,
          h('button', {
            class: 'mini', type: 'button', text: 'Vybrat vše',
            onclick: function () {
              vse.forEach(function (x) { vybrano[x.id] = true; });
              kresli();
            }
          }),
          h('button', {
            class: 'mini', type: 'button', text: 'Zrušit výběr',
            onclick: function () { vybrano = {}; kresli(); }
          })
        ]),
        seznam,
        pocet
      ]);

      m = this.modal({
        title: 'Zařadit místa', wide: true, content: content,
        buttons: [
          { label: 'Zrušit' },
          {
            label: 'Zařadit', kind: 'primary',
            action: function () {
              var ids = Object.keys(vybrano).filter(function (k) { return vybrano[k]; });
              if (!ids.length) { UI.toast('Nevybrali jste žádné místo.', 'warn'); return false; }
              var cilId = cil.value;
              if (cilId && ids.indexOf(cilId) !== -1) {
                UI.toast('Místo nemůže ležet samo v sobě.', 'warn'); return false;
              }
              S.snapshot();
              var zmen = 0;
              ids.forEach(function (id) {
                var x = W.get(w, id);
                if (!x || x.parent === cilId) return;
                if (cilId && UI.jePotomkem(w, cilId, id)) return;   // hlídání kruhu
                x.parent = cilId;
                zmen++;
              });
              S.emit('entity-update');
              UI.toast(zmen
                ? 'Zařazeno míst: ' + zmen + (cilId ? ' do ' + W.label(w, cilId) : '')
                : 'Nic se nezměnilo');
            }
          }
        ]
      });
      return m;
    },

    /* je „mozny" potomkem místa „predek"? (aby nevznikl kruh) */
    jePotomkem: function (w, mozny, predek) {
      var W = global.FG.World;
      var cur = W.get(w, mozny), i = 0;
      while (cur && cur.parent && i++ < 50) {
        if (cur.parent === predek) return true;
        cur = W.get(w, cur.parent);
      }
      return false;
    },

    /* ---------- záloha do cloudu ---------- */

    /* krátký popis stavu zálohy — používá ho Přehled i Nastavení */
    cloudStav: function () {
      var C = global.FG.Sync;
      if (!C.zapnuto()) return { text: 'Není nastavena', tone: 'off' };
      if (C.stav === 'prace') return { text: C.zprava || 'Ukládám…', tone: 'work' };
      if (C.stav === 'chyba') return { text: C.zprava, tone: 'bad' };
      if (C.stav === 'konflikt') return { text: 'V cloudu je jiná verze', tone: 'bad' };
      var kdy = C.config().kdy;
      return {
        text: kdy ? 'Uloženo ' + UI.kdyText(kdy) : 'Připojeno, zatím neuloženo',
        tone: 'ok'
      };
    },

    kdyText: function (ms) {
      if (!ms) return '—';
      var d = new Date(ms), ted = new Date();
      var cas = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
      if (d.toDateString() === ted.toDateString()) return 'dnes v ' + cas;
      return d.getDate() + '. ' + (d.getMonth() + 1) + '. v ' + cas;
    },

    /* stručný obsah zálohy, ať jde poznat, která verze je která */
    cloudSouhrn: function (data) {
      if (!data || !data.worlds) return 'neznámý obsah';
      var postav = 0, mist = 0, stromu = 0;
      Object.keys(data.worlds).forEach(function (wid) {
        var w = data.worlds[wid];
        Object.keys(w.entities || {}).forEach(function (id) {
          var t = w.entities[id].type;
          if (t === 'postava') postav++;
          if (t === 'misto') mist++;
        });
        stromu += Object.keys(w.trees || {}).length;
      });
      return postav + ' postav · ' + mist + ' míst · ' + stromu +
        (stromu === 1 ? ' rodokmen' : ' rodokmenů');
    },

    cloudDialog: function () {
      var C = global.FG.Sync;
      var cfg = C.config();
      var m;

      var repo = h('input', {
        type: 'text', value: cfg.repo, placeholder: 'jmeno/mandriosa-data',
        autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false'
      });
      var soubor = h('input', { type: 'text', value: cfg.path, placeholder: 'svet.json' });
      var token = h('input', {
        type: 'password', value: '', placeholder: cfg.token ? 'uložen — necháte-li prázdné, zůstane' : 'github_pat_…',
        autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false'
      });

      var stav = h('p', { class: 'dialog-text small' });
      function prekresli() {
        if (!stav.isConnected) return;      // dialog už je zavřený
        stav.textContent = 'Stav: ' + UI.cloudStav().text;
      }
      prekresli();

      var navod = h('div', { class: 'dialog-text small' });
      navod.innerHTML =
        '<strong>Jak to nastavit</strong> (stačí jednou):' +
        '<ol style="margin:6px 0 0 18px; padding:0">' +
        '<li>Na GitHubu založte <em>nový soukromý</em> repozitář, třeba <code>mandriosa-data</code>. ' +
        'Nechte ho prázdný.</li>' +
        '<li>V Settings → Developer settings → Personal access tokens → ' +
        '<em>Fine-grained tokens</em> vytvořte token: přístup jen k tomuto ' +
        'repozitáři a jediné oprávnění <em>Contents: Read and write</em>.</li>' +
        '<li>Sem vepište <code>jmeno/mandriosa-data</code> a vložte token.</li>' +
        '</ol>' +
        '<p style="margin:8px 0 0">Token zůstává jen v tomto prohlížeči a do zálohy ' +
        'světa se nikdy nezapisuje. Kdyby se ztratil, zrušte ho na GitHubu — ' +
        'dosáhne pouze na tento jeden repozitář.</p>';

      var content = h('div', {}, [
        h('p', {
          class: 'dialog-text',
          text: 'Svět se po každé změně uloží do vašeho soukromého repozitáře. ' +
            'Každé uložení je commit, takže se dá vrátit i ke starší verzi.'
        }),
        UI.field('Repozitář', repo),
        UI.field('Soubor', soubor),
        UI.field('Přístupový token', token),
        stav,
        navod
      ]);

      var tlacitka = [{ label: 'Zavřít' }];
      if (C.zapnuto()) {
        tlacitka.push({
          label: 'Uložit teď', action: function () {
            global.FG.App.cloudUloz('Ruční záloha světa');
            return false;
          }
        });
        tlacitka.push({
          label: 'Načíst z cloudu', action: function () {
            m.close();
            global.FG.App.cloudNacti();
            return false;
          }
        });
        tlacitka.push({
          label: 'Odpojit', kind: 'ghost', action: function () {
            m.close();
            UI.confirm('Odpojit zálohu?',
              'Data zůstanou v cloudu i v tomto prohlížeči, jen se přestanou ukládat.',
              function () { C.odpojit(); UI.toast('Záloha odpojena'); }, 'Odpojit');
            return false;
          }
        });
      }
      tlacitka.push({
        label: C.zapnuto() ? 'Uložit nastavení' : 'Propojit', kind: 'primary',
        action: function () {
          var novy = {
            repo: repo.value.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, ''),
            path: soubor.value.trim() || 'svet.json'
          };
          if (token.value.trim()) novy.token = token.value.trim();
          if (!novy.repo || !/^[^/]+\/[^/]+$/.test(novy.repo)) {
            UI.toast('Repozitář zapište jako jmeno/repozitar.', 'warn');
            return false;
          }
          var zkus = C.config();
          for (var k in novy) zkus[k] = novy[k];
          if (!zkus.token) { UI.toast('Vložte přístupový token.', 'warn'); return false; }
          stav.textContent = 'Stav: ověřuji…';
          C.overit(zkus).then(function () {
            if (zkus.repo !== C.config().repo || zkus.path !== C.config().path) novy.sha = '';
            C.setConfig(novy);
            m.close();
            UI.toast('Propojeno s GitHubem');
            global.FG.App.cloudStart(true);
          }).catch(function (e) {
            stav.textContent = 'Stav: ' + e.message;
            UI.toast(e.message, 'warn');
          });
          return false;
        }
      });

      m = this.modal({ title: 'Záloha v cloudu', wide: true, content: content, buttons: tlacitka });
      C.onStav(prekresli);
      return m;
    },

    settings: function () {
      var S = global.FG.Store;
      var s = S.state.settings;

      function seg(label, key, options) {
        var btns = options.map(function (o) {
          return h('button', {
            type: 'button', class: 'seg' + (s[key] === o.v ? ' on' : ''), text: o.l,
            onclick: function (ev) {
              s[key] = o.v;
              var sibs = ev.target.parentNode.querySelectorAll('.seg');
              for (var i = 0; i < sibs.length; i++) sibs[i].classList.remove('on');
              ev.target.classList.add('on');
              S.emit('settings');
            }
          });
        });
        return h('div', { class: 'field' }, [
          h('span', { class: 'field-label', text: label }),
          h('div', { class: 'segmented' }, btns)
        ]);
      }

      function toggle(label, key, hint) {
        var input = h('input', { type: 'checkbox' });
        input.checked = !!s[key];
        input.addEventListener('change', function () {
          s[key] = input.checked; S.emit('settings');
        });
        return h('label', { class: 'switch' }, [
          input,
          h('span', {}, [h('strong', { text: label }), hint ? h('em', { text: hint }) : null])
        ]);
      }

      var content = h('div', {}, [
        seg('Vzhled', 'theme', [{ v: 'pergamen', l: 'Pergamen' }, { v: 'inkoust', l: 'Inkoust' }]),
        seg('Vedlejší větve', 'collateral', [
          { v: 'none', l: 'Jen přímá linie' },
          { v: 'siblings', l: 'Se sourozenci' },
          { v: 'all', l: 'Celý rod' }
        ]),
        toggle('Zobrazovat partnery', 'showPartners'),
        toggle('Zobrazovat roky života', 'showYears'),
        toggle('Označit osoby s poznámkou', 'showNotes'),
        h('hr', {}),
        h('div', { class: 'manager-tools' }, [
          h('button', { class: 'btn ghost', type: 'button', text: 'Zálohovat vše (JSON)', onclick: function () { UI.downloadJSON(); } }),
          h('button', { class: 'btn ghost', type: 'button', text: 'Načíst ze zálohy', onclick: function () { UI.importDialog(); } }),
          h('button', {
            class: 'btn ghost', type: 'button',
            text: 'Záloha v cloudu · ' + UI.cloudStav().text,
            onclick: function () { UI.cloudDialog(); }
          })
        ]),
        h('p', {
          class: 'dialog-text small',
          text: S.storageOk
            ? 'Data se ukládají do tohoto prohlížeče. Pro přenos jinam použijte zálohu.'
            : 'Pozor: prohlížeč neumožňuje ukládání. Data zmizí po zavření stránky — zálohujte je do souboru.'
        })
      ]);

      this.modal({ title: 'Nastavení', content: content, buttons: [{ label: 'Hotovo', kind: 'primary' }] });
    },

    /* ---------- hledání ---------- */

    searchDialog: function (tree, onPick) {
      var S = global.FG.Store;
      var input = h('input', { type: 'search', placeholder: 'Jméno nebo text v poznámce…' });
      var list = h('div', { class: 'pick-list' });
      var m;
      function draw() {
        list.textContent = '';
        var q = input.value.trim();
        var res = q ? S.search(tree, q) : Object.keys(tree.people).map(function (id) { return tree.people[id]; })
          .sort(function (a, b) { return (a.name || '').localeCompare(b.name || '', 'cs'); }).slice(0, 40);
        if (!res.length) list.appendChild(h('div', { class: 'pick-empty', text: 'Nic nenalezeno.' }));
        res.forEach(function (p) {
          list.appendChild(h('button', {
            class: 'pick', type: 'button',
            onclick: function () { m.close(); onPick(p.id); }
          }, [
            h('span', { class: 'pick-name', text: (p.name || '').trim() || 'Bez jména' }),
            h('span', { class: 'pick-meta', text: S.lifespan(p) })
          ]));
        });
      }
      input.addEventListener('input', draw);
      draw();
      m = this.modal({
        title: 'Najít osobu',
        content: h('div', {}, [this.field('Hledat', input), list]),
        buttons: [{ label: 'Zavřít' }]
      });
    },

    /* ---------- export obrázku ---------- */

    exportDialog: function (tree, currentLayout) {
      var S = global.FG.Store;
      var opts = { format: 'A5', orientation: 'auto', scope: 'view', theme: S.state.settings.theme };
      var preview = h('canvas', { class: 'preview-canvas' });
      var info = h('p', { class: 'dialog-text small' });
      var work = document.createElement('canvas');
      var lastResult = null;

      function layoutFor() {
        if (opts.scope === 'view') return currentLayout;
        return global.FG.Layout.compute(tree, {
          focusId: tree.focusId, up: Infinity, down: Infinity,
          collateral: 'all', showPartners: S.state.settings.showPartners
        });
      }

      function refresh() {
        var lay = layoutFor();
        lastResult = global.FG.Export.render(tree, lay, S.state.settings, {
          format: opts.format, orientation: opts.orientation, theme: opts.theme,
          dpi: 300, canvas: work
        });
        var pc = preview.getContext('2d');
        var maxW = 420, maxH = 480;
        var sc = Math.min(maxW / work.width, maxH / work.height);
        preview.width = Math.round(work.width * sc);
        preview.height = Math.round(work.height * sc);
        pc.imageSmoothingQuality = 'high';
        pc.drawImage(work, 0, 0, preview.width, preview.height);
        info.textContent = (opts.format + ' ' +
          (lastResult.orientation === 'landscape' ? 'na šířku' : 'na výšku') +
          ' · 300 DPI · ' + work.width + '×' + work.height + ' px · ' +
          lay.persons.length + ' osob') + (lastResult.warn ? ' — ' + lastResult.warn : '');
        info.className = 'dialog-text small' + (lastResult.warn ? ' warn' : '');
      }

      function seg(label, key, options) {
        var btns = options.map(function (o) {
          return h('button', {
            type: 'button', class: 'seg' + (opts[key] === o.v ? ' on' : ''), text: o.l,
            onclick: function (ev) {
              opts[key] = o.v;
              var sibs = ev.target.parentNode.querySelectorAll('.seg');
              for (var i = 0; i < sibs.length; i++) sibs[i].classList.remove('on');
              ev.target.classList.add('on');
              refresh();
            }
          });
        });
        return h('div', { class: 'field' }, [
          h('span', { class: 'field-label', text: label }),
          h('div', { class: 'segmented' }, btns)
        ]);
      }

      var content = h('div', { class: 'export-wrap' }, [
        h('div', { class: 'export-controls' }, [
          seg('Formát', 'format', [{ v: 'A5', l: 'A5' }, { v: 'A4', l: 'A4' }]),
          seg('Orientace', 'orientation', [
            { v: 'auto', l: 'Automaticky' }, { v: 'portrait', l: 'Na výšku' }, { v: 'landscape', l: 'Na šířku' }
          ]),
          seg('Rozsah', 'scope', [
            { v: 'view', l: 'Aktuální výřez' }, { v: 'full', l: 'Celý strom' }
          ]),
          seg('Vzhled', 'theme', [
            { v: 'pergamen', l: 'Pergamen' }, { v: 'inkoust', l: 'Inkoust' },
            { v: 'prosty', l: 'Prostý' }
          ]),
          info,
          global.FG.Files.hosted()
            ? h('p', {
                class: 'dialog-text small',
                text: 'Pokud se stažený soubor nikde neobjeví, otevřete obrázek ' +
                  'tlačítkem Zobrazit a uložte ho podržením prstu — nebo si tuto ' +
                  'stránku otevřete rovnou v prohlížeči.'
              })
            : null
        ]),
        h('div', { class: 'export-preview' }, [preview])
      ]);

      this.modal({
        title: 'Obrázek rodokmenu', wide: true, content: content,
        buttons: [
          { label: 'Zavřít' },
          {
            label: 'Zobrazit',
            action: function () {
              UI.showImage(work, asciiSlug(tree.name, 'rodokmen') + '.png');
              return false;
            }
          },
          {
            label: 'Stáhnout PNG', kind: 'primary',
            action: function () {
              var fname = asciiSlug(tree.name, 'rodokmen');
              global.FG.Export.download(work, fname + '-' + opts.format + '.png', function (ok) {
                if (ok) UI.toast('Obrázek předán ke stažení');
              });
              return false;
            }
          }
        ]
      });
      refresh();
    },

    /* Obrázek na celou obrazovku. Na telefonu jde podržet prstem a uložit
       do galerie i tam, kde hostitelská aplikace stahování nedokončí. */
    showImage: function (canvas, filename) {
      UI.toast('Připravuji obrázek…');
      setTimeout(function () {
        var url = canvas.toDataURL('image/png');
        var back = h('div', { class: 'image-back' });
        var stage = h('div', { class: 'image-stage' });
        var img = h('img', { class: 'image-full', src: url, alt: filename });

        // obrázek na šířku na displeji na výšku otočíme, ať je co největší;
        // uložená předloha zůstává v původní orientaci
        if (canvas.width > canvas.height &&
          global.innerHeight > global.innerWidth * 1.1) {
          img.classList.add('turned');
        }

        var bar = h('div', { class: 'image-bar' }, [
          h('span', {
            class: 'image-hint',
            text: 'Podržte prst na obrázku a zvolte uložení nebo sdílení.'
          }),
          h('button', {
            class: 'btn primary', type: 'button', text: 'Zavřít',
            onclick: function () { close(); }
          })
        ]);
        stage.appendChild(img);
        back.appendChild(stage);
        back.appendChild(bar);
        back.addEventListener('click', function (ev) {
          if (ev.target === back || ev.target === stage) close();
        });
        function close() {
          if (offLayer) offLayer();
          document.removeEventListener('keydown', onKey, true);
          back.remove();
        }
        // zachycení dřív než dialog pod náhledem, ať Esc zavře jen obrázek
        function onKey(ev) {
          if (ev.key !== 'Escape') return;
          ev.stopPropagation();
          close();
        }
        document.addEventListener('keydown', onKey, true);
        document.body.appendChild(back);
        var offLayer = UI.pushLayer(function () { close(); });
      }, 40);
    },

    /* ---------- kruhové menu ---------- */

    orbit: {
      root: null, id: null,
      // pořadí = poloha na kruhu (od horního bodu po směru hodin);
      // šipky posunu proto sedí na pravé a levé straně nabídky
      items: [
        { a: 'edit', l: 'Upravit', i: 'edit' },
        { a: 'detail', l: 'Karta', i: 'book' },
        { a: 'parents', l: 'Přidat rodiče', i: 'parents' },
        { a: 'right', l: 'Vpravo', i: 'right' },
        { a: 'partner', l: 'Přidat partnera', i: 'partner' },
        { a: 'child', l: 'Přidat dítě', i: 'child' },
        { a: 'link', l: 'Propojit', i: 'link' },
        { a: 'unlink', l: 'Odpojit', i: 'unlink' },
        { a: 'left', l: 'Vlevo', i: 'left' },
        { a: 'focus', l: 'Zaměřit', i: 'focus' },
        { a: 'delete', l: 'Smazat', i: 'trash', danger: true }
      ],

      mount: function (host, onAction) {
        this.root = h('div', { class: 'orbit' });
        this.onAction = onAction;
        host.appendChild(this.root);
        return this;
      },

      hide: function () {
        this.id = null;
        this.root.className = 'orbit';
        this.root.textContent = '';
      },

      show: function (id, pos, state) {
        var self = this;
        this.id = id;
        this.root.textContent = '';
        this.root.className = 'orbit on';
        // ztmavení okolí se „světlem" na vybrané kartě
        this.root.appendChild(h('div', {
          class: 'orbit-hole',
          style: 'left:' + Math.round(pos.x) + 'px; top:' + Math.round(pos.y) + 'px'
        }));
        // klepnutí mimo tlačítka: nabídku zavřeme, a pokud jsme trefili jinou
        // kartu, rovnou ji vybereme
        this.root.onclick = function (ev) {
          if (ev.target !== self.root) return;
          self.root.style.pointerEvents = 'none';
          var under = document.elementFromPoint(ev.clientX, ev.clientY);
          self.root.style.pointerEvents = '';
          var node = under && under.closest ? under.closest('.node') : null;
          self.onAction('close', node ? node.getAttribute('data-id') : null);
        };
        var n = this.items.length;
        // s každou další položkou se kruh o kousek rozevře, na malém
        // displeji se ale vejde jen tolik, kolik dovolí plátno
        var box = this.root.getBoundingClientRect();
        var R = 118 + Math.max(0, n - 9) * 14;
        R = Math.min(R, Math.max(104, Math.min(box.width, box.height) / 2 - 40));
        var start = -Math.PI / 2;
        this.items.forEach(function (item, i) {
          var ang = start + (i / n) * Math.PI * 2;
          var x = pos.x + Math.cos(ang) * R;
          var y = pos.y + Math.sin(ang) * R;
          var disabled = state && state.disabled && state.disabled.indexOf(item.a) !== -1;
          var b = h('button', {
            class: 'orbit-btn' + (item.danger ? ' danger' : '') + (disabled ? ' off' : ''),
            style: 'left:' + x + 'px; top:' + y + 'px',
            title: item.l,
            onclick: function (ev) {
              ev.stopPropagation();
              if (disabled) return;
              self.onAction(item.a, self.id);
            }
          }, []);
          b.innerHTML = '<span class="orbit-ico">' + icon(item.i, 21) + '</span>' +
            '<span class="orbit-label"></span>';
          b.querySelector('.orbit-label').textContent = item.l;
          self.root.appendChild(b);
        });
      }
    }
  };

  global.FG = global.FG || {};
  global.FG.UI = UI;
})(window);
