(function () {
  'use strict';

  if (!window.location.pathname.includes('/editor-picks')) return;

  const PAGE_VIDEOS_MAX = 25;
  const adminBase = window.location.origin + '/admin/Content/Media.Approval.8.';
  const GRID_SEL = '.thumbnail__grid .videostream, .thumbnail__grid .thumbnail__grid--item';

  const UI = {
    font: 'system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif',
    overlay: 'rgba(11,15,20,0.88)',
    panel: '#171d26',
    panel2: '#1e2630',
    field: '#111820',
    border: 'rgba(255,255,255,0.07)',
    text: '#f1f5f9',
    text2: '#94a3b8',
    textMuted: '#64748b',
    accent: '#85c742',
    radius: '10px',
    shadow: '0 24px 56px rgba(0,0,0,0.5)'
  };

  function injectEppUiStyles() {
    if (document.getElementById('epp-ui-styles')) return;
    const s = document.createElement('style');
    s.id = 'epp-ui-styles';
    s.textContent =
      '.epp-inp:focus{outline:none;border-color:rgba(133,199,66,0.45)!important;box-shadow:0 0 0 3px rgba(133,199,66,0.1)}.epp-inp::placeholder{color:#5a6570}';
    document.head.appendChild(s);
  }

  function extractMediaId(html) {
    const patterns = [/Media\.Edit\.8\.(\d+)/, /Media\.Edit\.\d+\.(\d+)/, /form[\s\S]*?action\s*=\s*["'][^"']*Media\.Edit\.\d+\.(\d+)/i, /action\s*=\s*["'][^"']*Media\.Edit\.\d+\.(\d+)/i];
    for (const re of patterns) {
      const match = html.match(re);
      if (match) return match[1];
    }
    return null;
  }

  async function fetchVideoIdsInPage(urls) {
    const ids = [];
    for (const url of urls) {
      try {
        const res = await fetch(url, { credentials: 'include' });
        ids.push(extractMediaId(await res.text()));
      } catch (_) {
        ids.push(null);
      }
    }
    return ids;
  }

  function getVideosFromPage(max) {
    const items = document.querySelectorAll(GRID_SEL);
    const result = [];
    for (const item of items) {
      if (result.length >= max) break;
      const link = item.querySelector('a.videostream__link, a.title__link');
      if (link && link.href) result.push({ url: link.href, item });
    }
    return result;
  }

  function getAdminIdsFromPage(max) {
    const items = document.querySelectorAll(GRID_SEL);
    const ids = [];
    for (const item of items) {
      if (ids.length >= max) break;
      const idLink = item.querySelector('a[data-epp-id]');
      ids.push(idLink ? idLink.getAttribute('data-epp-id') : null);
    }
    return ids;
  }

  function ensureLoadOverlayStyles() {
    if (document.getElementById('epp-load-overlay-styles')) return;
    const s = document.createElement('style');
    s.id = 'epp-load-overlay-styles';
    s.textContent =
      '@keyframes epp-load-spin{to{transform:rotate(360deg)}}@keyframes epp-load-bar{0%{transform:translateX(-100%)}100%{transform:translateX(280%)}}';
    document.head.appendChild(s);
  }

  function showLoadVideosOverlay(videoCount) {
    ensureLoadOverlayStyles();
    injectEppUiStyles();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const root = document.createElement('div');
    root.id = 'epp-load-videos-overlay';
    root.setAttribute('role', 'status');
    root.setAttribute('aria-live', 'polite');
    root.setAttribute('aria-busy', 'true');
    root.style.cssText =
      'position:fixed;inset:0;z-index:2147483646;background:' +
      UI.overlay +
      ';display:flex;align-items:center;justify-content:center;padding:max(20px,4vw);box-sizing:border-box;font-family:' +
      UI.font +
      ';';
    const card = document.createElement('div');
    card.style.cssText =
      'max-width:380px;width:100%;background:' +
      UI.panel +
      ';padding:0;border-radius:' +
      UI.radius +
      ';box-shadow:' +
      UI.shadow +
      ';text-align:left;box-sizing:border-box;overflow:hidden;';
    const top = document.createElement('div');
    top.style.cssText =
      'display:flex;align-items:center;gap:14px;padding:20px 22px 16px;border-bottom:1px solid ' +
      UI.border +
      ';';
    const barAccent = document.createElement('div');
    barAccent.style.cssText = 'width:4px;align-self:stretch;min-height:40px;background:' + UI.accent + ';border-radius:2px;flex-shrink:0;';
    const topText = document.createElement('div');
    const eyebrow = document.createElement('div');
    eyebrow.textContent = 'One moment';
    eyebrow.style.cssText =
      'font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:' + UI.accent + ';margin-bottom:4px;';
    const title = document.createElement('h2');
    title.textContent = 'Loading videos';
    title.style.cssText =
      'margin:0;font-size:18px;font-weight:600;color:' + UI.text + ';line-height:1.25;letter-spacing:-0.02em;';
    topText.append(eyebrow, title);
    top.append(barAccent, topText);
    const mid = document.createElement('div');
    mid.style.cssText = 'padding:20px 22px 22px;';
    const spinRow = document.createElement('div');
    spinRow.style.cssText = 'display:flex;align-items:center;gap:14px;margin-bottom:14px;';
    const spin = document.createElement('div');
    spin.style.cssText =
      'width:36px;height:36px;flex-shrink:0;border:2px solid rgba(255,255,255,0.1);border-top-color:' +
      UI.accent +
      ';border-radius:50%;animation:epp-load-spin 0.7s linear infinite;box-sizing:border-box;';
    const sub = document.createElement('p');
    sub.textContent =
      'Pulling approval IDs for ' + videoCount + ' row' + (videoCount === 1 ? '' : 's') + '. Slow internet = a bit longer.';
    sub.style.cssText =
      'margin:0;font-size:14px;line-height:1.5;color:' + UI.text2 + ';';
    spinRow.append(spin, sub);
    const foot = document.createElement('p');
    foot.textContent = 'Leave this tab open until this finishes.';
    foot.style.cssText =
      'margin:0;font-size:12px;line-height:1.4;color:' + UI.textMuted + ';';
    const bar = document.createElement('div');
    bar.style.cssText =
      'margin-top:18px;height:2px;border-radius:1px;background:rgba(255,255,255,0.06);overflow:hidden;';
    const barInner = document.createElement('div');
    barInner.style.cssText =
      'height:100%;width:38%;background:' +
      UI.accent +
      ';border-radius:1px;animation:epp-load-bar 1.2s ease-in-out infinite;';
    bar.appendChild(barInner);
    mid.append(spinRow, foot, bar);
    card.append(top, mid);
    root.appendChild(card);
    root.dataset.eppPrevOverflow = prevOverflow;
    document.body.appendChild(root);
    return root;
  }

  function setLoadOverlayError(overlay, heading, message) {
    if (!overlay || !overlay.parentNode) return;
    overlay.setAttribute('aria-busy', 'false');
    const card = overlay.querySelector('div');
    if (!card) return;
    card.innerHTML = '';
    card.style.textAlign = 'left';
    const pad = document.createElement('div');
    pad.style.cssText = 'padding:22px 22px 24px;';
    const title = document.createElement('h2');
    title.textContent = heading;
    title.style.cssText =
      'margin:0 0 10px;font-size:17px;font-weight:600;color:' + UI.text + ';line-height:1.3;';
    const sub = document.createElement('p');
    sub.textContent = message;
    sub.style.cssText = 'margin:0;font-size:14px;line-height:1.5;color:' + UI.text2 + ';';
    const hint = document.createElement('p');
    hint.textContent = 'Window closes in a few seconds.';
    hint.style.cssText = 'margin:14px 0 0;font-size:12px;color:' + UI.textMuted + ';';
    pad.append(title, sub, hint);
    card.appendChild(pad);
  }

  function removeLoadVideosOverlay(overlay) {
    if (!overlay || !overlay.parentNode) return;
    document.body.style.overflow = overlay.dataset.eppPrevOverflow || '';
    overlay.remove();
  }

  function clearPreviewSlotNumbers() {
    document.querySelectorAll('[data-epp-preview-slot="1"]').forEach((el) => el.remove());
  }

  function clearEppSlotWraps() {
    document.querySelectorAll('[data-epp-slot-wrap="1"]').forEach((w) => w.remove());
    document.querySelectorAll(GRID_SEL).forEach((item) => {
      delete item.dataset.eppBadge;
    });
  }

  const PREVIEW_SLOT_STYLE =
    'position:absolute;top:8px;left:8px;z-index:2;min-width:24px;height:24px;box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;border-radius:4px;border:2px dashed rgba(133,199,66,0.65);color:#9fd65c;background:rgba(0,0,0,0.4);pointer-events:none;';

  function showPreviewSlotNumbersAll() {
    clearPreviewSlotNumbers();
    const entries = getVideosFromPage(PAGE_VIDEOS_MAX);
    entries.forEach((entry, i) => {
      if (entry.item.querySelector('[data-epp-slot-wrap="1"]')) return;
      entry.item.style.position = 'relative';
      const el = document.createElement('span');
      el.setAttribute('data-epp-preview-slot', '1');
      el.textContent = String(i + 1);
      el.title = 'List row ' + (i + 1) + ' — use the menu to load UIDs for the first N rows';
      el.style.cssText = PREVIEW_SLOT_STYLE;
      entry.item.appendChild(el);
    });
    attachEppGridObserverIfNeeded();
  }

  let eppGridPreviewTimer = null;
  function scheduleShowPreviewSlotNumbersAll() {
    if (eppGridPreviewTimer) clearTimeout(eppGridPreviewTimer);
    eppGridPreviewTimer = setTimeout(() => {
      eppGridPreviewTimer = null;
      if (!document.querySelector('.listing-header--wrapper[data-editor-picks-button="added"]')) return;
      showPreviewSlotNumbersAll();
    }, 280);
  }

  function attachEppGridObserverIfNeeded() {
    const grid = document.querySelector('.thumbnail__grid');
    if (!grid || grid.dataset.eppGridPreviewObs === '1') return;
    grid.dataset.eppGridPreviewObs = '1';
    new MutationObserver(() => scheduleShowPreviewSlotNumbersAll()).observe(grid, {
      childList: true,
      subtree: true
    });
  }

  async function injectBadges(count) {
    const n = Math.max(1, Math.min(PAGE_VIDEOS_MAX, parseInt(count, 10) || 5));
    const entries = getVideosFromPage(n);
    if (!entries.length) return { ok: false, reason: 'no-videos' };
    clearPreviewSlotNumbers();
    clearEppSlotWraps();
    const badgeStyle =
      'position:absolute;top:8px;left:8px;display:flex;align-items:center;gap:6px;z-index:2;pointer-events:auto;';
    const posStyle =
      'background:#85c742;color:#fff;font-size:11px;font-weight:700;min-width:22px;height:22px;border-radius:4px;display:inline-flex;align-items:center;justify-content:center;';
    const idLinkStyle =
      'font-size:10px;font-weight:600;color:#85c742;background:rgba(0,0,0,0.75);padding:3px 6px;border-radius:4px;text-decoration:none;visibility:hidden;position:absolute;width:0;height:0;overflow:hidden;';
    entries.forEach((entry, i) => {
      entry.item.dataset.eppBadge = '1';
      entry.item.style.position = 'relative';
      const wrap = document.createElement('div');
      wrap.setAttribute('data-epp-slot-wrap', '1');
      wrap.style.cssText = badgeStyle;
      const posBadge = document.createElement('span');
      posBadge.className = 'epp-pos-num';
      posBadge.style.cssText = posStyle;
      posBadge.textContent = String(i + 1);
      wrap.appendChild(posBadge);
      entry.item.appendChild(wrap);
    });
    const urls = entries.map((e) => e.url);
    let ids = [];
    try {
      ids = await fetchVideoIdsInPage(urls);
      if (ids.length === 0 || ids.every((id) => id == null)) {
        const res = await chrome.runtime.sendMessage({ type: 'FETCH_VIDEO_IDS', urls });
        if (res && res.ids) ids = res.ids;
      }
    } catch (_) {}
    entries.forEach((entry, i) => {
      const wrap = entry.item.querySelector('[data-epp-slot-wrap="1"]');
      if (!wrap) return;
      const id = ids[i];
      if (id) {
        const idLink = document.createElement('a');
        idLink.href = adminBase + id;
        idLink.target = '_blank';
        idLink.rel = 'noopener';
        idLink.setAttribute('data-epp-id', id);
        idLink.style.cssText = idLinkStyle;
        idLink.textContent = 'ID: ' + id;
        wrap.appendChild(idLink);
      }
    });
    showPreviewSlotNumbersAll();
    return { ok: true };
  }

  function openAddVideoModal(maxPosition) {
    injectEppUiStyles();
    const max = Math.max(1, Math.min(PAGE_VIDEOS_MAX, parseInt(maxPosition, 10) || 1));
    const overlay = document.createElement('div');
    overlay.id = 'editor-picks-add-video-modal';
    overlay.style.cssText =
      'position:fixed;inset:0;z-index:2147483647;background:' +
      UI.overlay +
      ';display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;font-family:' +
      UI.font +
      ';';

    const box = document.createElement('div');
    box.style.cssText =
      'background:' +
      UI.panel +
      ';color:' +
      UI.text +
      ';border-radius:' +
      UI.radius +
      ';width:100%;max-width:420px;box-shadow:' +
      UI.shadow +
      ';overflow:hidden;';

    const header = document.createElement('div');
    header.style.cssText =
      'display:flex;align-items:center;gap:14px;padding:18px 22px;border-bottom:1px solid ' + UI.border + ';';
    const hBar = document.createElement('div');
    hBar.style.cssText = 'width:4px;height:26px;background:' + UI.accent + ';border-radius:2px;flex-shrink:0;';
    const hTitle = document.createElement('div');
    hTitle.textContent = 'Add video';
    hTitle.style.cssText = 'font-size:17px;font-weight:600;color:' + UI.text + ';letter-spacing:-0.02em;';
    header.append(hBar, hTitle);

    const body = document.createElement('div');
    body.style.cssText = 'padding:22px;display:flex;flex-direction:column;gap:16px;';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'epp-inp';
    input.placeholder = 'Paste full Rumble watch URL…';
    input.style.cssText =
      'width:100%;box-sizing:border-box;padding:11px 14px;border-radius:8px;border:1px solid ' +
      UI.border +
      ';background:' +
      UI.field +
      ';color:' +
      UI.text +
      ';font-size:14px;';

    const statusEl = document.createElement('div');
    statusEl.style.cssText =
      'font-size:13px;min-height:20px;line-height:1.45;color:' + UI.text2 + ';';
    statusEl.setAttribute('role', 'status');

    const positionLabel = document.createElement('label');
    positionLabel.style.cssText = 'font-size:13px;font-weight:500;color:' + UI.text2 + ';line-height:1.4;';
    positionLabel.textContent = 'Slot (you loaded ' + max + ' rows — pick 1–' + max + ')';

    const positionSelect = document.createElement('select');
    positionSelect.className = 'epp-inp';
    positionSelect.style.cssText =
      'width:100%;box-sizing:border-box;padding:11px 14px;border-radius:8px;border:1px solid ' +
      UI.border +
      ';background:' +
      UI.field +
      ';color:' +
      UI.text +
      ';font-size:14px;cursor:not-allowed;opacity:0.55;';
    positionSelect.disabled = true;
    const placeholderOpt = document.createElement('option');
    placeholderOpt.value = '';
    placeholderOpt.textContent = 'Confirm URL first…';
    positionSelect.appendChild(placeholderOpt);
    for (let n = 1; n <= max; n++) {
      const opt = document.createElement('option');
      opt.value = n;
      opt.textContent = String(n);
      positionSelect.appendChild(opt);
    }

    const gridReadinessEl = document.createElement('div');
    gridReadinessEl.style.cssText = 'margin-top:2px;';

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.textContent = 'Add';
    addBtn.disabled = true;
    addBtn.title = 'Confirm video URL first';
    addBtn.style.cssText =
      'width:100%;padding:12px 18px;border:none;border-radius:8px;background:#2a3544;color:' +
      UI.textMuted +
      ';cursor:not-allowed;font-size:15px;font-weight:600;margin-top:4px;';

    let resolvedVideo = null;
    let validateTimer = null;
    let validateSeq = 0;

    function setPositionSelectEnabled(on) {
      positionSelect.disabled = !on;
      positionSelect.style.cursor = on ? 'pointer' : 'not-allowed';
      positionSelect.style.opacity = on ? '1' : '0.5';
      if (!on) {
        positionSelect.value = '';
        placeholderOpt.textContent = 'Confirm URL first…';
      } else {
        placeholderOpt.textContent = 'Select position…';
      }
    }

    function precedingSlotsMissingAdminId(position) {
      if (position <= 1) return null;
      const adminIds = getAdminIdsFromPage(position - 1);
      for (let i = 0; i < position - 1; i++) {
        if (!adminIds[i]) {
          return 'Slot ' + (i + 1) + ' has no grid ID badge. Load at least ' + (i + 1) + ' videos from the header so each row shows a badge — otherwise the queue will be wrong.';
        }
      }
      return null;
    }

    function refreshGridReadiness() {
      gridReadinessEl.innerHTML = '';
      const url = (input.value || '').trim();
      const urlOk = resolvedVideo && url === resolvedVideo.url && resolvedVideo.id;
      const pos = positionSelect.value === '' ? 0 : Math.max(1, Math.min(max, parseInt(positionSelect.value, 10) || 0));

      const card = document.createElement('div');
      card.style.cssText =
        'border-radius:8px;border:1px solid ' +
        UI.border +
        ';padding:14px 16px;background:' +
        UI.field +
        ';';

      const head = document.createElement('div');
      head.style.cssText =
        'font-size:11px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;color:' +
        UI.textMuted +
        ';margin-bottom:10px;';
      head.textContent = 'Rows above your slot';

      if (!urlOk) {
        const p = document.createElement('div');
        p.style.cssText = 'font-size:13px;color:' + UI.textMuted + ';line-height:1.45;';
        p.textContent = 'Confirm the video link first; then we check rows above your slot.';
        card.append(head, p);
        gridReadinessEl.appendChild(card);
        return;
      }

      if (!pos) {
        const p = document.createElement('div');
        p.style.cssText = 'font-size:13px;color:' + UI.text2 + ';line-height:1.45;';
        p.textContent = 'Pick a position. Each row above that slot on the left must show a green ID badge.';
        card.append(head, p);
        gridReadinessEl.appendChild(card);
        return;
      }

      if (pos === 1) {
        const row = document.createElement('div');
        row.style.cssText =
          'font-size:14px;font-weight:600;color:' + UI.accent + ';font-feature-settings:"tnum";margin-bottom:6px;';
        row.textContent = '0 / 0 prior rows';
        const sub = document.createElement('div');
        sub.style.cssText = 'font-size:13px;color:' + UI.text2 + ';line-height:1.45;';
        sub.textContent = 'Position 1 — nothing to verify above. All set.';
        card.append(head, row, sub);
        gridReadinessEl.appendChild(card);
        return;
      }

      const needed = pos - 1;
      const adminIds = getAdminIdsFromPage(needed);
      let found = 0;
      const slots = [];
      for (let i = 0; i < needed; i++) {
        const id = adminIds[i];
        if (id) found++;
        slots.push({ n: i + 1, id: id || null });
      }

      const frac = document.createElement('div');
      frac.style.cssText = 'font-size:15px;font-weight:700;margin-bottom:8px;font-feature-settings:"tnum";letter-spacing:-0.02em;' + (found === needed ? 'color:#85c742;' : 'color:#d4a84b;');
      frac.textContent = found + ' / ' + needed + ' prior rows verified';

      const pills = document.createElement('div');
      pills.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;align-items:center;';
      slots.forEach((s) => {
        const pill = document.createElement('span');
        const ok = !!s.id;
        pill.style.cssText =
          'display:inline-flex;align-items:center;justify-content:center;min-width:28px;height:28px;border-radius:6px;font-size:14px;font-weight:700;' +
          (ok ? 'background:rgba(133,199,66,0.14);color:#9fd65c;border:1px solid rgba(133,199,66,0.35);' : 'background:rgba(212,168,75,0.06);color:#9a8a6a;border:1px solid rgba(212,168,75,0.22);');
        pill.textContent = ok ? '✓' : '○';
        pill.title = ok ? 'Row ' + s.n + ' — linked' : 'Row ' + s.n + ' — badge missing; load ' + needed + ' videos on the left';
        pills.appendChild(pill);
      });

      const sub = document.createElement('div');
      sub.style.cssText =
        'font-size:13px;line-height:1.5;padding-top:10px;border-top:1px solid ' +
        UI.border +
        ';margin-top:4px;color:' +
        UI.text2 +
        ';';
      if (found === needed) {
        sub.style.color = '#8ab88a';
        sub.style.fontWeight = '600';
        sub.textContent = 'All set — every prior row is verified. Proceed when ready.';
      } else {
        const missing = slots.filter((x) => !x.id).map((x) => x.n);
        sub.style.color = '#c9a86a';
        sub.textContent =
          'Outstanding: row(s) ' +
          missing.join(', ') +
          '. Load at least ' +
          needed +
          ' videos so each shows a green ID badge on the left.';
      }

      card.append(head, frac, pills, sub);
      gridReadinessEl.appendChild(card);
    }

    function updateAddButtonState() {
      const url = (input.value || '').trim();
      const position = positionSelect.value === '' ? 0 : Math.max(1, Math.min(max, parseInt(positionSelect.value, 10) || 1));
      const urlMatches = resolvedVideo && url === resolvedVideo.url && resolvedVideo.id;
      let reason = '';
      if (!url) reason = 'Paste a Rumble video URL';
      else if (!urlMatches) reason = 'Wait until the video UID is confirmed above';
      else if (!position) reason = 'Choose a position';
      else {
        const slotErr = precedingSlotsMissingAdminId(position);
        if (slotErr) reason = slotErr;
      }
      const canAdd = urlMatches && position >= 1 && !precedingSlotsMissingAdminId(position);
      addBtn.disabled = !canAdd;
      addBtn.title = canAdd ? 'Add at position ' + position : reason;
      addBtn.style.background = canAdd ? UI.accent : '#2a3544';
      addBtn.style.color = canAdd ? '#0f1408' : UI.textMuted;
      addBtn.style.cursor = canAdd ? 'pointer' : 'not-allowed';
      refreshGridReadiness();
    }

    function scheduleValidate() {
      const url = (input.value || '').trim();
      if (validateTimer) clearTimeout(validateTimer);
      resolvedVideo = null;
      setPositionSelectEnabled(false);
      statusEl.textContent = '';
      statusEl.innerHTML = '';
      statusEl.style.color = UI.text2;
      updateAddButtonState();
      if (!url) {
        statusEl.textContent = 'Paste a full Rumble watch URL (e.g. rumble.com/v…).';
        return;
      }
      statusEl.textContent = 'Checking video…';
      const seq = ++validateSeq;
      validateTimer = setTimeout(async () => {
        validateTimer = null;
        try {
          const newRes = await chrome.runtime.sendMessage({ type: 'FETCH_VIDEO_BY_URL', url });
          if (seq !== validateSeq) return;
          const d = newRes?.data;
          if (!d || !d.id) {
            statusEl.style.color = '#e85c5c';
            statusEl.textContent = 'Could not find this video\'s UID. Use a standard Rumble watch link, or try again.';
            setPositionSelectEnabled(false);
            updateAddButtonState();
            return;
          }
          resolvedVideo = {
            id: String(d.id),
            thumbnail: d.thumbnail || '',
            username: d.username || '',
            title: d.title || '',
            verified: !!d.verified,
            url
          };
          statusEl.style.color = UI.text;
          const t = (resolvedVideo.title || 'Untitled').trim();
          const titleShown = t.length > 72 ? t.slice(0, 69) + '…' : t;
          statusEl.innerHTML = '';
          const line1 = document.createElement('div');
          line1.style.cssText = 'font-weight:600;margin-bottom:6px;color:' + UI.text + ';font-size:14px;';
          line1.textContent = 'Found: ' + titleShown;
          const line2 = document.createElement('div');
          line2.style.cssText = 'font-size:13px;color:' + UI.accent + ';font-weight:500;';
          line2.textContent = 'Choose a slot below, then Add.';
          statusEl.append(line1, line2);
          setPositionSelectEnabled(true);
        } catch (_) {
          if (seq !== validateSeq) return;
          statusEl.style.color = '#e85c5c';
          statusEl.textContent = 'Could not reach the server. Try again. Adding is blocked until this succeeds.';
          setPositionSelectEnabled(false);
        }
        updateAddButtonState();
      }, 280);
    }

    input.addEventListener('input', scheduleValidate);
    input.addEventListener('paste', () => { setTimeout(scheduleValidate, 0); });
    positionSelect.addEventListener('change', updateAddButtonState);

    addBtn.addEventListener('click', async () => {
      const url = (input.value || '').trim();
      const position = positionSelect.value === '' ? 0 : Math.max(1, Math.min(max, parseInt(positionSelect.value, 10) || 1));
      if (!resolvedVideo || url !== resolvedVideo.url || !resolvedVideo.id || position < 1) return;
      const slotErr = precedingSlotsMissingAdminId(position);
      if (slotErr) {
        statusEl.style.color = '#e85c5c';
        statusEl.textContent = slotErr;
        updateAddButtonState();
        return;
      }
      const origLabel = addBtn.textContent;
      addBtn.textContent = 'Adding…';
      addBtn.disabled = true;
      const d = resolvedVideo;
      try {
        const existingItems = [];
        if (position > 1) {
          const existingCount = position - 1;
          const entries = getVideosFromPage(existingCount);
          const adminIds = getAdminIdsFromPage(existingCount);
          for (let i = 0; i < existingCount; i++) {
            const adminId = adminIds[i];
            if (!adminId) {
              statusEl.style.color = '#e85c5c';
              statusEl.textContent = 'Slot ' + (i + 1) + ' lost its grid badge. Reload IDs, then try again.';
              addBtn.textContent = origLabel;
              updateAddButtonState();
              return;
            }
            const card = entries[i]?.item;
            let username = '', title = '', thumbnail = '';
            let verified = false;
            if (card) {
              const nameEl = card.querySelector('.channel__name');
              if (nameEl) username = (nameEl.textContent || nameEl.getAttribute('title') || '').trim();
              verified = !!card.querySelector('.channel__verified');
              const titleEl = card.querySelector('.thumbnail__title, h3.thumbnail__title');
              if (titleEl) title = (titleEl.textContent || titleEl.getAttribute('title') || '').trim();
              const thumbImg = card.querySelector('.thumbnail__image');
              if (thumbImg?.src) thumbnail = thumbImg.src;
            }
            existingItems.push({ url: adminBase + adminId, place: i + 1, thumbnail, username, title, verified });
          }
        }
        const newItem = { url: adminBase + d.id, place: position, thumbnail: d.thumbnail || '', username: d.username || '', title: d.title || '', verified: !!d.verified };
        existingItems.reverse();
        chrome.runtime.sendMessage({ type: 'OPEN_APPROVAL_TABS', items: [newItem].concat(existingItems) });
        destroyModal();
        return;
      } catch (_) {
        statusEl.style.color = '#e85c5c';
        statusEl.textContent = 'Something went wrong. Try again.';
      }
      addBtn.textContent = origLabel;
      updateAddButtonState();
    });

    const footer = document.createElement('div');
    footer.style.cssText =
      'padding:14px 22px;border-top:1px solid ' + UI.border + ';display:flex;justify-content:flex-end;align-items:center;background:rgba(0,0,0,0.15);';
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.textContent = 'Close';
    closeBtn.style.cssText =
      'padding:9px 18px;border:1px solid ' +
      UI.border +
      ';border-radius:8px;background:transparent;color:' +
      UI.text2 +
      ';cursor:pointer;font-size:14px;font-weight:500;';
    let gridPoll = null;
    function destroyModal() {
      if (gridPoll) {
        clearInterval(gridPoll);
        gridPoll = null;
      }
      overlay.remove();
    }

    closeBtn.addEventListener('click', () => destroyModal());
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) destroyModal();
    });

    body.append(input, statusEl, positionLabel, positionSelect, gridReadinessEl, addBtn);
    scheduleValidate();
    gridPoll = setInterval(updateAddButtonState, 350);
    box.append(header, body);
    footer.appendChild(closeBtn);
    box.appendChild(footer);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
  }

  function addButton() {
    const wrapper = document.querySelector('.listing-header--wrapper');
    if (!wrapper || wrapper.dataset.editorPicksButton === 'added') return;
    const titleEl = wrapper.querySelector('.listing-header--title h1');
    if (!titleEl || titleEl.textContent.trim() !== 'Editor Picks') return;

    wrapper.dataset.editorPicksButton = 'added';
    injectEppUiStyles();
    wrapper.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:0.65rem;';

    const loadSelect = document.createElement('select');
    loadSelect.style.cssText =
      'padding:8px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:#111820;color:#e2e8f0;font-size:13px;cursor:pointer;min-width:108px;';
    for (let n = 1; n <= PAGE_VIDEOS_MAX; n++) {
      const opt = document.createElement('option');
      opt.value = n;
      opt.textContent = n === 1 ? '1 video' : n + ' videos';
      loadSelect.appendChild(opt);
    }
    loadSelect.value = '5';

    const loadBtn = document.createElement('button');
    loadBtn.type = 'button';
    loadBtn.textContent = 'Load';
    loadBtn.style.cssText =
      'padding:9px 18px;border-radius:8px;border:none;background:#85c742;color:#0f1408;cursor:pointer;font-size:13px;font-weight:600;';
    loadBtn.title =
      'Every list row is already numbered (dashed). Load fetches UIDs for the first N rows you pick here; those turn solid green.';
    loadBtn.addEventListener('click', async () => {
      const count = loadSelect.value;
      const num = Math.max(1, Math.min(PAGE_VIDEOS_MAX, parseInt(count, 10) || 5));
      loadBtn.disabled = loadSelect.disabled = true;
      const overlay = showLoadVideosOverlay(num);
      try {
        const result = await injectBadges(count);
        if (!result.ok && result.reason === 'no-videos') {
          setLoadOverlayError(
            overlay,
            'No videos in view',
            'We could not find enough videos in the grid. Scroll down until the rows you need are visible, then tap Load again.'
          );
          await new Promise((r) => setTimeout(r, 3400));
          return;
        }
        openAddVideoModal(count);
      } catch (_) {
        setLoadOverlayError(
          overlay,
          'Could not finish loading',
          'Check your internet connection, then try Load again. If the problem continues, refresh the page.'
        );
        await new Promise((r) => setTimeout(r, 3200));
      } finally {
        removeLoadVideosOverlay(overlay);
        loadBtn.textContent = 'Load';
        loadBtn.disabled = loadSelect.disabled = false;
      }
    });

    const btnGroup = document.createElement('div');
    btnGroup.style.cssText = 'display:flex;align-items:center;gap:0.5rem;flex-shrink:0;';
    btnGroup.append(loadSelect, loadBtn);
    wrapper.appendChild(btnGroup);
    showPreviewSlotNumbersAll();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addButton);
  else addButton();
  const observer = new MutationObserver(() => {
    addButton();
    if (document.querySelector('.listing-header--wrapper[data-editor-picks-button="added"]')) {
      scheduleShowPreviewSlotNumbersAll();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
