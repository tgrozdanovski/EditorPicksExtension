chrome.runtime.onInstalled.addListener(() => {});

let approvalTabId = null;
let approvalQueue = [];
let advanceApprovalQueueOnClose = false;

function storeContextForTab(tabId, ctx) {
  if (tabId && ctx && ctx.place != null) chrome.storage.session.set({ ['epp_ctx_' + tabId]: ctx });
}

chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId !== approvalTabId) return;
  const advance = advanceApprovalQueueOnClose;
  advanceApprovalQueueOnClose = false;
  approvalTabId = null;
  chrome.storage.session.remove('epp_ctx_' + tabId);
  if (!advance) {
    approvalQueue = [];
    return;
  }
  if (approvalQueue.length === 0) return;
  const next = approvalQueue.shift();
  chrome.tabs.create({ url: next.url }, (tab) => {
    if (tab && tab.id) {
      approvalTabId = tab.id;
      storeContextForTab(tab.id, { place: next.place, thumbnail: next.thumbnail, username: next.username, title: next.title, verified: next.verified });
    }
  });
});

function startApprovalTabSequence(items) {
  if (!items || items.length === 0) return;
  advanceApprovalQueueOnClose = false;
  approvalQueue = items.slice(1);
  approvalTabId = null;
  const first = items[0];
  setTimeout(() => {
    chrome.tabs.create({ url: first.url }, (tab) => {
      if (tab && tab.id) {
        approvalTabId = tab.id;
        storeContextForTab(tab.id, { place: first.place, thumbnail: first.thumbnail, username: first.username, title: first.title, verified: first.verified });
      }
    });
  }, 80);
}

