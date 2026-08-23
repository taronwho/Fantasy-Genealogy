# Kroniky rodů

Webová aplikace pro stavbu **celého fantasy světa**: postavy, místa, národy,
události, kalendář a rodokmeny — všechno na jednom místě, provázané a
proklikatelné. Běží celá v prohlížeči, nic se nikam neodesílá.

| Aplikace | Vyexportovaná stránka |
| --- | --- |
| ![Aplikace](docs/ukazka-aplikace.jpg) | ![Export](docs/ukazka-export.jpg) |

## Co aplikace umí

### Svět

- **Jeden záznam, jedno místo.** Postava, místo, národ, událost i volný zápis
  jsou stejný druh záznamu — liší se jen tím, co u nich vyplňujete. Postava v
  rodokmenu a postava v seznamu je jeden a tentýž záznam.
- **Vazby mezi vším.** U postavy se vybírá národ a místo pobytu, u místa
  nadřazené místo (kraj → město → stavba → místnost) a národ, u události místa
  i postavy, kterých se týká. Kliknutím na kterýkoli odkaz se přesunete dál.
- **Odkazy v textu.** Kdekoli v poznámce stačí napsat `[[Jméno]]` a vznikne
  odkaz; když záznam ještě neexistuje, aplikace nabídne jeho založení.
- **Zmíněno v.** Každý záznam ukazuje, odkud všude na něj vede odkaz — takže
  z města vidíte jeho obyvatele, z národa jeho města, z postavy události.
- **Časová osa** událostí seskupená po epochách a **kalendář světa** s měsíci,
  svátky a zvláštnostmi.
- **Hledání napříč světem** (klávesa F) přes jména, přídomky i texty.
- **Na telefonu** je vlevo rozcestník nahrazen spodní lištou s pěti hlavními
  částmi a tlačítkem *Více*; nic se v ní neposouvá do stran. Lišty pokolení
  v rodokmenu se na úzkém displeji překlopí do vodorovných pruhů nad a pod
  strom, takže na karty zbude celá plocha.
- **Víc světů** vedle sebe, záloha a obnova celého světa do souboru JSON.

### Rodokmeny

- **Neomezeně rodů** — pro každou postavu vlastní strom, mezi stromy se
  přepíná v nabídce nahoře.
- **Neomezená hloubka předků i potomků.** Strom se počítá vždy kolem jedné
  „zaměřené" postavy; kterákoli osoba se dá zaměřit a strom se rozvine kolem ní.
- **Volba pokolení.** Vlevo nahoře se nastaví, kolik pokolení předků se
  zobrazí (1–4 nebo vše), vlevo dole totéž pro potomky (děti, vnoučata,
  pravnoučata, vše). Karty osob, jejichž příbuzní jsou právě skryti, mají
  značku `▲ 2` / `▼ 3` — klepnutím na ni se strom rozvine kolem nich.
- **Větvení a proplétání.** Vazby se drží ve *svazcích*, takže jedna osoba může
  být partnerem ve více svazcích a děti mohou být z různých svazků. V každém
  dialogu (`Přidat rodiče`, `Přidat partnera`, `Přidat dítě`) se přepínačem
  *Novou postavu / Ze stromu* volí, jestli zakládáte novou postavu, nebo
  svazkem spojíte dvě, které už ve stromu jsou — tak se propojí i větve
  zakládané odděleně. Totéž svede `Propojit`, opačně pak `Odpojit`.
  Vazba, která by v rodokmenu vytvořila kruh, se odmítne.
