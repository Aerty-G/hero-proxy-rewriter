// ==UserScript==
// @name         Hero Proxy Rewriter + Dashboard Pro
// @namespace    http://tampermonkey.net/
// @version      3.2.0
// @author       AertyGouchin
// @description  Advanced proxy rewriter with custom selectors, private host exclusion, stats, multi-language, AdBlock rules.
// @match        *://*/*
// @run-at       document-start
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

(function () {
  'use strict';

  const STORAGE_KEY = 'hero_proxy_rewriter_global';
  const OVERRIDE_FLAG = '__heroProxyOverrideInstalled_v3';

  // ---------- helpers ----------
  function gmGet(key, defaultVal = null) {
    try { if (typeof GM_getValue === 'function') return GM_getValue(key, defaultVal); } catch (e) {}
    try { const raw = localStorage.getItem(key); return raw !== null ? raw : defaultVal; } catch (e) { return defaultVal; }
  }

  function gmSet(key, value) {
    try { if (typeof GM_setValue === 'function') { GM_setValue(key, value); return; } } catch (e) {}
    try { localStorage.setItem(key, value); } catch (e) {}
  }

  const DEFAULT_SETTINGS = {
    enabled: false,
    proxyBase: '',
    mode: 'img',
    targetType: 'all',
    targets: [],
    adblockRules: '',
    customSelectors: '',
    includeSubdomains: true,
    rewriteSrc: true,
    rewriteSrcset: true,
    rewriteDataSrc: true,
    rewriteBackgroundImage: false,
    liveObserve: true,
    excludeAlreadyProxied: true,
    excludePrivateHosts: true,
    autoScanInterval: 0,
    quality: 80,
    grayscale: false,
    forceFormat: 'original',
    progressiveJpeg: false,
    extraParams: '',
    togglePosition: null,
    showPanel: false,
    language: 'en',
  };

  const state = {
    settings: loadSettings(),
    observer: null,
    intervalId: null,
    ui: null,
    dragStartPos: null,
    dragMoved: false,
    toastTimer: null,
    compiledAdblockRules: null,
    customSelectorEntries: [],   // {selector, attr}
    stats: {
      rewrittenCount: 0,
      lastRewriteTime: null,
      uniqueHosts: new Set()
    }
  };

  function loadSettings() {
    try {
      const raw = gmGet(STORAGE_KEY, null);
      if (!raw) return { ...DEFAULT_SETTINGS };
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_SETTINGS, ...parsed };
    } catch { return { ...DEFAULT_SETTINGS }; }
  }

  function saveSettings() {
    gmSet(STORAGE_KEY, JSON.stringify(state.settings));
  }

  // ---------- Translations (Currently ID & EN) ----------
  const TRANSLATIONS = {
    en: {
      proxyBase: "Proxy Base URL",
      mode: "Mode",
      modeImg: "Images only",
      modeUrl: "Specific URLs",
      modeBoth: "Both",
      targetType: "Target Type",
      targetDomain: "Domain",
      targetKeyword: "Keyword URL",
      targetAll: "All URLs",
      targetAdblock: "AdBlock rules",
      targets: "Targets (one per line)",
      customSelectorsLabel: "Custom Selectors (one per line, format: selector|attr)",
      customSelectorsPlaceholder: ".hero-bg|data-bg\n[data-setBg]\n#preview-img|data-src",
      customSelectorsHelp: "Add custom CSS selectors to rewrite URLs from specific attributes (e.g., data-bg). If no attribute after pipe, uses <code>src</code>.",
      behaviour: "Behaviour",
      enabled: "Active",
      includeSubdomains: "Subdomains",
      rewriteSrc: "src",
      rewriteSrcset: "srcset",
      rewriteDataSrc: "data-src",
      rewriteBg: "bg-img",
      liveObserve: "live observe",
      excludeProxied: "skip proxied",
      excludePrivateHosts: "Exclude local/private IP",
      autoScan: "Auto scan (sec, 0=off)",
      transformation: "Transformation",
      quality: "Quality (0-100)",
      grayscale: "Grayscale",
      progressiveJpeg: "Progressive JPEG",
      outputFormat: "Output Format",
      extraParams: "Extra params (key=value)",
      applyBtn: "💾 Apply",
      scanBtn: "🔍 Scan Now",
      resetBtn: "🔄 Reset",
      rulesTitle: "Use <strong>AdBlock-style rules</strong> (only when Target Type = AdBlock rules).",
      rulesPlaceholder: "||example.com^\n@@||exclude.example.com^\n/image/.*\\.jpg",
      rulesHelp: "One rule per line. Start with <code>@@</code> to exclude. Supports <code>||</code>, <code>^</code>, <code>*</code>, regex (<code>/.../</code>). If no include rules, all URLs proxied except exclusions.",
      applyRulesBtn: "💾 Apply Rules",
      statsTitle: "Statistics",
      totalRewrites: "Total Rewrites",
      lastRewrite: "Last Rewrite",
      uniqueHosts: "Unique Hosts",
      hostList: "Host list",
      resetStatsBtn: "🗑️ Reset Stats",
      helpTitle: "Help",
      helpProxy: "<strong>Proxy Base URL</strong> – Your proxy endpoint.",
      helpMode: "<strong>Mode</strong> – <em>Images only</em>: rewrite image URLs only. <em>Specific URLs</em>: all matching URLs. <em>Both</em>: images + all.",
      helpTarget: "<strong>Target Type</strong> – <em>Domain</em>: match exact/subdomain. <em>Keyword</em>: match keyword in URL. <em>All</em>: ignore targeting. <em>AdBlock rules</em>: use filter syntax.",
      helpPrivate: "<strong>Exclude private/local</strong> – Skip localhost, 127.0.0.1, .local, .test, private IPs. Safe to enable.",
      helpAdblock: "<strong>AdBlock syntax</strong> – <code>||domain.com^</code> (match domain), <code>@@</code> for exception, <code>*</code> wildcard, <code>^</code> separator, <code>/regex/</code>.",
      helpCustomSelectors: "<strong>Custom Selectors</strong> – Define custom CSS selectors to target specific elements/attributes (e.g., <code>.bg-img|data-bg</code>). The attribute after <code>|</code> will be rewritten. Default attribute is <code>src</code>.",
      helpTransform: "<strong>Transformation</strong> – Extra query params sent to proxy (quality, format, etc).",
      helpApply: "Click <strong>Apply</strong> to save and activate.",
      helpRelative: "<strong>Relative URLs</strong> – Automatically resolved to absolute using the page base (including <code>&lt;base&gt;</code> tag).",
      statusText: (enabled, mode, target) => `Status: ${enabled ? 'active' : 'inactive'} • mode=${mode} • target=${target}`,
      toastSaved: "✅ Saved & applied",
      toastScanned: "🔍 Scan complete",
      toastReset: "🔄 Reset to default",
      toastRulesSaved: "📜 Rules saved",
      toastStatsReset: "📊 Stats reset",
      labelLanguage: "Language",
    },
    id: {
      proxyBase: "URL Proxy Dasar",
      mode: "Mode",
      modeImg: "Gambar saja",
      modeUrl: "URL tertentu",
      modeBoth: "Keduanya",
      targetType: "Tipe Target",
      targetDomain: "Domain",
      targetKeyword: "Kata kunci URL",
      targetAll: "Semua URL",
      targetAdblock: "Aturan AdBlock",
      targets: "Target (satu per baris)",
      customSelectorsLabel: "Selector Kustom (satu per baris, format: selector|atribut)",
      customSelectorsPlaceholder: ".hero-bg|data-bg\n[data-setBg]\n#preview-img|data-src",
      customSelectorsHelp: "Tambahkan selector CSS kustom untuk menulis ulang URL dari atribut tertentu (mis., data-bg). Jika tidak ada atribut setelah pipe, gunakan <code>src</code>.",
      behaviour: "Perilaku",
      enabled: "Aktif",
      includeSubdomains: "Subdomain",
      rewriteSrc: "src",
      rewriteSrcset: "srcset",
      rewriteDataSrc: "data-src",
      rewriteBg: "bg-img",
      liveObserve: "pantau live",
      excludeProxied: "lewati proxied",
      excludePrivateHosts: "Kecualikan IP lokal/privat",
      autoScan: "Scan otomatis (detik, 0=mati)",
      transformation: "Transformasi",
      quality: "Kualitas (0-100)",
      grayscale: "Hitam-putih",
      progressiveJpeg: "Progressive JPEG",
      outputFormat: "Format Output",
      extraParams: "Param tambahan (key=value)",
      applyBtn: "💾 Terapkan",
      scanBtn: "🔍 Scan Sekarang",
      resetBtn: "🔄 Reset",
      rulesTitle: "Gunakan <strong>aturan gaya AdBlock</strong> (hanya saat Tipe Target = Aturan AdBlock).",
      rulesPlaceholder: "||contoh.com^\n@@||kecualikan.contoh.com^\n/gambar/.*\\.jpg",
      rulesHelp: "Satu aturan per baris. Awali <code>@@</code> untuk mengecualikan. Mendukung <code>||</code>, <code>^</code>, <code>*</code>, regex (<code>/.../</code>). Jika tidak ada aturan include, semua URL diproxy kecuali yang dikecualikan.",
      applyRulesBtn: "💾 Simpan Aturan",
      statsTitle: "Statistik",
      totalRewrites: "Total Pengalihan",
      lastRewrite: "Terakhir Dialihkan",
      uniqueHosts: "Host Unik",
      hostList: "Daftar host",
      resetStatsBtn: "🗑️ Reset Statistik",
      helpTitle: "Bantuan",
      helpProxy: "<strong>URL Proxy Dasar</strong> – Alamat proxy Anda.",
      helpMode: "<strong>Mode</strong> – <em>Gambar saja</em>: hanya ubah URL gambar. <em>URL tertentu</em>: ubah semua URL yang cocok target. <em>Keduanya</em>: gambar + semua.",
      helpTarget: "<strong>Tipe Target</strong> – <em>Domain</em>: cocokkan hostname/subdomain. <em>Kata kunci</em>: cari kata di URL. <em>Semua</em>: abaikan target. <em>Aturan AdBlock</em>: gunakan sintaks filter.",
      helpPrivate: "<strong>Kecualikan IP lokal/privat</strong> – Lewati localhost, 127.0.0.1, .local, .test, IP privat. Aman diaktifkan.",
      helpAdblock: "<strong>Sintaks AdBlock</strong> – <code>||domain.com^</code> (cocokkan domain), <code>@@</code> untuk pengecualian, <code>*</code> wildcard, <code>^</code> pemisah, <code>/regex/</code>.",
      helpCustomSelectors: "<strong>Selector Kustom</strong> – Tentukan selector CSS untuk menarget elemen/atribut tertentu (mis., <code>.bg-img|data-bg</code>). Atribut setelah <code>|</code> akan ditulis ulang. Atribut default adalah <code>src</code>.",
      helpTransform: "<strong>Transformasi</strong> – Parameter ekstra dikirim ke proxy (kualitas, format, dll).",
      helpApply: "Klik <strong>Terapkan</strong> untuk menyimpan dan mengaktifkan.",
      helpRelative: "<strong>URL Relatif</strong> – Otomatis di-resolve ke absolute menggunakan base halaman (termasuk tag <code>&lt;base&gt;</code>).",
      statusText: (enabled, mode, target) => `Status: ${enabled ? 'aktif' : 'nonaktif'} • mode=${mode} • target=${target}`,
      toastSaved: "✅ Disimpan & diterapkan",
      toastScanned: "🔍 Scan selesai",
      toastReset: "🔄 Direset ke default",
      toastRulesSaved: "📜 Aturan disimpan",
      toastStatsReset: "📊 Statistik direset",
      labelLanguage: "Bahasa",
    }
  };

  function t(key) {
    const lang = state.settings.language || 'en';
    return TRANSLATIONS[lang]?.[key] || TRANSLATIONS['en'][key] || key;
  }

  // ---------- Private host filter ----------
  function isPrivateHost(urlObj) {
    const host = urlObj.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]') return true;
    if (/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.)/.test(host)) return true;
    if (/^fc00:/i.test(host) || /^fd00:/i.test(host) || /^fe80:/i.test(host)) return true;
    if (/\.(local|test|example|invalid|localhost|internal|lan|corp|home)$/i.test(host)) return true;
    return false;
  }

  // ---------- AdBlock rule compiler ----------
  function compileAdblockRules(rulesText) {
    const lines = String(rulesText || '').split('\n').map(s => s.trim()).filter(Boolean);
    const compiled = [];
    for (let line of lines) {
      let exclude = false;
      if (line.startsWith('@@')) { exclude = true; line = line.substring(2).trim(); }
      if (!line) continue;
      let regex = null;
      if (line.startsWith('/') && line.endsWith('/') && line.length > 2) {
        try { regex = new RegExp(line.slice(1, -1), 'i'); } catch (e) { continue; }
      } else {
        const hasDomainAnchor = line.startsWith('||');
        let ruleBody = hasDomainAnchor ? line.substring(2) : line;
        let escaped = ruleBody.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
        escaped = escaped.replace(/\\\*/g, '.*');
        escaped = escaped.replace(/\\\^/g, '(?:[\\/?#]|$)');
        const pattern = hasDomainAnchor ? '^https?://(?:[a-z0-9-]+\\.)*' + escaped : escaped;
        try { regex = new RegExp(pattern, 'i'); } catch (e) { continue; }
      }
      if (regex) compiled.push({ regex, exclude });
    }
    return compiled;
  }

  function matchAdblock(url) {
    if (!state.compiledAdblockRules || state.compiledAdblockRules.length === 0) return false;
    const href = String(url || '');
    for (const rule of state.compiledAdblockRules) {
      if (rule.exclude && rule.regex.test(href)) return false;
    }
    const includeRules = state.compiledAdblockRules.filter(r => !r.exclude);
    if (includeRules.length === 0) return true;
    for (const rule of includeRules) {
      if (rule.regex.test(href)) return true;
    }
    return false;
  }

  // ---------- Custom selector parser ----------
  function parseCustomSelectors(raw) {
    const lines = String(raw || '').split('\n').map(s => s.trim()).filter(Boolean);
    const entries = [];
    for (const line of lines) {
      const pipeIdx = line.lastIndexOf('|');
      let selector, attr;
      if (pipeIdx !== -1) {
        selector = line.substring(0, pipeIdx).trim();
        attr = line.substring(pipeIdx + 1).trim() || 'src';
      } else {
        selector = line.trim();
        attr = 'src';
      }
      if (!selector) continue;
      entries.push({ selector, attr });
    }
    return entries;
  }

  // ---------- Rewrite logic ----------
  function normalizeLines(val) {
    return String(val || '').split('\n').map(s => s.trim()).filter(Boolean);
  }
  function isAbsoluteHttpUrl(val) {
    return /^https?:\/\//i.test(String(val || ''));
  }
  function tryParseUrlAbsolute(val, base) {
    if (!val) return null;
    try {
      const url = new URL(val, base);
      if (url.protocol === 'http:' || url.protocol === 'https:') return url;
    } catch (e) {}
    return null;
  }
  function isAlreadyProxied(url) {
    const base = state.settings.proxyBase || '';
    return !!base && String(url || '').startsWith(base);
  }
  function matchesTarget(urlObj) {
    const { targetType, targets, includeSubdomains } = state.settings;
    if (targetType === 'adblock') return matchAdblock(urlObj.href);
    const list = normalizeLines(targets);
    if (!list.length || targetType === 'all') return true;
    const hostname = urlObj.hostname.toLowerCase();
    const href = urlObj.href.toLowerCase();
    if (targetType === 'domain') {
      return list.some(item => {
        const t = item.toLowerCase();
        return hostname === t || (includeSubdomains && hostname.endsWith('.' + t));
      });
    }
    if (targetType === 'keyword') return list.some(item => href.includes(item.toLowerCase()));
    return true;
  }
  function shouldRewriteUrl(raw, skipProxiedCheck = false, base = null) {
    if (!raw) return false;
    let urlObj = tryParseUrlAbsolute(raw, base || undefined);
    if (!urlObj) {
      base = base || (typeof document !== 'undefined' && document.baseURI) || location.href;
      urlObj = tryParseUrlAbsolute(raw, base);
      if (!urlObj) return false;
    }
    if (state.settings.excludePrivateHosts && isPrivateHost(urlObj)) return false;
    if (!skipProxiedCheck && state.settings.excludeAlreadyProxied && isAlreadyProxied(urlObj.href)) return false;
    return matchesTarget(urlObj);
  }
  function isImageUrl(url) {
    return /\.(png|jpe?g|gif|webp|bmp|svg|avif)(\?|#|$)/i.test(String(url || ''));
  }
  function buildProxyUrl(rawUrl, base = null) {
    let absoluteUrl = rawUrl;
    if (!isAbsoluteHttpUrl(rawUrl)) {
      base = base || (typeof document !== 'undefined' && document.baseURI) || location.href;
      const resolved = tryParseUrlAbsolute(rawUrl, base);
      if (resolved) absoluteUrl = resolved.href;
    }
    const baseProxy = state.settings.proxyBase || '';
    let url = baseProxy + '?url=' + encodeURIComponent(absoluteUrl);
    const params = [];
    const q = state.settings.quality;
    if (q !== undefined && q !== '' && !isNaN(q)) {
      params.push(`quality=${encodeURIComponent(q)}`);
      params.push(`l=${encodeURIComponent(q)}`);
    }
    if (state.settings.grayscale) {
      params.push('grayscale=1');
      params.push('bw=1');
    }
    const fmt = state.settings.forceFormat;
    if (fmt && fmt !== 'original') params.push(`format=${encodeURIComponent(fmt)}`);
    if (state.settings.progressiveJpeg) {
      params.push('progressive=1');
      params.push('jpeg=1');
    }
    const extraLines = normalizeLines(state.settings.extraParams);
    for (const line of extraLines) {
      const eqIdx = line.indexOf('=');
      if (eqIdx === -1) continue;
      const key = line.slice(0, eqIdx).trim();
      const val = line.slice(eqIdx + 1).trim();
      if (key && val) params.push(`${encodeURIComponent(key)}=${encodeURIComponent(val)}`);
    }
    if (params.length) url += '&' + params.join('&');
    recordRewrite(absoluteUrl);
    return url;
  }
  function rewriteSrcset(srcset, base = null) {
    if (!srcset) return srcset;
    base = base || (typeof document !== 'undefined' && document.baseURI) || location.href;
    return srcset.split(',').map(part => {
      const trimmed = part.trim();
      if (!trimmed) return trimmed;
      const pieces = trimmed.split(/\s+/);
      const rawUrl = pieces.shift();
      const desc = pieces.join(' ');
      if (shouldRewriteUrl(rawUrl, true, base)) {
        return [buildProxyUrl(rawUrl, base), desc].filter(Boolean).join(' ');
      }
      return trimmed;
    }).join(', ');
  }

  function recordRewrite(absoluteUrl) {
    try {
      state.stats.rewrittenCount++;
      state.stats.lastRewriteTime = Date.now();
      const u = new URL(absoluteUrl);
      state.stats.uniqueHosts.add(u.hostname);
    } catch (e) {}
  }

  // ---------- Prototype overrides ----------
  function installPrototypeOverrides() {
    if (window[OVERRIDE_FLAG]) return;
    window[OVERRIDE_FLAG] = true;

    function getBaseURI() {
      try { return document.baseURI || location.href; } catch (e) { return location.href; }
    }

    const imgSrcDesc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
    if (imgSrcDesc?.set) {
      Object.defineProperty(HTMLImageElement.prototype, 'src', {
        get: imgSrcDesc.get,
        set: function (value) {
          if (
            state.settings.enabled &&
            state.settings.rewriteSrc &&
            (state.settings.mode === 'img' || state.settings.mode === 'both') &&
            value &&
            !isAlreadyProxied(value) &&
            shouldRewriteUrl(value, true, getBaseURI())
          ) {
            if (state.settings.mode === 'img' && !isImageUrl(value)) {
              imgSrcDesc.set.call(this, value);
              return;
            }
            imgSrcDesc.set.call(this, buildProxyUrl(value, getBaseURI()));
          } else {
            imgSrcDesc.set.call(this, value);
          }
        },
        configurable: true
      });
    }

    if (state.settings.rewriteSrcset) {
      const imgSrcsetDesc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'srcset');
      if (imgSrcsetDesc?.set) {
        Object.defineProperty(HTMLImageElement.prototype, 'srcset', {
          get: imgSrcsetDesc.get,
          set: function (value) {
            if (state.settings.enabled && value) {
              imgSrcsetDesc.set.call(this, rewriteSrcset(value, getBaseURI()));
            } else {
              imgSrcsetDesc.set.call(this, value);
            }
          },
          configurable: true
        });
      }
      const sourceSrcsetDesc = Object.getOwnPropertyDescriptor(HTMLSourceElement.prototype, 'srcset');
      if (sourceSrcsetDesc?.set) {
        Object.defineProperty(HTMLSourceElement.prototype, 'srcset', {
          get: sourceSrcsetDesc.get,
          set: function (value) {
            if (state.settings.enabled && value) {
              sourceSrcsetDesc.set.call(this, rewriteSrcset(value, getBaseURI()));
            } else {
              sourceSrcsetDesc.set.call(this, value);
            }
          },
          configurable: true
        });
      }
    }
  }

  installPrototypeOverrides();

  // ---------- DOM scanning & observer ----------
  function getElementBaseURI(el) {
    return el?.baseURI || (typeof document !== 'undefined' && document.baseURI) || location.href;
  }

  function processAttrUrl(el, attr, base) {
    if (!el.hasAttribute(attr)) return;
    const raw = el.getAttribute(attr);
    if (!raw || !shouldRewriteUrl(raw, false, base)) return;
    const mode = state.settings.mode;
    if (mode === 'img' && !isImageUrl(raw) && attr !== 'srcset') return;
    el.setAttribute(attr, buildProxyUrl(raw, base));
  }

  function processCustomSelectors(el, base) {
    for (const entry of state.customSelectorEntries) {
      try {
        if (el.matches(entry.selector)) {
          processAttrUrl(el, entry.attr, base);
        }
      } catch (e) {
        // selector invalid
      }
    }
  }

  function processElement(el) {
    if (!state.settings.enabled || !el || el.nodeType !== 1) return;
    const mode = state.settings.mode;
    const tag = el.tagName.toLowerCase();
    const base = getElementBaseURI(el);

    if (mode === 'img' || mode === 'both') {
      if (tag === 'img' || tag === 'source' || tag === 'picture' || el.hasAttribute('src') || el.hasAttribute('srcset')) {
        if (state.settings.rewriteSrc) processAttrUrl(el, 'src', base);
        if (state.settings.rewriteDataSrc) {
          processAttrUrl(el, 'data-src', base);
          processAttrUrl(el, 'data-original', base);
        }
        if (state.settings.rewriteSrcset && el.hasAttribute('srcset')) {
          const raw = el.getAttribute('srcset');
          const next = rewriteSrcset(raw, base);
          if (next !== raw) el.setAttribute('srcset', next);
        }
      }
    }
    if (mode === 'url' || mode === 'both') {
      processAttrUrl(el, 'src', base);
      if (state.settings.rewriteBackgroundImage) {
        const style = el.getAttribute('style');
        if (style && /background-image\s*:\s*url\(/i.test(style)) {
          const next = style.replace(/background-image\s*:\s*url\((['"]?)(.*?)\1\)/ig, (m, q, url) => {
            if (!shouldRewriteUrl(url, false, base)) return m;
            return `background-image: url(${q}${buildProxyUrl(url, base)}${q})`;
          });
          if (next !== style) el.setAttribute('style', next);
        }
      }
      if (el.hasAttribute('href')) processAttrUrl(el, 'href', base);
    }

    processCustomSelectors(el, base);
  }

  function scanAll() {
    const standard = document.querySelectorAll('img,source,[src],[srcset],[data-src],[data-original],[style*="background-image"],[href]');
    standard.forEach(processElement);
    if (state.customSelectorEntries.length) {
      try {
        const selectorString = state.customSelectorEntries.map(e => e.selector).join(',');
        if (selectorString) {
          const customElems = document.querySelectorAll(selectorString);
          customElems.forEach(el => processCustomSelectors(el, getElementBaseURI(el)));
        }
      } catch (e) {}
    }
  }

  function startObserver() {
    stopObserver();
    if (!state.settings.liveObserve) return;

    const attrFilter = ['src','srcset','data-src','data-original','style','href'];
    if (state.customSelectorEntries.length) {
      for (const entry of state.customSelectorEntries) {
        if (!attrFilter.includes(entry.attr)) attrFilter.push(entry.attr);
      }
    }

    state.observer = new MutationObserver(mutations => {
      for (const mut of mutations) {
        for (const node of mut.addedNodes) {
          if (node.nodeType !== 1) continue;
          processElement(node);
          node.querySelectorAll?.('img,source,[src],[srcset],[data-src],[data-original],[style*="background-image"],[href]').forEach(processElement);
          if (state.customSelectorEntries.length) {
            try {
              const sel = state.customSelectorEntries.map(e => e.selector).join(',');
              if (sel) {
                node.querySelectorAll?.(sel).forEach(el => processCustomSelectors(el, getElementBaseURI(el)));
              }
            } catch (e) {}
          }
        }
        if (mut.type === 'attributes' && mut.target?.nodeType === 1) {
          processElement(mut.target);
          if (state.customSelectorEntries.some(e => e.attr === mut.attributeName)) {
            processCustomSelectors(mut.target, getElementBaseURI(mut.target));
          }
        }
      }
    });
    state.observer.observe(document.documentElement, {
      subtree: true, childList: true, attributes: true,
      attributeFilter: attrFilter,
    });
  }

  function stopObserver() {
    if (state.observer) { state.observer.disconnect(); state.observer = null; }
  }

  function startAutoScan() {
    stopAutoScan();
    const sec = Number(state.settings.autoScanInterval || 0);
    if (sec > 0) state.intervalId = setInterval(scanAll, sec * 1000);
  }

  function stopAutoScan() {
    if (state.intervalId) { clearInterval(state.intervalId); state.intervalId = null; }
  }

  function applyAll() {
    if (!state.settings.enabled) return;
    if (state.settings.targetType === 'adblock') {
      state.compiledAdblockRules = compileAdblockRules(state.settings.adblockRules);
    } else {
      state.compiledAdblockRules = null;
    }
    state.customSelectorEntries = parseCustomSelectors(state.settings.customSelectors);
    scanAll();
    startObserver();
    startAutoScan();
  }

  function restartEngine() {
    stopObserver();
    stopAutoScan();
    applyAll();
  }

  // ---------- Toast ----------
  function showToast(message, type = 'info') {
    if (window.top !== window.self) return;
    if (state.toastTimer) clearTimeout(state.toastTimer);
    let toast = document.getElementById('hp-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'hp-toast';
      toast.style.cssText = `position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:2147483648;padding:12px 22px;border-radius:12px;font-family:system-ui;font-size:14px;font-weight:500;color:#fff;backdrop-filter:blur(12px);box-shadow:0 8px 32px rgba(0,0,0,.3);max-width:90vw;opacity:0;transition:opacity .3s;pointer-events:none;`;
      document.documentElement.appendChild(toast);
    }
    const colors = { success:'rgba(16,185,129,0.92)', error:'rgba(239,68,68,0.92)', warning:'rgba(245,158,11,0.92)', info:'rgba(59,130,246,0.92)' };
    toast.style.backgroundColor = colors[type] || colors.info;
    toast.textContent = message;
    toast.style.opacity = '1';
    state.toastTimer = setTimeout(() => { toast.style.opacity = '0'; state.toastTimer = null; }, 2200);
  }

  // ---------- UI ----------
  function createUI() {
    if (window.top !== window.self) return;
    if (state.ui) {
      state.ui.rebuildPanel?.();
      return state.ui;
    }

    const BUTTON_SIZE = 48, MARGIN = 14, SNAP_THRESHOLD = 80;

    const toggleContainer = document.createElement('div');
    toggleContainer.id = 'hp-toggle-container';
    toggleContainer.style.cssText = `position:fixed;z-index:2147483647;opacity:0.4;transition:opacity .3s;user-select:none;`;
    const toggleButton = document.createElement('button');
    toggleButton.id = 'hp-toggle-button';
    toggleButton.textContent = '⚙';
    toggleButton.style.cssText = `width:${BUTTON_SIZE}px;height:${BUTTON_SIZE}px;border:0;border-radius:9999px;background:#111827;color:#fff;box-shadow:0 8px 20px rgba(0,0,0,.4);cursor:grab;display:grid;place-items:center;font-size:22px;`;
    toggleContainer.appendChild(toggleButton);
    document.documentElement.appendChild(toggleContainer);

    const overlay = document.createElement('div');
    overlay.id = 'hp-overlay';
    overlay.style.cssText = `position:fixed;inset:0;z-index:2147483646;background:rgba(0,0,0,.15);display:none;`;
    document.documentElement.appendChild(overlay);

    const panelContainer = document.createElement('div');
    panelContainer.id = 'hp-panel-container';
    panelContainer.style.cssText = `position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:2147483647;width:500px;max-width:calc(100vw - 24px);max-height:90vh;background:rgba(17,24,39,.97);border-radius:16px;border:1px solid rgba(255,255,255,.08);box-shadow:0 20px 50px rgba(0,0,0,.6);color:#e5e7eb;font-family:system-ui;display:none;overflow:hidden;flex-direction:column;`;
    panelContainer.style.display = 'none';
    document.documentElement.appendChild(panelContainer);

    function getPanelHTML(lang) {
      const L = TRANSLATIONS[lang] || TRANSLATIONS['en'];
      return `
      <style>
        #hp-panel-container * { box-sizing:border-box; }
        #hp-tab-nav {
          display:flex; border-bottom:1px solid rgba(255,255,255,.1); background:#0b1220;
          padding:0 10px;
        }
        #hp-tab-nav button {
          flex:1; background:transparent; border:none; color:#94a3b8; padding:10px 4px;
          cursor:pointer; font-size:13px; font-weight:500; transition:color .2s, border-bottom .2s;
          border-bottom:2px solid transparent;
        }
        #hp-tab-nav button.active { color:#e2e8f0; border-bottom-color:#2563eb; }
        #hp-tab-content { overflow-y:auto; padding:16px; flex:1; }
        .hp-tab-panel { display:none; }
        .hp-tab-panel.active { display:block; }
        .hp-section { margin-bottom:14px; }
        .hp-section h4 { margin:0 0 6px; font-size:13px; font-weight:600; color:#cbd5e1; }
        .hp-row { margin-bottom:10px; }
        .hp-row label { display:block; font-size:12px; margin-bottom:4px; color:#cbd5e1; }
        .hp-row input, .hp-row select, .hp-row textarea {
          width:100%; background:#0b1220; color:#e5e7eb; border:1px solid rgba(255,255,255,.12);
          border-radius:10px; padding:8px 10px; font-size:13px; outline:none;
        }
        .hp-row textarea { min-height:60px; resize:vertical; }
        .hp-checks {
          display:grid; grid-template-columns:repeat(auto-fill, minmax(140px,1fr)); gap:8px 10px;
          font-size:12px; color:#d1d5db;
        }
        .hp-checks label { display:flex; align-items:center; gap:6px; margin:0; }
        .hp-actions { display:flex; gap:8px; flex-wrap:wrap; margin-top:10px; }
        .hp-actions button {
          border:0; border-radius:10px; padding:8px 14px; font-size:13px; cursor:pointer;
          flex:1 0 auto; min-width:70px;
        }
        .hp-actions .primary { background:#2563eb; color:white; }
        .hp-actions .secondary { background:#374151; color:white; }
        .hp-status { font-size:12px; color:#94a3b8; margin-top:8px; }
        .hp-stats { font-size:13px; }
        .hp-stats ul { list-style:none; padding:0; }
        .hp-stats li { margin-bottom:4px; }
        .hp-help p { font-size:12px; line-height:1.5; margin-bottom:6px; }
        .hp-help code { background:#1e293b; padding:1px 4px; border-radius:4px; font-size:11px; }
        #hp-adblockRules { width:100%; box-sizing:border-box; }
      </style>
      <div id="hp-tab-nav">
        <button data-tab="settings" class="active">⚙️ Settings</button>
        <button data-tab="rules">📜 Rules</button>
        <button data-tab="stats">📊 Stats</button>
        <button data-tab="help">❓ Help</button>
      </div>
      <div id="hp-tab-content">
        <div class="hp-tab-panel active" data-panel="settings">
          <div class="hp-section">
            <h4>🔗 Proxy & Mode</h4>
            <div class="hp-row"><label>${L.proxyBase}</label><input id="hp-proxyBase" placeholder="https://hero.xyz/"></div>
            <div class="hp-row"><label>${L.mode}</label><select id="hp-mode"><option value="img">${L.modeImg}</option><option value="url">${L.modeUrl}</option><option value="both">${L.modeBoth}</option></select></div>
            <div class="hp-row"><label>${L.targetType}</label><select id="hp-targetType"><option value="domain">${L.targetDomain}</option><option value="keyword">${L.targetKeyword}</option><option value="all">${L.targetAll}</option><option value="adblock">${L.targetAdblock}</option></select></div>
            <div class="hp-row" id="hp-targetsRow"><label>${L.targets}</label><textarea id="hp-targets" placeholder="example.com"></textarea></div>
            <div class="hp-row"><label>${L.labelLanguage}</label><select id="hp-language"><option value="en">English</option><option value="id">Bahasa Indonesia</option></select></div>
          </div>
          <div class="hp-section">
            <h4>🎯 ${L.behaviour}</h4>
            <div class="hp-checks">
              <label><input id="hp-enabled" type="checkbox"> ${L.enabled}</label>
              <label><input id="hp-includeSubdomains" type="checkbox"> ${L.includeSubdomains}</label>
              <label><input id="hp-rewriteSrc" type="checkbox"> ${L.rewriteSrc}</label>
              <label><input id="hp-rewriteSrcset" type="checkbox"> ${L.rewriteSrcset}</label>
              <label><input id="hp-rewriteDataSrc" type="checkbox"> ${L.rewriteDataSrc}</label>
              <label><input id="hp-rewriteBg" type="checkbox"> ${L.rewriteBg}</label>
              <label><input id="hp-liveObserve" type="checkbox"> ${L.liveObserve}</label>
              <label><input id="hp-excludeProxied" type="checkbox"> ${L.excludeProxied}</label>
              <label><input id="hp-excludePrivateHosts" type="checkbox"> ${L.excludePrivateHosts}</label>
            </div>
            <div class="hp-row"><label>${L.autoScan}</label><input id="hp-autoScanInterval" type="number" min="0"></div>
            <div class="hp-row">
              <label>${L.customSelectorsLabel} <span style="font-size:10px;color:#94a3b8">(${L.customSelectorsHelp})</span></label>
              <textarea id="hp-customSelectors" placeholder="${L.customSelectorsPlaceholder}"></textarea>
            </div>
          </div>
          <div class="hp-section">
            <h4>🖼️ ${L.transformation}</h4>
            <div class="hp-row"><label>${L.quality}</label><input id="hp-quality" type="number" min="0" max="100"></div>
            <div class="hp-checks">
              <label><input id="hp-grayscale" type="checkbox"> ${L.grayscale}</label>
              <label><input id="hp-progressiveJpeg" type="checkbox"> ${L.progressiveJpeg}</label>
            </div>
            <div class="hp-row"><label>${L.outputFormat}</label><select id="hp-forceFormat"><option value="original">Original</option><option value="jpeg">JPEG</option><option value="png">PNG</option><option value="webp">WebP</option><option value="avif">AVIF</option></select></div>
            <div class="hp-row"><label>${L.extraParams}</label><textarea id="hp-extraParams"></textarea></div>
          </div>
          <div class="hp-actions">
            <button class="primary" id="hp-apply">${L.applyBtn}</button>
            <button class="secondary" id="hp-scan">${L.scanBtn}</button>
            <button class="secondary" id="hp-reset">${L.resetBtn}</button>
          </div>
          <div class="hp-status" id="hp-status"></div>
        </div>
        <div class="hp-tab-panel" data-panel="rules">
          <div class="hp-section">
            <p style="font-size:12px;margin-bottom:8px;">${L.rulesTitle}</p>
            <textarea id="hp-adblockRules" style="min-height:150px;" placeholder="${L.rulesPlaceholder}"></textarea>
            <p style="font-size:11px;color:#94a3b8;margin-top:6px;">${L.rulesHelp}</p>
          </div>
          <div class="hp-actions">
            <button class="primary" id="hp-apply-rules">${L.applyRulesBtn}</button>
          </div>
        </div>
        <div class="hp-tab-panel" data-panel="stats">
          <div class="hp-stats">
            <ul>
              <li>${L.totalRewrites}: <strong id="hp-stat-count">0</strong></li>
              <li>${L.lastRewrite}: <span id="hp-stat-time">-</span></li>
              <li>${L.uniqueHosts}: <strong id="hp-stat-hosts">0</strong></li>
            </ul>
            <details style="margin-top:8px;">
              <summary style="font-size:12px;cursor:pointer;">${L.hostList}</summary>
              <ul id="hp-stat-hostlist" style="font-size:11px;max-height:150px;overflow-y:auto;margin-top:4px;"></ul>
            </details>
            <button class="secondary" id="hp-reset-stats" style="margin-top:8px;">${L.resetStatsBtn}</button>
          </div>
        </div>
        <div class="hp-tab-panel hp-help" data-panel="help">
          <p>${L.helpProxy}</p>
          <p>${L.helpMode}</p>
          <p>${L.helpTarget}</p>
          <p>${L.helpPrivate}</p>
          <p>${L.helpAdblock}</p>
          <p>${L.helpCustomSelectors}</p>
          <p>${L.helpTransform}</p>
          <p>${L.helpApply}</p>
          <p style="margin-top:8px;">${L.helpRelative}</p>
        </div>
      </div>`;
    }

    function rebuildPanel() {
      const lang = state.settings.language || 'en';
      panelContainer.innerHTML = getPanelHTML(lang);
      bindUIEvents();
      if (state.ui?.panelOpen) {
        const activeTab = panelContainer.querySelector('#hp-tab-nav button.active');
        if (activeTab) {
          const target = panelContainer.querySelector(`[data-panel="${activeTab.dataset.tab}"]`);
          if (target) target.classList.add('active');
        }
      }
    }

    const ui = {
      toggleContainer, toggleButton, overlay, panelContainer,
      panelOpen: false,
      refreshUI: null, readUI: null, rebuildPanel
    };

    function bindUIEvents() {
      const tabs = panelContainer.querySelectorAll('#hp-tab-nav button');
      const panels = panelContainer.querySelectorAll('.hp-tab-panel');
      tabs.forEach(btn => {
        btn.addEventListener('click', () => {
          tabs.forEach(b => b.classList.remove('active'));
          panels.forEach(p => p.classList.remove('active'));
          btn.classList.add('active');
          const target = panelContainer.querySelector(`[data-panel="${btn.dataset.tab}"]`);
          if (target) target.classList.add('active');
          if (btn.dataset.tab === 'stats') updateStatsUI();
        });
      });

      function updateStatsUI() {
        document.getElementById('hp-stat-count').textContent = state.stats.rewrittenCount;
        const time = state.stats.lastRewriteTime ? new Date(state.stats.lastRewriteTime).toLocaleTimeString() : '-';
        document.getElementById('hp-stat-time').textContent = time;
        document.getElementById('hp-stat-hosts').textContent = state.stats.uniqueHosts.size;
        const hostList = document.getElementById('hp-stat-hostlist');
        if (hostList) {
          hostList.innerHTML = Array.from(state.stats.uniqueHosts).slice(0, 50).map(h => `<li>${h}</li>`).join('');
        }
      }

      document.getElementById('hp-reset-stats').addEventListener('click', () => {
        state.stats = { rewrittenCount: 0, lastRewriteTime: null, uniqueHosts: new Set() };
        updateStatsUI();
        showToast(t('toastStatsReset'), 'info');
      });

      const targetTypeSelect = panelContainer.querySelector('#hp-targetType');
      const targetsRow = panelContainer.querySelector('#hp-targetsRow');
      function toggleRuleFields() {
        targetsRow.style.display = targetTypeSelect.value === 'adblock' ? 'none' : '';
      }
      targetTypeSelect.addEventListener('change', toggleRuleFields);

      const langSelect = panelContainer.querySelector('#hp-language');
      langSelect.value = state.settings.language || 'en';
      langSelect.addEventListener('change', () => {
        state.settings.language = langSelect.value;
        saveSettings();
        rebuildPanel();
        ui.refreshUI?.();
        showToast(t('toastSaved'), 'success');
      });

      function clampPosition(l, t) {
        const bw = BUTTON_SIZE, m = MARGIN;
        return { left: Math.max(m, Math.min(window.innerWidth - bw - m, l)), top: Math.max(m, Math.min(window.innerHeight - bw - m, t)) };
      }
      function saveTogglePosition() {
        const left = parseFloat(toggleContainer.style.left);
        const top = parseFloat(toggleContainer.style.top);
        state.settings.togglePosition = { left, top };
        saveSettings();
      }
      function snapToNearestCorner(left, top) {
        const bw = BUTTON_SIZE, m = MARGIN;
        const corners = [
          { x: m, y: m }, { x: window.innerWidth - bw - m, y: m },
          { x: m, y: window.innerHeight - bw - m }, { x: window.innerWidth - bw - m, y: window.innerHeight - bw - m }
        ];
        let minDist = Infinity, best = corners[3];
        for (const c of corners) {
          const dx = c.x - left, dy = c.y - top;
          const dist = Math.sqrt(dx*dx+dy*dy);
          if (dist < minDist) { minDist = dist; best = c; }
        }
        if (minDist <= SNAP_THRESHOLD) {
          toggleContainer.style.left = `${best.x}px`;
          toggleContainer.style.top = `${best.y}px`;
        } else {
          const clamped = clampPosition(left, top);
          toggleContainer.style.left = `${clamped.left}px`;
          toggleContainer.style.top = `${clamped.top}px`;
        }
        saveTogglePosition();
      }

      toggleButton.addEventListener('mousedown', (e) => {
        e.preventDefault(); state.dragMoved = false;
        state.dragStartPos = { x: e.clientX, y: e.clientY, left: parseFloat(toggleContainer.style.left), top: parseFloat(toggleContainer.style.top) };
        window.addEventListener('mousemove', onDragMove); window.addEventListener('mouseup', onDragEnd);
      });
      toggleButton.addEventListener('touchstart', (e) => {
        e.preventDefault(); state.dragMoved = false;
        const touch = e.touches[0];
        state.dragStartPos = { x: touch.clientX, y: touch.clientY, left: parseFloat(toggleContainer.style.left), top: parseFloat(toggleContainer.style.top) };
        window.addEventListener('touchmove', onDragMove, { passive: false }); window.addEventListener('touchend', onDragEnd);
      });

      function onDragMove(e) {
        if (!state.dragStartPos) return;
        e.preventDefault();
        const touch = e.touches ? e.touches[0] : e;
        const dx = touch.clientX - state.dragStartPos.x, dy = touch.clientY - state.dragStartPos.y;
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) state.dragMoved = true;
        const clamped = clampPosition(state.dragStartPos.left + dx, state.dragStartPos.top + dy);
        toggleContainer.style.left = `${clamped.left}px`;
        toggleContainer.style.top = `${clamped.top}px`;
      }

      function onDragEnd(e) {
        window.removeEventListener('mousemove', onDragMove); window.removeEventListener('mouseup', onDragEnd);
        window.removeEventListener('touchmove', onDragMove); window.removeEventListener('touchend', onDragEnd);
        if (!state.dragStartPos) return;
        const left = parseFloat(toggleContainer.style.left), top = parseFloat(toggleContainer.style.top);
        snapToNearestCorner(left, top);
        state.dragStartPos = null;
        if (!state.dragMoved) setTimeout(() => { ui.panelOpen ? closePanel() : openPanel(); }, 10);
      }

      toggleContainer.addEventListener('mouseenter', () => { if (!ui.panelOpen) toggleContainer.style.opacity = '1'; });
      toggleContainer.addEventListener('mouseleave', () => { if (!ui.panelOpen) toggleContainer.style.opacity = '0.4'; });

      function openPanel() {
        ui.panelOpen = true;
        panelContainer.style.display = 'flex';
        overlay.style.display = 'block';
        toggleContainer.style.opacity = '1';
        ui.refreshUI?.();
        const activeTab = panelContainer.querySelector('#hp-tab-nav button.active');
        if (activeTab?.dataset.tab === 'stats') updateStatsUI();
      }
      function closePanel() {
        ui.panelOpen = false;
        panelContainer.style.display = 'none';
        overlay.style.display = 'none';
        toggleContainer.style.opacity = '0.4';
      }

      overlay.addEventListener('click', closePanel);
      panelContainer.addEventListener('click', e => e.stopPropagation());

      function refreshUI() {
        const bind = (id, key, type='value') => {
          const el = panelContainer.querySelector(id);
          if (!el) return;
          if (type === 'checked') el.checked = !!state.settings[key];
          else el.value = state.settings[key] ?? '';
        };
        bind('#hp-proxyBase', 'proxyBase');
        bind('#hp-mode', 'mode');
        bind('#hp-targetType', 'targetType');
        bind('#hp-targets', 'targets');
        bind('#hp-adblockRules', 'adblockRules');
        bind('#hp-customSelectors', 'customSelectors');
        bind('#hp-enabled', 'enabled', 'checked');
        bind('#hp-includeSubdomains', 'includeSubdomains', 'checked');
        bind('#hp-rewriteSrc', 'rewriteSrc', 'checked');
        bind('#hp-rewriteSrcset', 'rewriteSrcset', 'checked');
        bind('#hp-rewriteDataSrc', 'rewriteDataSrc', 'checked');
        bind('#hp-rewriteBg', 'rewriteBackgroundImage', 'checked');
        bind('#hp-liveObserve', 'liveObserve', 'checked');
        bind('#hp-excludeProxied', 'excludeAlreadyProxied', 'checked');
        bind('#hp-excludePrivateHosts', 'excludePrivateHosts', 'checked');
        bind('#hp-autoScanInterval', 'autoScanInterval');
        bind('#hp-quality', 'quality');
        bind('#hp-grayscale', 'grayscale', 'checked');
        bind('#hp-progressiveJpeg', 'progressiveJpeg', 'checked');
        bind('#hp-forceFormat', 'forceFormat');
        bind('#hp-extraParams', 'extraParams');
        const langSelect = panelContainer.querySelector('#hp-language');
        if (langSelect) langSelect.value = state.settings.language || 'en';
        const statusEl = panelContainer.querySelector('#hp-status');
        if (statusEl) statusEl.textContent = t('statusText')(state.settings.enabled, state.settings.mode, state.settings.targetType);
        toggleRuleFields();
      }

      function readUI() {
        const s = state.settings;
        s.proxyBase = panelContainer.querySelector('#hp-proxyBase').value.trim();
        s.mode = panelContainer.querySelector('#hp-mode').value;
        s.targetType = panelContainer.querySelector('#hp-targetType').value;
        s.targets = normalizeLines(panelContainer.querySelector('#hp-targets').value);
        s.adblockRules = panelContainer.querySelector('#hp-adblockRules').value;
        s.customSelectors = panelContainer.querySelector('#hp-customSelectors').value;
        s.enabled = panelContainer.querySelector('#hp-enabled').checked;
        s.includeSubdomains = panelContainer.querySelector('#hp-includeSubdomains').checked;
        s.rewriteSrc = panelContainer.querySelector('#hp-rewriteSrc').checked;
        s.rewriteSrcset = panelContainer.querySelector('#hp-rewriteSrcset').checked;
        s.rewriteDataSrc = panelContainer.querySelector('#hp-rewriteDataSrc').checked;
        s.rewriteBackgroundImage = panelContainer.querySelector('#hp-rewriteBg').checked;
        s.liveObserve = panelContainer.querySelector('#hp-liveObserve').checked;
        s.excludeAlreadyProxied = panelContainer.querySelector('#hp-excludeProxied').checked;
        s.excludePrivateHosts = panelContainer.querySelector('#hp-excludePrivateHosts').checked;
        s.autoScanInterval = Number(panelContainer.querySelector('#hp-autoScanInterval').value || 0);
        s.quality = Number(panelContainer.querySelector('#hp-quality').value);
        s.grayscale = panelContainer.querySelector('#hp-grayscale').checked;
        s.progressiveJpeg = panelContainer.querySelector('#hp-progressiveJpeg').checked;
        s.forceFormat = panelContainer.querySelector('#hp-forceFormat').value;
        s.extraParams = panelContainer.querySelector('#hp-extraParams').value;
      }

      ui.refreshUI = refreshUI;
      ui.readUI = readUI;

      panelContainer.querySelector('#hp-apply').addEventListener('click', () => {
        readUI(); saveSettings(); restartEngine(); refreshUI();
        showToast(t('toastSaved'), 'success');
      });
      panelContainer.querySelector('#hp-apply-rules').addEventListener('click', () => {
        state.settings.adblockRules = panelContainer.querySelector('#hp-adblockRules').value;
        saveSettings();
        if (state.settings.targetType === 'adblock') {
          state.compiledAdblockRules = compileAdblockRules(state.settings.adblockRules);
          if (state.settings.enabled) restartEngine();
        }
        refreshUI();
        showToast(t('toastRulesSaved'), 'success');
      });
      panelContainer.querySelector('#hp-scan').addEventListener('click', () => {
        readUI(); saveSettings(); scanAll(); refreshUI();
        showToast(t('toastScanned'), 'info');
      });
      panelContainer.querySelector('#hp-reset').addEventListener('click', () => {
        state.settings = { ...DEFAULT_SETTINGS };
        state.settings.togglePosition = { left: window.innerWidth - BUTTON_SIZE - MARGIN, top: window.innerHeight - BUTTON_SIZE - MARGIN };
        toggleContainer.style.left = `${state.settings.togglePosition.left}px`;
        toggleContainer.style.top = `${state.settings.togglePosition.top}px`;
        saveSettings(); refreshUI(); restartEngine(); closePanel();
        showToast(t('toastReset'), 'warning');
      });

      function applyInitialPosition() {
        let pos = state.settings.togglePosition;
        if (!pos) {
          pos = { left: window.innerWidth - BUTTON_SIZE - MARGIN, top: window.innerHeight - BUTTON_SIZE - MARGIN };
          state.settings.togglePosition = pos; saveSettings();
        }
        const clamped = clampPosition(pos.left, pos.top);
        toggleContainer.style.left = `${clamped.left}px`;
        toggleContainer.style.top = `${clamped.top}px`;
      }
      applyInitialPosition();
      if (state.settings.showPanel) setTimeout(openPanel, 100);
      refreshUI();
    }

    panelContainer.innerHTML = getPanelHTML(state.settings.language || 'en');
    bindUIEvents();

    state.ui = ui;
    return ui;
  }

  // ---------- Boot ----------
  function boot() {
    if (document.documentElement.dataset.heroProxyV320) return;
    document.documentElement.dataset.heroProxyV320 = '1';

    applyAll();

    if (window.top === window.self) {
      createUI();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();