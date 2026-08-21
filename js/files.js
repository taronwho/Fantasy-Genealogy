/* Kroniky rodů — ukládání souborů
 * Aplikace běží ve dvou prostředích: jako obyčejná stránka (uložíme přes
 * odkaz ke stažení) a jako publikovaná stránka na claude.ai, kde stahování
 * zprostředkovává hostitel a divák ho musí potvrdit.
 */
(function (global) {
  'use strict';

  var MESSAGES = {
    declined: null,                    // divák uložení odmítl — mlčíme
    rate_limited: 'Chvilku vyčkejte a zkuste uložit znovu.',
    too_large: 'Soubor je příliš velký. Zkuste menší formát nebo méně pokolení.',
    bad_request: 'Soubor se nepodařilo připravit.',
    rejected_extension: 'Tento typ souboru zde nelze uložit.',
    extension_not_enabled: 'Tento typ souboru zde nelze uložit.'
  };

  function hosted() {
    return !!(global.claude && typeof global.claude.use === 'function');
  }

  function viaLink(filename, blob) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 600);
  }

  var Files = {
    /* data: Blob nebo řetězec */
    save: function (filename, data, mime, onDone) {
      function done(ok) { if (onDone) onDone(ok); }
      function toast(msg, kind) {
        if (global.FG && global.FG.UI) global.FG.UI.toast(msg, kind);
      }

      if (!hosted()) {
        var blob = data instanceof Blob ? data : new Blob([data], { type: mime || 'text/plain' });
        viaLink(filename, blob);
        done(true);
        return;
      }

      global.claude.use('downloads').then(function (downloads) {
        if (!downloads) {
          toast('Tato stránka nemá povolené ukládání souborů.', 'warn');
          done(false);
          return;
        }
        return downloads.save({ filename: filename, data: data }).then(function () {
          done(true);
        }, function (err) {
          var code = (err && err.code) || 'unavailable';
          var msg = MESSAGES.hasOwnProperty(code)
            ? MESSAGES[code]
            : 'Soubor se nepodařilo uložit.';
          if (msg) toast(msg, 'warn');
          done(false);
        });
      }, function () {
        toast('Soubor se nepodařilo uložit.', 'warn');
        done(false);
      });
    },

    hosted: hosted
  };

  global.FG = global.FG || {};
  global.FG.Files = Files;
})(window);