function extractMediaId(html) {
  const patterns = [/Media\.Edit\.8\.(\d+)/, /Media\.Edit\.\d+\.(\d+)/, /form[\s\S]*?action\s*=\s*["'][^"']*Media\.Edit\.\d+\.(\d+)/i, /action\s*=\s*["'][^"']*Media\.Edit\.\d+\.(\d+)/i];
  for (const re of patterns) {
    const match = html.match(re);
    if (match) return match[1];
  }
  return null;
}

async function fetchVideoIds(urls) {
  const ids = [];
  for (const url of urls) {
    let html = null;
    try {
      const res = await fetch(url, { credentials: 'include', mode: 'cors' });
      html = await res.text();
    } catch (_) {
      try {
        const res = await fetch(url, { credentials: 'omit' });
        html = await res.text();
      } catch (_2) {}
    }
    ids.push(html ? extractMediaId(html) : null);
  }
  return ids;
}

function stripCssFromUsername(s) {
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

function stripCssFromTitle(s) {
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

function extractRumbleVideoId(url) {
  if (!url || typeof url !== 'string') return null;
  const m = url.match(/rumble\.com\/(v[a-z0-9]+)(?:-|$|\?|\/)/i);
  return m ? m[1] : null;
}

function parseVideoPage(html, url) {
  const id = extractMediaId(html);
  let title = '';
  const titleMatch = html.match(/video-header-container__title[\s\S]*?<h1[^>]*>([\s\S]*?)<\s*\/\s*h1\s*>/i) || html.match(/<h1[^>]*class="h1"[^>]*>([\s\S]*?)<\s*\/\s*h1\s*>/i) || html.match(/video-header-container__title[\s\S]*?<h1[^>]*>([\s\S]*?)<form/i) || html.match(/<h1[^>]*class="h1"[^>]*>([\s\S]*?)<form/i);
  if (titleMatch) {
    title = titleMatch[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().replace(/\s+Edit\s*$/i, '');
    const cssStarts = ['li:not', '[data-theme', 'border-color', 'var(--', '}.media-', 'stroke:var', 'color:var'];
    let cut = -1;
    for (const marker of cssStarts) {
      const i = title.indexOf(marker);
      if (i >= 0) cut = cut === -1 ? i : Math.min(cut, i);
    }
    if (cut >= 0) title = title.slice(0, cut).trim();
    title = title.replace(/\s*[\w-]+:\s*not\s*\([^)]*\)\s*\{[\s\S]*$/, '').trim();
    if (title.includes('}') && title.length > 80) title = title.slice(0, title.indexOf('}')).trim();
    if (title.length > 500) title = title.slice(0, 497) + '...';
    title = stripCssFromTitle(title);
  }
  let username = '';
  const channelMatch = html.match(/media-by--a[\s\S]*?media-heading-name[^>]*>\s*([^<]+)/i) || html.match(/media-heading-name-wrapper[\s\S]*?media-heading-name[^>]*>\s*([^<]+)/i) || html.match(/media-heading-channel-wrapper[\s\S]*?media-heading-name[^>]*>\s*([^<]+)/i) || html.match(/media-heading-name[^>]*>\s*([^<]+)</i) || html.match(/channel__name[^>]*>([^<]+)</i) || html.match(/rel=["']author["'][^>]*href=["'][^"']*\/user\/([^"'\s\/?]+)/i) || html.match(/rel=["']author["'][^>]*href=["'][^"']*\/c\/([^"'\s\/?]+)/i) || html.match(/rel=["']author["'][^>]*>[\s\S]*?<[^>]+>([^<]+)</i);
  if (channelMatch) username = stripCssFromUsername(channelMatch[1].replace(/\s+/g, ' ').trim());
  let thumbnail = '';
  const videoPoster = html.match(/<video[^>]*poster=["']([^"']+)["']/i) || html.match(/poster=["']([^"']+)["'][^>]*>/i);
  if (videoPoster) thumbnail = videoPoster[1].trim();
  if (!thumbnail) {
    const ogImage = html.match(/property=["']og:image["'][^>]*content=["']([^"']+)["']/i) || html.match(/content=["']([^"']+)["'][^>]*property=["']og:image["']/i) || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*og:image/i) || html.match(/<meta[^>]*og:image[^>]*content=["']([^"']+)["']/i);
    if (ogImage) thumbnail = ogImage[1].trim();
  }
  if (!thumbnail) {
    const twitterImage = html.match(/name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i) || html.match(/content=["']([^"']+)["'][^>]*name=["']twitter:image["']/i);
    if (twitterImage) thumbnail = twitterImage[1].trim();
  }
  if (thumbnail && !thumbnail.startsWith('http')) {
    try { thumbnail = new URL(thumbnail, url).href; } catch (_) {}
  }
  let userUrl = '';
  const userLink = html.match(/media-by--a[^>]*href=["']([^"']+)["']/i) || html.match(/href=["']([^"']*\/user\/[^"']+)["']/i) || html.match(/href=["']([^"']*\/c\/[^"']+)["']/i);
  if (userLink) {
    const raw = userLink[1];
    userUrl = raw.startsWith('http') ? raw : new URL(raw, url).href;
    if (!username && raw) {
      const slug = raw.match(/\/(?:user|c)\/([^\/\?&#]+)/i);
      if (slug && slug[1]) username = stripCssFromUsername(slug[1]);
    }
  }
  const verified = /media-heading-verified|verification-badge-icon/.test(html);
  return { id, title, username, userUrl, thumbnail, url, verified };
}

async function fetchChannelFromPage(url) {
  try {
    const res = await fetch(url, { credentials: 'omit' });
    const html = await res.text();
    let username = '';
    const nameMatch = html.match(/media-by--a[\s\S]*?media-heading-name[^>]*>\s*([^<]+)/i) || html.match(/media-heading-name-wrapper[\s\S]*?media-heading-name[^>]*>\s*([^<]+)/i) || html.match(/media-heading-channel-wrapper[\s\S]*?media-heading-name[^>]*>\s*([^<]+)/i) || html.match(/media-heading-name[^>]*>\s*([^<]+)</i);
    if (nameMatch) username = stripCssFromUsername(nameMatch[1].replace(/\s+/g, ' ').trim());
    const verified = /media-heading-verified|verification-badge-icon/.test(html);
    let userUrl = '';
    const userLink = html.match(/media-by--a[^>]*href=["']([^"']+)["']/i) || html.match(/href=["']([^"']*\/c\/[^"']+)["']/i) || html.match(/href=["']([^"']*\/user\/[^"']+)["']/i);
    if (userLink) {
      const raw = userLink[1];
      userUrl = raw.startsWith('http') ? raw : new URL(raw, url).href;
      if (!username && raw) {
        const slug = raw.match(/\/(?:user|c)\/([^\/\?&#]+)/i);
        if (slug && slug[1]) username = stripCssFromUsername(slug[1]);
      }
    }
    return { username, userUrl, verified };
  } catch (_) {
    return { username: '', userUrl: '', verified: false };
  }
}

async function fetchVideoByUrlEmbed(url) {
  const videoId = extractRumbleVideoId(url);
  if (!videoId) return null;
  try {
    const channelPromise = fetchChannelFromPage(url).catch(() => ({
      username: '',
      userUrl: '',
      verified: false
    }));
    const res = await fetch(`https://rumble.com/embedJS/u3/?ifr=0&dref=&request=video&ver=2&v=${videoId}`, { credentials: 'omit' });
    const data = JSON.parse(await res.text());
    if (!data) return null;
    const thumbnail = data.i ? String(data.i) : '';
    const title = stripCssFromTitle(data.title ? String(data.title) : '') || 'Untitled';
    const author = data.author || {};
    let username = stripCssFromUsername((author.name && String(author.name).trim()) || '');
    let userUrl = author.url ? String(author.url) : '';
    const id = data.vid != null ? String(data.vid) : null;
    const channel = await channelPromise;
    if (channel.username) username = channel.username;
    if (channel.userUrl) userUrl = channel.userUrl;
    return { url, thumbnail, title, username, userUrl, id, verified: channel.verified };
  } catch (_) {
    return null;
  }
}

function thumbnailToDataUrlViaTab(thumbnailUrl) {
  return new Promise((resolve) => {
    if (!thumbnailUrl || !thumbnailUrl.startsWith('http')) { resolve(thumbnailUrl); return; }
    let openTabId = null;
    const timeout = setTimeout(() => { cleanup(); resolve(thumbnailUrl); }, 8000);
    function cleanup() {
      clearTimeout(timeout);
      chrome.tabs.onUpdated.removeListener(onUpdated);
      chrome.runtime.onMessage.removeListener(onMessage);
      if (openTabId != null) { chrome.tabs.remove(openTabId).catch(() => {}); openTabId = null; }
    }
    function onUpdated(tabId, info) {
      if (tabId !== openTabId || info.status !== 'complete') return;
      chrome.tabs.onUpdated.removeListener(onUpdated);
      chrome.scripting.executeScript({ target: { tabId }, code: "fetch(location.href).then(r=>r.blob()).then(b=>{const r=new FileReader();r.onloadend=()=>chrome.runtime.sendMessage({type:'THUMB_DATA',data:r.result});r.readAsDataURL(b);}).catch(()=>chrome.runtime.sendMessage({type:'THUMB_DATA'}));" });
    }
    function onMessage(msg, sender) {
      if (msg.type !== 'THUMB_DATA' || !sender.tab || sender.tab.id !== openTabId) return;
      cleanup();
      resolve(msg.data || thumbnailUrl);
    }
    chrome.tabs.create({ url: thumbnailUrl, active: false }, (tab) => {
      if (!tab || !tab.id) { resolve(thumbnailUrl); return; }
      openTabId = tab.id;
      chrome.tabs.onUpdated.addListener(onUpdated);
      chrome.runtime.onMessage.addListener(onMessage);
    });
  });
}

async function fetchVideoByUrlFallback(url) {
  let html = null;
  try {
    const res = await fetch(url, { credentials: 'include', mode: 'cors' });
    html = await res.text();
  } catch (_) {
    try {
      const res = await fetch(url, { credentials: 'omit' });
      html = await res.text();
    } catch (_2) {}
  }
  if (!html) return null;
  const data = parseVideoPage(html, url);
  if (!data) return null;
  if (data.thumbnail) data.thumbnail = await thumbnailToDataUrlViaTab(data.thumbnail);
  if (data.verified === undefined) data.verified = false;
  return data;
}

async function fetchVideoByUrl(url) {
  const embedData = await fetchVideoByUrlEmbed(url);
  if (embedData && (embedData.id || embedData.title || embedData.thumbnail)) return embedData;
  return fetchVideoByUrlFallback(url);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'PING') { sendResponse({ status: 'ok' }); return true; }
  if (message.type === 'FETCH_VIDEO_IDS') {
    fetchVideoIds(message.urls || []).then((ids) => sendResponse({ ids })).catch(() => sendResponse({ ids: message.urls ? message.urls.map(() => null) : [] }));
    return true;
  }
  if (message.type === 'FETCH_VIDEO_BY_URL') {
    fetchVideoByUrl(message.url || '').then((data) => sendResponse({ data })).catch(() => sendResponse({ data: null }));
    return true;
  }
  if (message.type === 'OPEN_APPROVAL_TABS') {
    startApprovalTabSequence(message.items || []);
    sendResponse({ ok: true });
    return true;
  }
  if (message.type === 'APPROVAL_ENSURE_EDITOR_PICKS' && sender.tab && sender.tab.id) {
    const tabId = sender.tab.id;
    function ensureEditorPicksInAllFrames() {
      return chrome.scripting.executeScript({
        target: { tabId, allFrames: true },
        func: function ensureEditorPicksChecked() {
          var el = document.getElementById('editorPicks');
          if (!el) return;
          var tag = (el.tagName || '').toLowerCase();
          var type = (el.getAttribute('type') || '').toLowerCase();
          if (tag !== 'input') return;
          if (type !== 'checkbox') return;
          if (el.checked) return;
          el.checked = true;
          try {
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
          } catch (e) {}
        }
      });
    }
    ensureEditorPicksInAllFrames()
      .catch(() => {})
      .then(() => new Promise((r) => setTimeout(r, 180)))
      .then(() => ensureEditorPicksInAllFrames())
      .catch(() => {});
    sendResponse({ ok: true });
    return true;
  }
  if (message.type === 'APPROVAL_YES_COMPLETE' && sender.tab && sender.tab.id) {
    const tabId = sender.tab.id;
    (async () => {
      try {
        await chrome.scripting.executeScript({
          target: { tabId, allFrames: true },
          func: function clickApprovalSaveInFrame() {
            function findSave(root) {
              if (!root || !root.querySelectorAll) return null;
              var sels = [
                'button.submit[name="submit"][value="save"]',
                'button[name="submit"][value="save"]',
                'input.submit[type="submit"][name="submit"][value="save"]',
                'input[type="submit"][name="submit"][value="save"]'
              ];
              for (var i = 0; i < sels.length; i++) {
                var el = root.querySelector(sels[i]);
                if (el) return el;
              }
              var nodes = root.querySelectorAll(
                'button[name="submit"], input[type="submit"][name="submit"]'
              );
              for (var j = 0; j < nodes.length; j++) {
                var n = nodes[j];
                if (String(n.getAttribute('value') || '').toLowerCase() === 'save') return n;
              }
              var subs = root.querySelectorAll('button.submit');
              for (var k = 0; k < subs.length; k++) {
                var b = subs[k];
                if ((b.textContent || '').trim().toLowerCase() === 'save') return b;
              }
              return null;
            }
            var btn = findSave(document);
            if (!btn) return false;
            var form = btn.closest && btn.closest('form');
            try {
              if (form && typeof form.requestSubmit === 'function') {
                form.requestSubmit(btn);
                return true;
              }
            } catch (e) {}
            try {
              btn.click();
            } catch (e2) {}
            return true;
          }
        });
      } catch (_) {}
      await new Promise((r) => setTimeout(r, 450));
      advanceApprovalQueueOnClose = true;
      try {
        await chrome.tabs.remove(tabId);
      } catch (_) {
        advanceApprovalQueueOnClose = false;
      }
      sendResponse({ ok: true });
    })();
    return true;
  }
  if (message.type === 'APPROVAL_BATCH_CANCEL' && sender.tab && sender.tab.id) {
    approvalQueue = [];
    advanceApprovalQueueOnClose = false;
    chrome.tabs.remove(sender.tab.id, () => sendResponse({ ok: true }));
    return true;
  }
  if (message.type === 'CLOSE_THIS_TAB' && sender.tab && sender.tab.id) {
    chrome.tabs.remove(sender.tab.id);
    sendResponse({ ok: true });
    return true;
  }
  if (message.type === 'GET_APPROVAL_CONTEXT' && sender.tab && sender.tab.id) {
    const key = 'epp_ctx_' + sender.tab.id;
    chrome.storage.session.get(key, (data) => {
      const ctx = data[key];
      if (ctx != null) chrome.storage.session.remove(key);
      sendResponse(ctx || null);
    });
    return true;
  }
  return true;
});
