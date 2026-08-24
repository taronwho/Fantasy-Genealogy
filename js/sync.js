/* Kroniky rodů — záloha světa do soukromého repozitáře na GitHubu
 *
 * Aplikace je statická stránka, takže si data drží v prohlížeči. Aby o ně
 * nešlo přijít, umí je navíc ukládat do repozitáře, který patří uživateli:
 * každé uložení je commit, takže vzniká i historie verzí.
 *
 * Přístupový token leží ve vlastním klíči v localStorage, ne ve stavu
 * aplikace — do zálohy světa se tedy nikdy nedostane.
 */
(function (global) {
  'use strict';

  var KEY = 'kroniky-rodu-sync';
  var API = 'https://api.github.com';

  function nacti() {
    try { return JSON.parse(global.localStorage.getItem(KEY)) || {}; }
    catch (e) { return {}; }
  }
  function uloz(c) {
    try { global.localStorage.setItem(KEY, JSON.stringify(c)); } catch (e) {}
  }

  /* base64 s diakritikou */
  function doBase64(text) {
    var bytes = new global.TextEncoder().encode(text), bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return global.btoa(bin);
  }
  function zBase64(b) {
    var bin = global.atob(String(b || '').replace(/\s+/g, ''));
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new global.TextDecoder().decode(bytes);
  }

  function hlaska(stav, data) {
    var d = (data && data.message) || '';
    if (stav === 401) return 'Token neplatí nebo mu vypršela platnost.';
    if (stav === 403 && /rate limit/i.test(d)) return 'GitHub teď odmítá další požadavky, zkuste to za chvíli.';
    if (stav === 403) return 'Token nemá právo zapisovat do tohoto repozitáře.';
    if (stav === 404) return 'Repozitář nebo soubor se nenašel — zkontrolujte název a oprávnění tokenu.';
    if (stav === 409 || stav === 422) return 'V cloudu mezitím přibyla jiná verze.';
    return 'GitHub odpověděl chybou ' + stav + (d ? ' — ' + d : '');
  }

  function api(cfg, cesta, opts) {
    opts = opts || {};
    return global.fetch(API + cesta, {
      method: opts.method || 'GET',
      headers: {
        Authorization: 'Bearer ' + cfg.token,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined
    }).catch(function () {
      throw new Error('Nedaří se spojit s GitHubem — jste online?');
    }).then(function (r) {
      return r.text().then(function (t) {
        var data = null;
        try { data = t ? JSON.parse(t) : null; } catch (e) { data = null; }
        if (!r.ok) {
          var chyba = new Error(hlaska(r.status, data));
          chyba.stav = r.status;
          throw chyba;
        }
        return data;
      });
    });
  }

  var posluchaci = [];

  var Sync = {
    stav: 'off',        // off | ok | prace | chyba | konflikt
    zprava: '',
    kdy: 0,

    config: function () {
      var c = nacti();
      return {
        repo: c.repo || '', path: c.path || 'svet.json',
        branch: c.branch || 'main', token: c.token || '',
        sha: c.sha || '', kdy: c.kdy || 0
      };
    },

    zapnuto: function () {
      var c = this.config();
      return !!(c.repo && c.token);
    },

    setConfig: function (zmeny) {
      var c = this.config();
      for (var k in zmeny) c[k] = zmeny[k];
      uloz(c);
      if (!this.zapnuto()) this.oznam('off', '');
      return c;
    },

    odpojit: function () {
      try { global.localStorage.removeItem(KEY); } catch (e) {}
      this.oznam('off', '');
    },

    onStav: function (fn) { posluchaci.push(fn); },

    oznam: function (stav, zprava) {
      this.stav = stav;
      this.zprava = zprava || '';
      if (stav === 'ok') this.kdy = Date.now();
      posluchaci.forEach(function (fn) { fn(Sync.stav, Sync.zprava); });
    },

    /* ověří, že token na repozitář opravdu dosáhne */
    overit: function (cfg) {
      return api(cfg, '/repos/' + cfg.repo).then(function (r) {
        if (!r.permissions || !r.permissions.push) {
          throw new Error('Token může repozitář jen číst, ne do něj zapisovat.');
        }
        return r;
      });
    },

    /* stáhne uloženou verzi; vrací null, když tam ještě žádná není */
    pull: function () {
      var cfg = this.config();
      if (!this.zapnuto()) return Promise.resolve(null);
      this.oznam('prace', 'Načítám z cloudu…');
      var self = this;
      return api(cfg, '/repos/' + cfg.repo + '/contents/' + encodeURI(cfg.path) +
        '?ref=' + encodeURIComponent(cfg.branch))
        .then(function (r) {
          self.oznam('ok', '');
          return { text: zBase64(r.content), sha: r.sha };
        })
        .catch(function (e) {
          if (e.stav === 404) { self.oznam('ok', ''); return null; }
          self.oznam('chyba', e.message);
          throw e;
        });
    },

    /* uloží text; při rozporu s cloudem vyhodí chybu se stav 409 */
    push: function (text, popis) {
      var cfg = this.config();
      if (!this.zapnuto()) return Promise.resolve(null);
      this.oznam('prace', 'Ukládám do cloudu…');
      var self = this;
      var telo = {
        message: popis || 'Kroniky rodů — záloha světa',
        content: doBase64(text),
        branch: cfg.branch
      };
      if (cfg.sha) telo.sha = cfg.sha;
      return api(cfg, '/repos/' + cfg.repo + '/contents/' + encodeURI(cfg.path),
        { method: 'PUT', body: telo })
        .then(function (r) {
          self.setConfig({ sha: r.content.sha, kdy: Date.now() });
          self.oznam('ok', '');
          return r;
        })
        .catch(function (e) {
          if (e.stav === 409 || e.stav === 422) self.oznam('konflikt', e.message);
          else self.oznam('chyba', e.message);
          throw e;
        });
    },

    /* poslední známé sha z cloudu — podle něj se pozná cizí změna */
    znameSha: function () { return this.config().sha; }
  };

  global.FG = global.FG || {};
  global.FG.Sync = Sync;
})(window);
