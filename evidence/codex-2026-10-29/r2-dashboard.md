**F39 — [INFERRED] CAN'T-TELL for concurrent renders.**

- [MEASURED] The button changes colour, awaits `exportMix()`, and restores colour; it has no busy guard (`assets/deckwave-dashboard.js:2286–2302`).
- [CAN'T-TELL] The renderer’s current implementation is absent. Duplicate requests do not establish duplicate renders, allocations, or downloads.
- [INFERRED] Falsifier: the renderer rejects or coalesces concurrent requests before allocating another render.
- [INFERRED] No renderer patch or qualifying regression check is justified from this paste. Holding a fake export pending and counting button calls would establish only button reentrancy.
- [INFERRED] Risk of a future button guard: export-request scheduling; no necessary change to the live heard path or detectors.

**F40 — [INFERRED] REAL.**

- [MEASURED] Both curves and the marker divide by `n - 1`; each curve contains only a `moveTo()` when `n === 1` (`assets/deckwave-dashboard.js:793–814`).
- [INFERRED] Falsifier: executing this method with one valid track produces finite coordinates and visible track geometry without the active marker.
- [INFERRED] Fix both the coordinates and the otherwise invisible singleton paths. Display only; no heard-path, threshold, calibration, or detector change.

[INFERRED] Proposed patch:

```diff
--- a/assets/deckwave-dashboard.js
+++ b/assets/deckwave-dashboard.js
@@ -793,11 +793,14 @@
       const n = set.length, pad = 3, eY = v => h - pad - v*(h-pad*2);
+      const xAt = i => n > 1 ? (i/(n-1))*w : w/2;
       const bs = set.map(t => t.bpm), bmin = Math.min(...bs), bmax = Math.max(...bs);
       c.strokeStyle = 'rgba(125,110,176,.45)'; c.lineWidth = 1; c.beginPath();
-      set.forEach((t,i) => { const x = (i/(n-1))*w,
-        y = h-pad-((t.bpm-bmin)/(bmax-bmin||1))*(h-pad*2); i ? c.lineTo(x,y) : c.moveTo(x,y); });
+      set.forEach((t,i) => { const x = xAt(i),
+        y = h-pad-((t.bpm-bmin)/(bmax-bmin||1))*(h-pad*2); i ? c.lineTo(x,y) : c.moveTo(x,y);
+        if (n === 1) { c.moveTo(x-pad,y); c.lineTo(x+pad,y); } });
       c.stroke();
       const gr = c.createLinearGradient(0,0,w,0);
       gr.addColorStop(0, col(70)||T.ac); gr.addColorStop(1, col(56)||T.ac2);
       c.strokeStyle = gr; c.lineWidth = 2; g(c, col(56)||T.ac2, 8); c.beginPath();
-      set.forEach((t,i) => { const x = (i/(n-1))*w, y = eY(t.energy); i ? c.lineTo(x,y) : c.moveTo(x,y); });
+      set.forEach((t,i) => { const x = xAt(i), y = eY(t.energy); i ? c.lineTo(x,y) : c.moveTo(x,y);
+        if (n === 1) { c.moveTo(x-pad,y); c.lineTo(x+pad,y); } });
       c.stroke(); c.shadowBlur = 0;
@@ -809,6 +812,6 @@
       const s = window.DW.state, nm = window.DW.nowMeta;
       const ci = nm ? set.indexOf(nm) : s.idx;
-      if (s.of && ci > -1 && ci < n) { const x = (ci/(n-1))*w, k = col(58)||T.ac2;
+      if (s.of && ci > -1 && ci < n) { const x = xAt(ci), k = col(58)||T.ac2;
         c.strokeStyle = k; c.lineWidth = 2; g(c, k, 12);
         c.beginPath(); c.moveTo(x,0); c.lineTo(x,h); c.stroke(); c.shadowBlur = 0;
         c.fillStyle = k; c.beginPath(); c.arc(x, eY(set[ci].energy), 4, 0, 7); c.fill(); }
```

**F41 — [INFERRED] CAN'T-TELL for interruption causing restart.**

- [MEASURED] With truthy `st.now`, only `suspended` and `running` return early. An `interrupted` fixture reaches the prepared/raw play branches (`assets/deckwave-dashboard.js:1694–1709`).
- [CAN'T-TELL] The current state accessor, pause/play implementations, phone handling, and actual post-call iPhone state are absent.
- [INFERRED] Falsifier: the real interruption never exposes that fixture, or the invoked engine operation preserves the current session.
- [INFERRED] No resume patch or qualifying regression check yet. A fake-state dispatch test would establish dispatch only. Do not broaden the guard to every non-running state without resolving `closed`.
- [INFERRED] Any resume-versus-restart change is **HEARD PATH**. No detector change is required.

**F46 / F55 — [INFERRED] REAL; F55 duplicates F46.**

- [MEASURED] `rebuildViews()` removes the wrapper and recreates it through `select()`, which inserts before `logLine`. Grouping and drawer visibility are applied at transport initialization (`assets/deckwave-dashboard.js:1397,2175–2178,2420–2427,2476–2477`).
- [INFERRED] Saving/importing therefore loses both the wrapper’s section position and its current inline drawer visibility.
- [INFERRED] Falsifier: after either rebuild, the wrapper remains between Look and the next heading; an import completed after closing Settings leaves it hidden.

**F47 — [INFERRED] REAL for action dispatch and repeatability; separate from F46.**

- [MEASURED] Native `change` immediately invokes `onPick`. View actions are options, and the first named view is initially selected. Reset/export do not restore selection; successful save/import rebuild it (`assets/deckwave-dashboard.js:1393,2145–2178`).
- [INFERRED] “Each sticks” remains overstated. Explicit Load and action buttons address both repeat activation and the initially selected view.
- [CAN'T-TELL] The specific Chromium/Windows arrow-key sequence was not observed.
- [INFERRED] Falsifier: the current constructed controls provide repeatable explicit Load/actions without changing the native selection.

[INFERRED] Shared F46/F47 patch: preserve the selector’s position/visibility; make selection passive and actions explicit. Display/settings only, with five additional buttons inside Look; no heard-path or detector change.

```diff
--- a/assets/deckwave-dashboard.js
+++ b/assets/deckwave-dashboard.js
@@ -2145,9 +2145,5 @@
-  let viewSel;
-  const viewItems = () => dash.views.list().map(n => ({ k: n, n }))
-    .concat([{ k: '__save', n: '⭳ save current as…' },
-             { k: '__reset', n: '↺ reset to default' },
-             { k: '__export', n: '⤓ export views' },
-             { k: '__import', n: '⤒ import views' }]);
+  let viewSel, selectedView;
+  const viewItems = () => dash.views.list().map(n => ({ k: n, n }));
   const onView = k => {
     if (k === '__save') { const n = prompt('Name this view:');
       if (n) { dash.views.save(n); log('saved view “' + n + '”'); rebuildViews(); } return; }
@@ -2175,4 +2171,13 @@
-  function rebuildViews() { if (viewSel) viewSel.el.remove();
-    viewSel = select('view', viewItems(), onView, dash.views.list()[0] || 'default', GRP.look); }
+  function rebuildViews() {
+    const names = dash.views.list();
+    if (!names.includes(selectedView)) selectedView = names[0] || 'default';
+    const old = viewSel && viewSel.el;
+    viewSel = select('view', viewItems(), k => { selectedView = k; }, selectedView, GRP.look);
+    if (old) { viewSel.el.style.display = old.style.display; old.replaceWith(viewSel.el); }
+  }
   if (!dash.views.list().length) dash.views.save('default');
   rebuildViews();
+  btn('load view', () => onView(selectedView), false, GRP.look);
+  for (const [k, n] of [['__save', '⭳ save current as…'], ['__reset', '↺ reset to default'],
+                       ['__export', '⤓ export views'], ['__import', '⤒ import views']])
+    btn(n, () => onView(k), false, GRP.look);
```

**F51 — [INFERRED] CAN'T-TELL for the complete after-stop finding.**

- [MEASURED] The header falls back to `set[s.idx]`, uses `s.of` for position, and prints `s.tempo`; the arc similarly falls back to the index and guards with `s.of` (`assets/deckwave-dashboard.js:809–814,838–843`).
- [MEASURED] The comment says stop/kill retain `order`; that is a comment, not the missing engine implementation (`assets/deckwave-dashboard.js:1217–1221`).
- [CAN'T-TELL] The actual stopped state/accessors and intended stopped-header policy remain unavailable.
- [INFERRED] Falsifier: stop clears the relevant state, or these fields intentionally display the retained plan.
- [INFERRED] No policy-dependent patch/check yet. A fabricated stopped fixture cannot establish that the engine produces it.
- [INFERRED] A display-only correction need not touch the heard path. Changing `applyRoute()`’s `state.of` guard changes whether `reorder()` runs and requires **HEARD-PATH** review (`assets/deckwave-dashboard.js:1035–1036`).

**F54 / F57 — [INFERRED] REAL; F57 duplicates F54.**

- [MEASURED] Swap, window selection, and `slots.set()` repaint without applying folds. The fold writer reads the new panel ID (`assets/deckwave-dashboard.js:2527–2533,2590–2591,2626,2777–2785`).
- [INFERRED] The old cell state can survive the switch and swallow the first visible toggle.
- [INFERRED] Falsifier: switching between panels with opposite stored fold states immediately updates the class, glyph, title, accessible label, and `aria-expanded`; the first fold click reverses them.
- [INFERRED] Centralizing at `paint()` covers all three entry points. Display only; it also refreshes folds during subsequent cell rebuilds. No heard-path or detector change.

[INFERRED] Proposed patch:

```diff
--- a/assets/deckwave-dashboard.js
+++ b/assets/deckwave-dashboard.js
@@ -2530,6 +2530,7 @@
       slot.el.querySelector('.swap').focus();
       setTimeout(dash.fit, 40);
     });
+    if (dash.applyFolds) dash.applyFolds();
   }
 
   function help(slot) {
```

**[INFERRED] Regression checks**

[MEASURED] `check-prepared.js` already exposes source extraction, VM execution, `ok`, and `deferred` (`tools/check-prepared.js:3–9,114–124`). [INFERRED] Insert this function before its final async runner, then call it there using the shown invocation. It uses those seams and no new dependencies; run with `node tools/check-prepared.js`. Outcomes below are predictions, not execution results.

```js
async function checksForDashboardFindings() {
  const part = (from, to) => {
    const a = source.indexOf(from), b = source.indexOf(to, a);
    if (a < 0 || b < 0) throw Error('missing source seam: ' + from);
    return source.slice(a, b);
  };
  const event = { stopPropagation() {} };

  /* Small DOM recorder: the extracted controls create their actual nodes
     and handlers. Only panel-menu button markup needs parsing. */
  function node(tag) {
    const e = {
      tag, children: [], dataset: {}, style: { display: '' }, attrs: {},
      className: '', textContent: '', value: '', parentNode: null,
      appendChild(c) { return this.insertBefore(c, null); },
      insertBefore(c, ref) {
        c.remove();
        const i = ref ? this.children.indexOf(ref) : this.children.length;
        if (i < 0) throw Error('missing insertion reference');
        this.children.splice(i, 0, c); c.parentNode = this; return c;
      },
      remove() {
        if (this.parentNode) {
          const p = this.parentNode;
          p.children.splice(p.children.indexOf(this), 1); this.parentNode = null;
        }
      },
      replaceWith(c) { this.parentNode.insertBefore(c, this); this.remove(); },
      replaceChildren(...cs) {
        this.children.slice().forEach(c => c.remove());
        cs.forEach(c => this.appendChild(c));
      },
      setAttribute(k, v) { this.attrs[k] = String(v); },
      getAttribute(k) { return this.attrs[k] ?? null; },
      querySelectorAll(sel) {
        const matches = c => sel[0] === '.'
          ? c.className.split(/\s+/).includes(sel.slice(1)) : c.tag === sel;
        return this.children.flatMap(c =>
          (matches(c) ? [c] : []).concat(c.querySelectorAll(sel)));
      },
      querySelector(sel) { return this.querySelectorAll(sel)[0] || null; },
      click() {}, focus() {}
    };
    e.classList = {
      contains(k) { return e.className.split(/\s+/).includes(k); },
      toggle(k, on) {
        if (on === undefined) on = !this.contains(k);
        const names = e.className.split(/\s+/).filter(x => x && x !== k);
        if (on) names.push(k);
        e.className = names.join(' '); return on;
      },
      remove(k) { this.toggle(k, false); }
    };
    Object.defineProperty(e, 'innerHTML', { set(html) {
      this.replaceChildren();
      for (const m of html.matchAll(/<button\b[^>]*data-k="([^"]+)"/g)) {
        const b = node('button'); b.dataset.k = m[1]; this.appendChild(b);
      }
    } });
    return e;
  }

  /* F40: require stroked geometry, not merely finite moveTo calls. */
  let arcOK = true;
  for (const active of [false, true]) {
    const t = { bpm: 120, energy: .6 }, nums = [], lines = [];
    let pen, path;
    const c = {
      fillRect() {}, fillText() {}, fill() {},
      createLinearGradient() { return { addColorStop() {} }; },
      beginPath() { pen = null; path = []; },
      moveTo(...p) { nums.push(...p); pen = p; },
      lineTo(...p) {
        nums.push(...p); if (pen) path.push([...pen, ...p]); pen = p;
      },
      stroke() { lines.push(...path); },
      arc(...p) { nums.push(...p); }
    };
    const draw = vm.runInNewContext(
      '({' + part('    arc(c, w, h, T) {', '\n  };') + '}).arc',
      { set: [t], window: { DW: {
        state: { idx: 0, of: active ? 1 : 0 }, nowMeta: active ? t : null
      } }, col: () => null, g() {}, css: () => '' });
    draw(c, 200, 100, { bg: '#000', ac: '#fff', ac2: '#f00', dim: '#888' });
    const horizontal = y => lines.some(([x0,y0,x1,y1]) =>
      y0 === y && y1 === y && x0 < x1 && x0 >= 0 && x1 <= 200);
    const marker = lines.some(([x0,y0,x1,y1]) =>
      x0 === 100 && x1 === 100 && y0 === 0 && y1 === 100);
    arcOK = arcOK && nums.every(Number.isFinite)
      && horizontal(97) && horizontal(97 - .6 * 94) && marker === active;
  }
  ok('F40 singleton has finite tempo/energy strokes and a centred active marker',
     arcOK, { arcOK });

  const titles = {
    __save: '⭳ save current as…', __reset: '↺ reset to default',
    __export: '⤓ export views', __import: '⤒ import views'
  };
  function viewsRig() {
    const tp = node('div'), look = node('span'), next = node('span');
    const line = node('span'), document = { body: node('body'), createElement: node };
    look.dataset.grp = 'cfg/look';
    tp.appendChild(look); tp.appendChild(line);
    const counts = { loads: [], exports: 0, resets: 0 }, names = ['default', 'other'];
    const dash = {
      views: {
        list: () => names,
        save(n) { if (!names.includes(n)) names.push(n); },
        load(n) { counts.loads.push(n); return n; },
        export() { counts.exports++; return '{}'; },
        import() { names.push('imported'); return 1; }
      },
      slots: { reset() { counts.resets++; } },
      applyFolds() {}, fit() {},
      reportIssue(e) { throw e; }
    };
    vm.runInNewContext(
      part('  const btn =', '  const sep =')
      + part('  function select(', "  document.addEventListener('click',")
      + part('  let viewSel', '  /* ── recovered from the live build'),
      { document, tp, dash, $: () => line,
        GRP: { look: 'cfg/look', cfg: 'cfg', deck: 'deck' },
        window: { DWPANELS: { defaults: ['spectrum'] } },
        log() {}, prompt: () => 'saved', setTimeout() {},
        Blob: function () {},
        URL: { createObjectURL: () => 'blob:test', revokeObjectURL() {} } });
    tp.insertBefore(next, line); // next section follows all Look controls
    const input = () => tp.querySelector('select');
    const button = text => tp.children.find(e => e.tag === 'button' && e.textContent === text);
    return {
      tp, look, next, document, counts, input, button,
      async act(k) {
        const b = button(titles[k]);
        if (b) await b.onclick(event);
        else { input().value = k; input().onchange(); } // old-source path
      }
    };
  }
  const placed = r => {
    const i = r.tp.children.indexOf(r.input().parentNode);
    return i > r.tp.children.indexOf(r.look) && i < r.tp.children.indexOf(r.next);
  };
  const hasView = (r, name) => r.input().children.some(o => o.value === name);

  const saved = viewsRig();
  await saved.act('__save');
  const saveOK = placed(saved) && hasView(saved, 'saved')
    && saved.input().parentNode.style.display !== 'none';

  const imported = viewsRig();
  await imported.act('__import');
  const picker = imported.document.body.querySelector('input'), gate = deferred();
  picker.files = [{ text: () => gate.promise }];
  const pending = picker.onchange();
  imported.tp.children.filter(e => e.dataset.grp === 'cfg/look')
    .forEach(e => { e.style.display = 'none'; }); // drawer closes during read
  gate.resolve('{}'); await pending;
  const importOK = placed(imported) && hasView(imported, 'imported')
    && imported.input().parentNode.style.display === 'none';
  ok('F46 save/import retain Look placement and current drawer visibility',
     saveOK && importOK, { saveOK, importOK });

  const views = viewsRig();
  const actionsAreButtons = Object.values(titles).every(t => !!views.button(t));
  const noActionOptions = views.input().children.every(o => !titles[o.value]);
  views.input().value = 'default'; views.input().onchange();
  const passive = views.counts.loads.length === 0;
  const load = views.button('load view');
  if (load) { await load.onclick(event); await load.onclick(event); }
  for (const k of ['__export', '__reset']) {
    const b = views.button(titles[k]);
    if (b) { await b.onclick(event); await b.onclick(event); }
  }
  ok('F47 selection is passive; the first view and actions activate repeatedly',
     actionsAreButtons && noActionOptions && passive && !!load
       && views.counts.loads.join(',') === 'default,default'
       && views.counts.exports === 2 && views.counts.resets === 2,
     { actionsAreButtons, noActionOptions, passive, counts: views.counts });

  const foldSource = source.match(/DWDASH\.folds = (function \(dash\) \{[\s\S]*?\n\});/);
  const setter = source.match(/    set\(i, pid\) \{[^\n]+/);
  if (!foldSource || !setter) throw Error('missing folds/set seam');
  let foldsOK = true;
  for (const route of ['swap', 'window', 'set']) for (const folded of [false, true]) {
    const ids = route === 'window' ? ['energy15', 'energy30'] : ['spectrum', 'chroma'];
    const original = JSON.stringify({ [ids[0]]: folded, [ids[1]]: !folded });
    const store = new Map([['dw-folded-v1', original]]);
    const el = node('div'), u = node('u'), swap = node('button');
    swap.className = 'swap'; u.appendChild(swap); el.appendChild(u);
    const slot = {
      panel: ids[0], el, lbl: node('span'), menu: node('span'), pvar: node('select')
    };
    const slots = [slot], dash = { slots: { slots }, fit() {} };
    const P = {
      has: k => ids.includes(k), get: k => ({ label: k }),
      list: () => ids.map(k => ({ k, n: k })),
      variants: () => route === 'window' ? ids.map(k => ({ k, n: k })) : []
    };
    const env = {
      dash, slot, slots, window: { DWPANELS: P }, document: { createElement: node },
      localStorage: {
        getItem: k => store.get(k) || null,
        setItem: (k, v) => store.set(k, String(v))
      },
      save() {}, setTimeout() {}
    };
    dash.applyFolds = vm.runInNewContext('(' + foldSource[1] + ')', env)(dash);
    env.paint = vm.runInNewContext(
      '(' + part('  function paint(slot) {', '\n  function help(slot) {') + ')', env);
    env.paint(slot); dash.applyFolds();

    if (route === 'swap') {
      slot.menu.children.find(b => b.dataset.k === ids[1]).onclick(event);
    } else if (route === 'window') {
      vm.runInNewContext(part('      slot.pvar.onchange =', '\n      slot.ctx ='), env);
      slot.pvar.value = ids[1]; slot.pvar.onchange();
    } else {
      vm.runInNewContext('({' + setter[0] + '}).set', env)(0, ids[1]);
    }
    const b = u.querySelector('.fold');
    const matches = on => slot.panel === ids[1]
      && el.classList.contains('collapsed') === on
      && b.textContent === (on ? '\u25b8' : '\u25be')
      && b.title === (on ? 'expand' : 'collapse')
      && b.getAttribute('aria-label') === (on ? 'Expand ' : 'Collapse ') + ids[1]
      && b.getAttribute('aria-expanded') === String(!on);
    const applied = matches(!folded) && store.get('dw-folded-v1') === original;
    const before = el.classList.contains('collapsed');
    b.onclick(event);
    foldsOK = foldsOK && applied && matches(folded)
      && before !== el.classList.contains('collapsed');
  }
  ok('F54 swap/window/set adopt panel folds immediately; first click reverses them',
     foldsOK, { foldsOK });
}
```

[INFERRED] Add this invocation before the existing summary:

```js
  try { await checksForDashboardFindings(); }
  catch (e) { ok('dashboard findings checks complete', false, e.stack); }
```

[INFERRED] Why these distinguish the current source, and their remaining holes:

| Check | Current-source failure | Wrong fix that could still pass |
|---|---|---|
| F40 | Non-finite coordinates; no singleton curve segments | Transparent strokes: the recorder does not rasterize. A divisor-only fix **fails**. The stopped fixture has `of: 0`, so this does not test F51. |
| F46 | Rebuilt selector follows the next section; delayed import loses hidden state | Damage to unrelated controls outside this isolated fixture |
| F47 | Actions remain native options; no explicit Load/action buttons | CSS making the new buttons unreachable; browser keyboard/focus behavior still needs inspection |
| F54 | New panel inherits the old fold presentation on all three paths | Broken swap focus/menu positioning; those are outside the fold assertions |

**[INFERRED] Existing checks that do not prove the claimed failure is excluded**

- [MEASURED] The arming check compiles source, then compares string positions (`tools/check-prepared.js:142–152`). [INFERRED] It is decoration for “actually arms inside the gesture”: `if (false) PH().armCalls()` before the prepared branch would pass.
- [MEASURED] The pending-play completion assertion explicitly acknowledges that old code reaches the same result (`tools/check-prepared.js:90–95`). [INFERRED] It is a useful control alongside the pending-discard refusal checks, but decoration if presented alone as proof of F49.
- [CAN'T-TELL] `check-panels.js` and `check-reliability.js` implementations were not pasted; their coverage cannot be audited here.

**[INFERRED] Ranked build order:** **1. F46/F55 + F47** shared patch; **2. F54/F57**; **3. F40**. Resolve missing evidence in this order: **F41 → F39 → F51**.