- **U každé osoby**: jméno, pohlaví, rok narození a úmrtí (volný text, klidně
  „3. věk, 244") a poznámka.
- **Víc svazků za sebou.** Postava jich může mít libovolně mnoho a všechny jsou
  rovnocenné — každý má vlastní období (od–do), vlastní poznámku a vlastní
  potomky. Partneři stojí v řadě podle toho, kdy svazek začal, děti visí pod
  tím svazkem, ze kterého pocházejí, a roky trvání se píší k jeho značce.
  Klepnutím na kosočtverec mezi kartami se svazek otevře k úpravě nebo
  rozdělení; roky se dají zapsat i rovnou v `Upravit` u osoby.
- **Export obrázku** — A5 nebo A4, 300 DPI, na výšku i na šířku, v provedení
  *Pergamen* nebo *Inkoust*. Orientaci i rozestupy pokolení aplikace volí sama
  tak, aby jména byla co největší; pokud by přesto vyšla drobná, upozorní na to.
- **Zálohy** — všechny rody se dají uložit do jednoho souboru JSON a zase načíst
  (přenos mezi počítači, sdílení se spoluautory).

## Kde aplikace běží

**https://taronwho.github.io/Fantasy-Genealogy/**

Stránku vystavuje workflow `.github/workflows/pages.yml` při každé změně větve
`main`. Kromě aplikace se tam publikuje i verze v jednom souboru:
[kroniky-rodu.html](https://taronwho.github.io/Fantasy-Genealogy/kroniky-rodu.html).

První vystavení vyžaduje jednorázové zapnutí v repozitáři — *Settings → Pages →
Source: **GitHub Actions***. Token, se kterým workflow běží, si Pages zapnout
sám nesmí.

## Spuštění na svém počítači

Stačí otevřít `index.html` v prohlížeči (Chrome, Firefox, Safari, Edge).
Aplikace nepotřebuje žádnou instalaci ani připojení k internetu.

Pro přenášení na flash disku nebo posílání e-mailem se hodí jednosouborová
verze — všechny styly i skripty jsou vložené uvnitř:

```sh
node build.js     # → dist/kroniky-rodu.html
```

Pokud chcete mít jistotu, že prohlížeč povolí ukládání dat, spusťte ji přes
jednoduchý lokální server:

```sh
python3 -m http.server 8000
# a otevřete http://localhost:8000
```

Obsah repozitáře jde také nahrát na GitHub Pages nebo jiný statický hosting —
je to čistě HTML, CSS a JavaScript bez sestavovacího kroku.

## Ovládání

| Akce | Jak |
| --- | --- |
| Nabídka osoby | klepnutí na kartu → kruhová nabídka |
| Zaměřit osobu | dvojklik na kartu nebo `Zaměřit` v nabídce |
| Posun / přiblížení | tažení myší, kolečko, na dotyku dva prsty |
| Zpět na předchozí zaměření | `Backspace` |
| Hledat osobu | `F` |
| Rody a stromy | `T` |
| Obrázek rodokmenu | `E` |
| Celý strom do okna | `0`, na zaměřenou osobu `C` |
| Zpět / znovu | `Ctrl+Z` / `Ctrl+Shift+Z` |
| Upravit vybranou osobu | `Enter` |

Kde se data ukládají: v úložišti prohlížeče (`localStorage`) na tomto počítači.
Před přeinstalací systému nebo při přechodu na jiný počítač si udělejte zálohu
přes **Nastavení → Zálohovat vše (JSON)**.

## Struktura kódu

```
index.html        kostra stránky a lišty
css/styles.css    vzhled (dva motivy: Pergamen, Inkoust)
js/world.js       entity světa, jejich typy, vazby, hledání a zpětné odkazy
js/store.js       světy, rodokmeny, vazby mezi osobami, ukládání, zpět/znovu
js/layout.js      výpočet rozvržení stromu (viditelnost, rozmístění, rozestupy)
js/view.js        vykreslení do SVG, posun, přiblížení, výběr karet
js/ui.js          dialogy, formuláře, kruhová nabídka, správa světů a rodů
js/pages.js       stránky světa: seznamy, detail, časová osa, kalendář
js/export.js      vykreslení stránky kroniky do obrázku (pergamen, rám, strom)
js/files.js       ukládání souborů (odkaz ke stažení, případně hostitel)
js/app.js         propojení všech částí, klávesové zkratky, ukázkový rod
build.js          sestavení jednosouborové verze do dist/
```

Svět je mapa entit `{ id, type, name, … }`; typ určuje, jaká pole se u záznamu
zobrazují a kam smí odkazovat (`World.TYPES`). Přidat další druh záznamu proto
znamená doplnit jeden popis typu — seznam, detail i formulář se z něj poskládají
samy.

Rodokmeny stojí na *svazcích*: osoba (`person`) má jméno a údaje, svazek
(`union`) drží partnery a jejich děti. Rodičovská vazba je odkaz dítěte na
svazek. Díky tomu jde bez problémů podchytit druhá manželství, nevlastní
sourozence i sňatky mezi větvemi téhož rodu.

Rozvržení se počítá ve třech krocích: nejdřív se určí, které osoby jsou při
zvolené hloubce vidět, pak se rekurzivně rozmístí podstromy (s obrysovým
balením, aby se větve nepřekrývaly), a nakonec proběhne kontrola rozestupů
v každém pokolení.
