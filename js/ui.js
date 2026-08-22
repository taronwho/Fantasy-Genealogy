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
    focus: '<circle cx="12" cy="12" r="3.2"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/><circle cx="12" cy="12" r="8"/>',
    search: '<circle cx="11" cy="11" r="6.4"/><path d="M16 16l4.5 4.5"/>',
    gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.8l1.4 2.6 2.9-.5.6 2.9 2.6 1.4-1.5 2.5 1.5 2.5-2.6 1.4-.6 2.9-2.9-.5L12 21.2l-1.4-2.6-2.9.5-.6-2.9-2.6-1.4L6 12.3 4.5 9.8l2.6-1.4.6-2.9 2.9.5z"/>',
    image: '<rect x="3.5" y="5" width="17" height="14" rx="2.5"/><circle cx="9" cy="10" r="1.8"/><path d="M4.5 17l4.5-4.5 3.5 3.5 3-2.5 4 4"/>',
    trees: '<path d="M4 6h16M4 12h16M4 18h10"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    fit: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    undo: '<path d="M9 7L4 12l5 5"/><path d="M4 12h9a6 6 0 010 12h-3"/>'
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
      requestAnimationFrame(function () { back.classList.add('in'); });
      var first = box.querySelector('input,textarea,select,button.primary');
      if (first) setTimeout(function () { first.focus(); }, 60);

      function close() {
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

    editPerson: function (tree, id) {
      var S = global.FG.Store;
      var p = tree.people[id];
      if (!p) return;
      var form = this.personForm(p);
      var content = h('div', {}, [form]);

      // období jednotlivých svazků — každý je plnohodnotný a má vlastní roky
      var rows = [];
      var unions = S.unionsOf(tree, id);
      if (unions.length) {
        var box = h('div', { class: 'union-edit' }, [
          h('h3', { class: 'form-heading', text: 'Svazky' })
        ]);
        unions.forEach(function (u) {
          var other = u.partners.filter(function (x) { return x !== id; })[0];
          var from = h('input', { type: 'text', value: u.start || '', placeholder: 'od' });
          var to = h('input', { type: 'text', value: u.end || '', placeholder: 'do' });
          rows.push({ id: u.id, from: from, to: to });
          box.appendChild(h('div', { class: 'union-row' }, [
            h('span', {
              class: 'union-who',
              text: other ? S.label(tree, other) : 'Bez partnera'
            }),
            from, to
          ]));
        });
        box.appendChild(h('p', {
          class: 'dialog-text small',
          text: 'Roky, kdy svazek trval. Poznámku k němu přidáte klepnutím ' +
            'na kosočtverec mezi kartami ve stromu.'
        }));
        content.appendChild(box);
      }

      this.modal({
        title: 'Upravit osobu',
        content: content,
        buttons: [
          { label: 'Zrušit' },
          {
            label: 'Uložit', kind: 'primary',
            action: function () {
              S.batch(function () {
                S.updatePerson(tree, id, form.read());
                rows.forEach(function (r) {
                  S.updateUnion(tree, r.id, {
                    start: r.from.value.trim(), end: r.to.value.trim()
                  });
                });
              });
              UI.toast('Uloženo');
            }
          }
        ]
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

    picker: function (tree, opts) {
      opts = opts || {};
      var S = global.FG.Store;
      var exclude = opts.exclude || [];
      var selected = null;
      var search = h('input', { type: 'search', placeholder: 'Hledat jméno…' });
      var list = h('div', { class: 'pick-list' });

      function draw() {
        list.textContent = '';
        var q = search.value.trim().toLowerCase();
        var ids = Object.keys(tree.people).filter(function (pid) {
          return exclude.indexOf(pid) === -1;
        });
        if (q) {
          ids = ids.filter(function (pid) {
            var p = tree.people[pid];
            return ((p.name || '') + ' ' + (p.note || '')).toLowerCase().indexOf(q) !== -1;
          });
        }
        ids.sort(function (a, b) {
          return S.label(tree, a).localeCompare(S.label(tree, b), 'cs');
        });
        if (!ids.length) {
          list.appendChild(h('div', {
            class: 'pick-empty',
            text: q ? 'Nic nenalezeno.' : (opts.empty || 'Ve stromu není jiná osoba.')
          }));
        }
        ids.slice(0, 150).forEach(function (pid) {
          list.appendChild(h('button', {
            class: 'pick' + (pid === selected ? ' on' : ''), type: 'button',
            onclick: function () {
              selected = pid;
              draw();
              if (opts.onPick) opts.onPick(pid);
            }
          }, [
            h('span', { class: 'pick-name', text: S.label(tree, pid) }),
            h('span', { class: 'pick-meta', text: S.lifespan(tree.people[pid]) })
          ]));
        });
      }
      search.addEventListener('input', draw);
      draw();

      var wrap = h('div', { class: 'picker' }, [
        UI.field(opts.label || 'Osoba ve stromu', search),
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

    addChild: function (tree, id) {
      var S = global.FG.Store;
      var unions = S.unionsOf(tree, id);
      var choice = null;
      var content = h('div', {});
      content.appendChild(h('p', {
        class: 'dialog-text',
        text: 'Dítě osoby ' + S.label(tree, id) + '. Můžete založit novou postavu, ' +
          'nebo pod rodiče zařadit někoho, kdo už ve stromu je.'
      }));
      if (unions.length) {
        var sel = h('select', {});
        unions.forEach(function (u) {
          var other = u.partners.filter(function (x) { return x !== id; })[0];
          sel.appendChild(h('option', {
            value: u.id,
            text: other ? 'S partnerem: ' + S.label(tree, other) : 'Bez partnera'
          }));
        });
        sel.appendChild(h('option', { value: '', text: 'Nový svazek bez partnera' }));
        choice = sel;
        content.appendChild(this.field('Rodičovský svazek', sel));
      }

      var form = this.personForm({});
      var pick = this.picker(tree, {
        exclude: S.childrenOf(tree, id).concat([id]),
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
              var uid = choice ? (choice.value || null) : null;
              if (sw.mode() === 'pick') {
                var target = pick.selected();
                if (!target) { UI.toast('Vyberte osobu ze seznamu.', 'warn'); return false; }
                var hadParents = S.parentsOf(tree, target).length > 0;
                var err = S.link(tree, id, target, 'child', uid);
                if (err) { UI.toast(err, 'warn'); return false; }
                UI.toast(hadParents
                  ? 'Dítě připojeno a odpojeno od dosavadních rodičů'
                  : 'Dítě připojeno');
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
      var pick = this.picker(tree, {
        exclude: [id],
        label: 'Vyberte osobu',
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
            ], relation, function (v) { relation = v; })
          ]),
          pick
        ]),
        buttons: [
          { label: 'Zrušit' },
          {
            label: 'Propojit', kind: 'primary',
            action: function () {
              var target = pick.selected();
              if (!target) { UI.toast('Vyberte osobu ze seznamu.', 'warn'); return false; }
              var err = S.link(tree, id, target, relation);
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
        h('p', { class: 'dialog-text', text: 'Vyberte vazbu, kterou chcete zrušit. Osoby zůstanou ve stromu.' })
      ]);
      var m;
      var list = h('div', { class: 'pick-list' });
      rels.forEach(function (r) {
        list.appendChild(h('button', {
          class: 'pick', type: 'button',
          onclick: function () {
            S.unlink(tree, id, r);
            UI.toast('Vazba zrušena');
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
          var active = t.id === S.state.activeTreeId;
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

    renameTreeDialog: function (id, after) {
      var S = global.FG.Store;
      var t = S.state.trees[id];
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
          h('button', { class: 'btn ghost', type: 'button', text: 'Načíst ze zálohy', onclick: function () { UI.importDialog(); } })
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
          seg('Vzhled', 'theme', [{ v: 'pergamen', l: 'Pergamen' }, { v: 'inkoust', l: 'Inkoust' }]),
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
      }, 40);
    },

    /* ---------- kruhové menu ---------- */

    orbit: {
      root: null, id: null,
      items: [
        { a: 'edit', l: 'Upravit', i: 'edit' },
        { a: 'parents', l: 'Přidat rodiče', i: 'parents' },
        { a: 'partner', l: 'Přidat partnera', i: 'partner' },
        { a: 'child', l: 'Přidat dítě', i: 'child' },
        { a: 'link', l: 'Propojit', i: 'link' },
        { a: 'unlink', l: 'Odpojit', i: 'unlink' },
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
        var R = 118;
        var n = this.items.length;
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
