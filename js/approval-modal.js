(function () {
  'use strict';

  const U = {
    font: 'system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif',
    overlay: 'rgba(11,15,20,0.88)',
    panel: '#171d26',
    field: '#111820',
    border: 'rgba(255,255,255,0.07)',
    text: '#f1f5f9',
    text2: '#94a3b8',
    textMuted: '#64748b',
    accent: '#85c742',
    radius: '10px',
    shadow: '0 24px 56px rgba(0,0,0,0.5)'
  };

  chrome.runtime.sendMessage({ type: 'GET_APPROVAL_CONTEXT' }, (ctx) => {
    if (!ctx || ctx.place == null) return;
    const placeNum = parseInt(ctx.place, 10);
    if (!placeNum || placeNum < 1 || placeNum > 25) return;

    chrome.runtime.sendMessage({ type: 'APPROVAL_ENSURE_EDITOR_PICKS' });

    const ordinals = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th',
      '11th', '12th', '13th', '14th', '15th', '16th', '17th', '18th', '19th', '20th',
      '21st', '22nd', '23rd', '24th', '25th'];
    const placeText = ordinals[placeNum - 1] || placeNum + 'th';
    let thumbnail = ctx.thumbnail || '';
    if (!thumbnail) {
      const tableImg = document.querySelector('table img[src*="video"], table img[src]');
      if (tableImg && tableImg.src) thumbnail = tableImg.src;
    }
    let username = (ctx.username || '').trim();
    if (!username) {
      const channelName = document.querySelector('a[rel="author"] .channel__name, .channel__name');
      if (channelName) username = (channelName.textContent || channelName.getAttribute('title') || '').trim();
    }

    function sanitizeUsername(s) {
      if (!s || typeof s !== 'string') return s;
      s = s.trim();
      s = s.split(/\s*\{\s*/)[0].trim();
      s = s.split(/\s+\.\w/)[0].trim();
      s = s.split(/\s*\[data-theme\s*=/i)[0].trim();
      s = s.split(/\s*var\s*\(\s*--/i)[0].trim();
      if (/^[.#\[{]/.test(s) || /\}|\{/.test(s) || s.length > 200) return '';
      if (/^[a-z]$/i.test(s) || ['div', 'span', 'a', 'p', 'ul', 'li', 'svg', 'path'].includes(s.toLowerCase())) return '';
      return s.length > 120 ? s.slice(0, 117) + '...' : s;
    }
    username = sanitizeUsername(username);

    let title = (ctx.title || '').trim();
    let verified = !!ctx.verified;
    if (ctx.verified === undefined) verified = !!document.querySelector('.channel__verified');

    function sanitizeTitle(s) {
      if (!s || typeof s !== 'string') return s;
      s = s.replace(/\s+Edit\s*$/i, '').trim();
      s = s.split(/\s*li:not\s*\(/i)[0].trim();
      s = s.split(/\s*\[data-theme\s*=/i)[0].trim();
      s = s.split(/\s*border-color\s*:/i)[0].trim();
      s = s.split(/\s*var\s*\(\s*--/i)[0].trim();
      s = s.split(/\s*\}\s*\.media-/i)[0].trim();
      s = s.split(/\s*stroke\s*:\s*var/i)[0].trim();
      s = s.split(/\s*color\s*:\s*var/i)[0].trim();
      if (s.includes('}') && s.length > 80) s = s.slice(0, s.indexOf('}')).trim();
      return s.length > 500 ? s.slice(0, 497) + '...' : s;
    }
    title = sanitizeTitle(title);
    if (username.length > 500) username = username.slice(0, 497) + '...';

    const overlay = document.createElement('div');
    overlay.id = 'epp-approval-modal';
    overlay.style.cssText =
      'position:fixed;inset:0;z-index:2147483647;background:' +
      U.overlay +
      ';display:flex;align-items:center;justify-content:center;padding:24px;box-sizing:border-box;font-family:' +
      U.font +
      ';';

    const box = document.createElement('div');
    box.style.cssText =
      'background:' +
      U.panel +
      ';color:' +
      U.text +
      ';max-width:500px;width:100%;border-radius:' +
      U.radius +
      ';overflow:hidden;box-shadow:' +
      U.shadow +
      ';display:flex;flex-direction:column;';

    const headerRow = document.createElement('div');
    headerRow.style.cssText =
      'display:flex;align-items:center;gap:14px;padding:18px 22px 14px;border-bottom:1px solid ' + U.border + ';';
    const hBar = document.createElement('div');
    hBar.style.cssText = 'width:4px;height:28px;background:' + U.accent + ';border-radius:2px;flex-shrink:0;';
    const headerText = document.createElement('div');
    const headerKicker = document.createElement('div');
    headerKicker.textContent = 'Editor picks';
    headerKicker.style.cssText =
      'font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:' + U.accent + ';margin-bottom:2px;';
    const headerTitle = document.createElement('div');
    headerTitle.textContent = 'Confirm slot';
    headerTitle.style.cssText = 'font-size:17px;font-weight:600;color:' + U.text + ';letter-spacing:-0.02em;';
    headerText.append(headerKicker, headerTitle);
    headerRow.append(hBar, headerText);
    box.appendChild(headerRow);

    const batchHint = document.createElement('div');
    batchHint.style.cssText =
      'padding:12px 22px;font-size:12px;line-height:1.45;color:' +
      U.text2 +
      ';background:' +
      U.field +
      ';border-bottom:1px solid ' +
      U.border +
      ';';
    batchHint.textContent =
      'Yes saves and opens the next step. No stops the whole run. Closing this tab without Yes also stops the rest.';
    box.appendChild(batchHint);

    const body = document.createElement('div');
    body.style.cssText = 'display:flex;padding:22px;gap:18px;min-height:0;align-items:flex-start;';
    const thumbWrap = document.createElement('div');
    thumbWrap.style.cssText =
      'width:148px;min-width:148px;height:84px;background:' +
      U.field +
      ';border-radius:8px;overflow:hidden;flex-shrink:0;border:1px solid ' +
      U.border +
      ';';
    if (thumbnail) {
      const img = document.createElement('img');
      img.src = thumbnail;
      img.alt = '';
      img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';
      img.onerror = () => { thumbWrap.style.display = 'none'; };
      thumbWrap.appendChild(img);
    }
    body.appendChild(thumbWrap);

    const content = document.createElement('div');
    content.style.cssText = 'flex:1;min-width:0;display:flex;flex-direction:column;gap:14px;';
    if (title) {
      const titleBlock = document.createElement('div');
      titleBlock.style.cssText = 'display:flex;flex-direction:column;gap:4px;';
      const titleLabel = document.createElement('div');
      titleLabel.style.cssText =
        'font-size:11px;font-weight:600;color:' + U.textMuted + ';letter-spacing:0.04em;text-transform:uppercase;';
      titleLabel.textContent = 'Title';
      titleBlock.appendChild(titleLabel);
      const titleEl = document.createElement('div');
      titleEl.style.cssText =
        'font-size:14px;line-height:1.45;color:' +
        U.text +
        ';font-weight:500;word-wrap:break-word;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;';
      titleEl.textContent = title;
      titleBlock.appendChild(titleEl);
      content.appendChild(titleBlock);
    }
    if (username || verified) {
      const channelBlock = document.createElement('div');
      channelBlock.style.cssText = 'display:flex;flex-direction:column;gap:4px;';
      const channelLabel = document.createElement('div');
      channelLabel.style.cssText =
        'font-size:11px;font-weight:600;color:' + U.textMuted + ';letter-spacing:0.04em;text-transform:uppercase;';
      channelLabel.textContent = 'Channel';
      channelBlock.appendChild(channelLabel);
      const byline = document.createElement('div');
      byline.style.cssText = 'display:flex;align-items:center;gap:8px;flex-wrap:wrap;';
      if (username) {
        const userSpan = document.createElement('span');
        userSpan.style.cssText = 'font-size:13px;color:' + U.text + ';font-weight:600;';
        userSpan.textContent = username;
        byline.appendChild(userSpan);
      }
      if (verified) {
        const vb = document.createElement('span');
        vb.style.cssText =
          'display:inline-flex;align-items:center;gap:4px;font-size:12px;font-weight:600;color:' + U.accent + ';';
        vb.innerHTML =
          '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 4L6 11L3 8"/></svg> Verified';
        byline.appendChild(vb);
      }
      channelBlock.appendChild(byline);
      content.appendChild(channelBlock);
    }
    const promptBlock = document.createElement('div');
    promptBlock.style.cssText =
      'display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:14px;color:' +
      U.text2 +
      ';padding-top:12px;border-top:1px solid ' +
      U.border +
      ';';
    promptBlock.appendChild(document.createTextNode('Place in '));
    const placeBadge = document.createElement('span');
    placeBadge.style.cssText =
      'display:inline-block;background:' +
      U.accent +
      ';color:#0f1408;padding:4px 12px;border-radius:6px;font-weight:700;font-size:13px;';
    placeBadge.textContent = placeText;
    promptBlock.appendChild(placeBadge);
    promptBlock.appendChild(document.createTextNode(' slot?'));
    content.appendChild(promptBlock);
    body.appendChild(content);
    box.appendChild(body);

    const footer = document.createElement('div');
    footer.style.cssText =
      'padding:16px 22px;border-top:1px solid ' +
      U.border +
      ';display:flex;justify-content:flex-end;align-items:center;gap:10px;background:rgba(0,0,0,0.12);';

    const noBtn = document.createElement('button');
    noBtn.type = 'button';
    noBtn.textContent = 'No, stop batch';
    noBtn.style.cssText =
      'border:1px solid ' +
      U.border +
      ';border-radius:8px;background:transparent;color:' +
      U.text2 +
      ';cursor:pointer;font-size:14px;font-weight:500;padding:10px 16px;';
    noBtn.addEventListener('mouseenter', () => {
      noBtn.style.background = U.field;
      noBtn.style.color = U.text;
    });
    noBtn.addEventListener('mouseleave', () => {
      noBtn.style.background = 'transparent';
      noBtn.style.color = U.text2;
    });
    noBtn.addEventListener('click', () => {
      if (!window.confirm('Cancel this step and stop the whole batch? No more tabs will open.')) return;
      overlay.remove();
      chrome.runtime.sendMessage({ type: 'APPROVAL_BATCH_CANCEL' });
    });

    const yesBtn = document.createElement('button');
    yesBtn.type = 'button';
    yesBtn.textContent = 'Yes, save';
    yesBtn.style.cssText =
      'border:none;border-radius:8px;background:' +
      U.accent +
      ';color:#0f1408;cursor:pointer;font-size:14px;font-weight:600;padding:10px 22px;';
    yesBtn.addEventListener('mouseenter', () => { yesBtn.style.filter = 'brightness(1.06)'; });
    yesBtn.addEventListener('mouseleave', () => { yesBtn.style.filter = ''; });
    yesBtn.addEventListener('click', () => {
      try {
        const placeStr = String(placeNum);
        const selectors = ['input[name="place"]', 'input[name="position"]', 'input[name="Position"]', 'select[name="place"]', 'select[name="position"]', 'select[name="Position"]', 'input[id="place"]', 'input[id="position"]', 'select[id="place"]', 'select[id="position"]'];
        for (const sel of selectors) {
          const el = document.querySelector(sel);
          if (el) {
            if (el.tagName === 'SELECT') {
              const opt = Array.from(el.options).find(o => o.value === placeStr);
              el.value = opt ? opt.value : placeStr;
            } else el.value = placeStr;
            el.dispatchEvent(new Event('change', { bubbles: true }));
            el.dispatchEvent(new Event('input', { bubbles: true }));
          }
        }
        overlay.remove();
        chrome.runtime.sendMessage({ type: 'APPROVAL_YES_COMPLETE' });
      } catch (_) {
        overlay.remove();
        chrome.runtime.sendMessage({ type: 'CLOSE_THIS_TAB' });
      }
    });

    footer.appendChild(noBtn);
    footer.appendChild(yesBtn);
    box.appendChild(footer);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
  });
})();
