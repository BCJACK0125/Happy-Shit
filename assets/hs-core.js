/* Happy Shit core — storage, formulas, formatting and shared UI.
 * Loaded by index.html and HappyShit.html; exposes window.HS. */
(function (global) {
  'use strict';

  // ---------------------------------------------------------------- keys
  const KEYS = {
    characters: 'happyshit.characters.v1',
    records: 'happyshit.records.v1',
    lastRole: 'happyshit.lastRoleId.v1',
    lastLoc: 'happyshit.lastLoc.v1',
    session: 'happyshit.logSession.v1'
  };

  // Fixed categorical order (validated palette). Color follows the role, never its rank.
  const ROLE_COLORS = ['#1F9A90', '#D9822B', '#6A5ACD', '#D6457A', '#3E8E41', '#2F6FD6', '#B8860B', '#8E4BB0'];

  const AVATARS = [
    '🧑‍💼', '🧑‍🎓', '🏋️', '🧑‍🍳', '🧑‍💻', '🧑‍🚀', '🧑‍🎨', '🏃',
    '🧑‍🌾', '🧑‍🔧', '💩', '🧻', '🐱', '🐶', '🦖', '🐼'
  ];
  // Non-standard ZWJ combos used by early versions render as two glyphs everywhere.
  const AVATAR_FIXES = { '🧑‍🦾': '🏋️', '🧑‍🏃': '🏃' };

  const CURRENCIES = ['NT$', '$', '¥', '€', 'HK$', '₩'];

  // ---------------------------------------------------------------- formulas
  // Kept in one place so the fun maths can be tuned without touching the UI.
  const CALC = {
    PEE_CC_PER_SEC: 20,
    SECONDS_PER_MONTH: 30 * 24 * 60 * 60,
    POOP_LEVELS: [
      { label: '偏少', grams: 150, scale: 0.72 },
      { label: '正常', grams: 225, scale: 0.86 },
      { label: '偏多', grams: 300, scale: 1 },
      { label: '巨量', grams: 350, scale: 1.14 }
    ],
    salaryPerSecond(monthlySalary) {
      const m = Number(monthlySalary) || 0;
      return m / CALC.SECONDS_PER_MONTH;
    },
    peeCc(sec) { return Math.round(Math.max(0, sec) * CALC.PEE_CC_PER_SEC); },
    poopMoney(sec, monthlySalary) { return Math.max(0, sec) * CALC.salaryPerSecond(monthlySalary); }
  };

  // ---------------------------------------------------------------- utils
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  function escapeHtml(s) {
    return String(s ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function uid() {
    try { if (global.crypto?.randomUUID) return global.crypto.randomUUID(); } catch { /* insecure context */ }
    return Math.random().toString(16).slice(2) + '-' + Date.now().toString(16);
  }

  const sum = (arr) => arr.reduce((a, b) => a + b, 0);
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

  function haptic(ms = 12) {
    try { navigator.vibrate?.(ms); } catch { /* unsupported */ }
  }

  // ---------------------------------------------------------------- storage
  function loadJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function saveJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.warn('[HappyShit] save failed', e);
      toast('儲存失敗：瀏覽器儲存空間已滿或被封鎖');
      return false;
    }
  }

  function removeKey(key) {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
  }

  // A coordinate is either a finite number or null. JSON turns NaN into null and
  // Number(null) is 0, so older records without GPS used to land at (0, 0).
  function coord(v) {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function hasLatLng(r) {
    return r && r.lat !== null && r.lng !== null && !(r.lat === 0 && r.lng === 0);
  }

  // ---------------------------------------------------------------- characters
  function nextColor(used) {
    return ROLE_COLORS.find(c => !used.has(c)) || ROLE_COLORS[used.size % ROLE_COLORS.length];
  }

  function getCharacters() {
    let list = loadJson(KEYS.characters, []);
    if (!Array.isArray(list)) list = [];
    list = list.filter(c => c && typeof c.id === 'string' && c.id);

    let changed = false;
    const used = new Set();
    for (const c of list) {
      if (AVATAR_FIXES[c.avatar]) { c.avatar = AVATAR_FIXES[c.avatar]; changed = true; }
      // Past 8 roles colors must repeat; only re-assign duplicates while a free slot exists.
      const dup = used.has(c.color) && used.size < ROLE_COLORS.length;
      if (!ROLE_COLORS.includes(c.color) || dup) {
        c.color = nextColor(used);
        changed = true;
      }
      used.add(c.color);
    }
    if (changed) saveJson(KEYS.characters, list);
    return list;
  }

  function saveCharacters(list) { return saveJson(KEYS.characters, list); }

  function getRole(id) {
    return getCharacters().find(c => c.id === id) || null;
  }

  function ensureSeed() {
    const existing = loadJson(KEYS.characters, null);
    if (Array.isArray(existing) && existing.length) return;
    const now = Date.now();
    saveCharacters([
      { id: '社畜小王', avatar: '🧑‍💼', monthlySalary: 45000, currency: 'NT$', note: '咖啡社畜', color: ROLE_COLORS[0], createdAt: now },
      { id: '健身小美', avatar: '🏋️', monthlySalary: 52000, currency: 'NT$', note: '健身少女', color: ROLE_COLORS[1], createdAt: now },
      { id: '學生阿哲', avatar: '🧑‍🎓', monthlySalary: 12000, currency: 'NT$', note: '被期末追殺', color: ROLE_COLORS[2], createdAt: now }
    ]);
    if (!Array.isArray(loadJson(KEYS.records, null))) saveJson(KEYS.records, []);
    localStorage.setItem(KEYS.lastRole, '社畜小王');
  }

  function getLastRoleId() {
    try { return localStorage.getItem(KEYS.lastRole); } catch { return null; }
  }

  function setLastRoleId(id) {
    try { localStorage.setItem(KEYS.lastRole, id); } catch { /* ignore */ }
  }

  function validateRole(input, { exceptId = null } = {}) {
    const id = String(input.id || '').trim();
    const salary = Number(input.monthlySalary);
    if (!id) return { field: 'id', msg: '幫角色取個名字吧' };
    if (id.length < 2) return { field: 'id', msg: '名字至少要 2 個字' };
    if (id.length > 20) return { field: 'id', msg: '名字最多 20 個字' };
    if (getCharacters().some(c => c.id === id && c.id !== exceptId)) return { field: 'id', msg: '這個名字已經有人用了，換一個' };
    if (!Number.isFinite(salary) || salary <= 0) return { field: 'salary', msg: '月薪要是大於 0 的數字' };
    if (salary > 100000000) return { field: 'salary', msg: '月薪太浮誇了，請輸入合理的數字' };
    return null;
  }

  function createRole(input) {
    const err = validateRole(input);
    if (err) return { error: err };
    const list = getCharacters();
    const role = {
      id: input.id.trim(),
      avatar: input.avatar || AVATARS[0],
      monthlySalary: Number(input.monthlySalary),
      currency: input.currency || 'NT$',
      note: String(input.note || '').trim(),
      color: nextColor(new Set(list.map(c => c.color))),
      createdAt: Date.now()
    };
    list.push(role);
    saveCharacters(list);
    return { role };
  }

  // Renaming cascades to the role's records so history stays attached.
  function updateRole(oldId, input) {
    const err = validateRole(input, { exceptId: oldId });
    if (err) return { error: err };
    const list = getCharacters();
    const idx = list.findIndex(c => c.id === oldId);
    if (idx < 0) return { error: { field: 'id', msg: '找不到這個角色' } };
    const role = {
      ...list[idx],
      id: input.id.trim(),
      avatar: input.avatar || list[idx].avatar,
      monthlySalary: Number(input.monthlySalary),
      currency: input.currency || 'NT$',
      note: String(input.note || '').trim()
    };
    list[idx] = role;
    saveCharacters(list);
    if (role.id !== oldId) {
      saveRecords(getRecords().map(r => (r.characterId === oldId ? { ...r, characterId: role.id } : r)));
      if (getLastRoleId() === oldId) setLastRoleId(role.id);
    }
    return { role };
  }

  function deleteRole(id) {
    const list = getCharacters();
    const remaining = list.filter(c => c.id !== id);
    if (!remaining.length) return false;
    saveCharacters(remaining);
    saveRecords(getRecords().filter(r => r.characterId !== id));
    if (getLastRoleId() === id) setLastRoleId(remaining[0].id);
    return true;
  }

  // ---------------------------------------------------------------- records
  function getRecords() {
    const raw = loadJson(KEYS.records, []);
    if (!Array.isArray(raw)) return [];
    let changed = false;
    const out = [];
    for (const r of raw) {
      if (!r || typeof r !== 'object') { changed = true; continue; }
      const n = { ...r };
      if (!n.recordId) { n.recordId = uid(); changed = true; }
      if (!Number.isFinite(Number(n.timestamp))) { n.timestamp = Date.now(); changed = true; }
      const lat = coord(n.lat), lng = coord(n.lng);
      if (lat !== n.lat || lng !== n.lng) changed = true;
      n.lat = lat; n.lng = lng;
      if (n.lat === 0 && n.lng === 0) { n.lat = null; n.lng = null; changed = true; }
      out.push(n);
    }
    if (changed) saveJson(KEYS.records, out);
    return out;
  }

  function saveRecords(list) { return saveJson(KEYS.records, list); }

  function addRecord(rec) {
    const all = getRecords();
    all.push({ recordId: uid(), ...rec });
    return saveRecords(all);
  }

  function deleteRecord(recordId) {
    return saveRecords(getRecords().filter(r => r.recordId !== recordId));
  }

  function recordsOf(roleId, all = getRecords()) {
    return all.filter(r => r.characterId === roleId);
  }

  // ---------------------------------------------------------------- formatting
  const pad2 = (n) => String(n).padStart(2, '0');

  function money(currency, amount, digits = 0) {
    const n = Number(amount);
    const v = Number.isFinite(n) ? n : 0;
    return `${currency || 'NT$'} ${v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
  }

  function int(n) { return Math.round(Number(n) || 0).toLocaleString('en-US'); }

  function clock(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return h ? `${h}:${pad2(m)}:${pad2(s % 60)}` : `${pad2(m)}:${pad2(s % 60)}`;
  }

  function duration(sec) {
    sec = Math.round(sec);
    if (sec < 60) return `${sec} 秒`;
    const m = Math.floor(sec / 60), s = sec % 60;
    if (m < 60) return s ? `${m} 分 ${s} 秒` : `${m} 分鐘`;
    const h = Math.floor(m / 60);
    return `${h} 小時 ${m % 60} 分`;
  }

  function dateTime(ts) {
    const d = new Date(ts);
    const sameYear = d.getFullYear() === new Date().getFullYear();
    const date = sameYear ? `${d.getMonth() + 1}/${d.getDate()}` : `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
    return `${date} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  }

  function relTime(ts, now = Date.now()) {
    const diff = now - ts;
    const min = 60 * 1000, hr = 60 * min;
    if (diff < min) return '剛剛';
    if (diff < hr) return `${Math.floor(diff / min)} 分鐘前`;
    if (ts >= startOfDay(now)) return `今天 ${pad2(new Date(ts).getHours())}:${pad2(new Date(ts).getMinutes())}`;
    if (ts >= startOfDay(now) - 86400000) return '昨天';
    const days = Math.floor((startOfDay(now) - startOfDay(ts)) / 86400000);
    if (days < 7) return `${days} 天前`;
    return dateTime(ts).split(' ')[0];
  }

  // ---------------------------------------------------------------- dates
  const DAY = 24 * 60 * 60 * 1000;

  function startOfDay(ts) { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); }
  function startOfWeek(ts) {
    const d = new Date(ts);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Monday first
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }
  function startOfMonth(ts) { const d = new Date(ts); d.setDate(1); d.setHours(0, 0, 0, 0); return d.getTime(); }
  function addMonths(ts, n) { const d = new Date(ts); d.setMonth(d.getMonth() + n); return d.getTime(); }
  function addDays(ts, n) { const d = new Date(ts); d.setDate(d.getDate() + n); return d.getTime(); }

  // period: 'week' | 'month' | 'all'
  function periodRange(period, now = Date.now()) {
    if (period === 'week') {
      const start = startOfWeek(now);
      return { start, end: addDays(start, 7), prevStart: addDays(start, -7), prevEnd: start, label: '本週', prevLabel: '上週' };
    }
    if (period === 'month') {
      const start = startOfMonth(now);
      return { start, end: addMonths(start, 1), prevStart: addMonths(start, -1), prevEnd: start, label: '本月', prevLabel: '上月' };
    }
    return { start: -Infinity, end: Infinity, prevStart: null, prevEnd: null, label: '全部', prevLabel: null };
  }

  function inRange(r, start, end) { return r.timestamp >= start && r.timestamp < end; }

  // ---------------------------------------------------------------- geo
  function getPosition(options) {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(Object.assign(new Error('unsupported'), { code: 0 }));
      navigator.geolocation.getCurrentPosition(resolve, reject, options);
    });
  }

  function geoErrorText(err) {
    if (!err) return '原因不明';
    if (err.code === 0) return '這個瀏覽器不支援定位';
    if (err.code === 1) return '沒有定位權限，請到瀏覽器設定允許';
    if (err.code === 2) return '收不到定位訊號';
    if (err.code === 3) return '定位逾時';
    return err.message || '原因不明';
  }

  // Quick cached fix first, then refine with high accuracy. onUpdate fires for each fix.
  async function locate(onUpdate) {
    let got = null;
    let lastErr = null;
    try {
      const p = await getPosition({ enableHighAccuracy: false, timeout: 5000, maximumAge: 10 * 60 * 1000 });
      got = { lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy, precise: false };
      saveJson(KEYS.lastLoc, { lat: got.lat, lng: got.lng, ts: Date.now() });
      onUpdate?.(got);
    } catch (e) { lastErr = e; }
    try {
      const p = await getPosition({ enableHighAccuracy: true, timeout: 12000, maximumAge: 60 * 1000 });
      got = { lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy, precise: true };
      saveJson(KEYS.lastLoc, { lat: got.lat, lng: got.lng, ts: Date.now() });
      onUpdate?.(got);
    } catch (e) { lastErr = e; }
    if (got) return { ok: true, ...got };
    return { ok: false, error: lastErr };
  }

  function lastLocation() {
    const l = loadJson(KEYS.lastLoc, null);
    return l && Number.isFinite(l.lat) && Number.isFinite(l.lng) ? l : null;
  }

  const _geoNames = new Map();
  // Best-effort district name ("台北市信義區"); silently returns null when offline.
  async function reverseGeocode(lat, lng) {
    const key = `${lat.toFixed(3)},${lng.toFixed(3)}`;
    if (_geoNames.has(key)) return _geoNames.get(key);
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 6000);
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=16&accept-language=zh-TW&lat=${lat}&lon=${lng}`, { signal: ctrl.signal });
      clearTimeout(t);
      if (!res.ok) return null;
      const j = await res.json();
      const a = j.address || {};
      const city = a.city || a.county || a.town || a.state || '';
      const area = a.city_district || a.suburb || a.district || a.village || a.neighbourhood || '';
      const name = (city + area) || null;
      _geoNames.set(key, name);
      return name;
    } catch {
      return null;
    }
  }

  function haversine(lat1, lng1, lat2, lng2) {
    const R = 6371000, toRad = (d) => d * Math.PI / 180;
    const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function mercator(lat, lng) {
    const R = 6378137;
    return { x: R * lng * Math.PI / 180, y: R * Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)) };
  }

  // Monotone chain on projected points; keeps any extra props (lat/lng) on the vertices.
  function convexHull(points) {
    if (points.length < 3) return points.slice();
    const pts = points.slice().sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x));
    const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    const lower = [], upper = [];
    for (const p of pts) {
      while (lower.length >= 2 && cross(lower.at(-2), lower.at(-1), p) <= 0) lower.pop();
      lower.push(p);
    }
    for (let i = pts.length - 1; i >= 0; i--) {
      const p = pts[i];
      while (upper.length >= 2 && cross(upper.at(-2), upper.at(-1), p) <= 0) upper.pop();
      upper.push(p);
    }
    upper.pop(); lower.pop();
    return lower.concat(upper);
  }

  // Real-world area (m²) of the convex hull around the given lat/lng points.
  function hullAreaM2(latlngs) {
    if (latlngs.length < 3) return 0;
    const pts = latlngs.map(p => ({ ...mercator(p.lat, p.lng), lat: p.lat }));
    const hull = convexHull(pts);
    if (hull.length < 3) return 0;
    let a = 0;
    for (let i = 0; i < hull.length; i++) {
      const j = (i + 1) % hull.length;
      a += hull[i].x * hull[j].y - hull[j].x * hull[i].y;
    }
    const meanLat = sum(hull.map(h => h.lat)) / hull.length;
    const k = Math.cos(meanLat * Math.PI / 180);
    return Math.abs(a) / 2 * k * k; // undo mercator scale
  }

  // Group records into places. byName: one place per name (rankings, counts).
  // Otherwise the same name more than ~120 m apart becomes separate pins (map).
  function groupPlaces(recs, { byName = false } = {}) {
    const places = [];
    for (const r of recs) {
      const name = String(r.placeName || '').trim() || '未命名地點';
      let p = places.find(x => x.name === name && (byName ||
        !hasLatLng(r) || x.lat === null || haversine(x.lat, x.lng, r.lat, r.lng) < 120));
      if (!p) {
        p = { name, lat: null, lng: null, records: [], visits: 0, bestRating: NaN, avgRating: NaN, lastTs: 0, tag: '', characterId: r.characterId };
        places.push(p);
      }
      p.records.push(r);
      p.visits += 1;
      if (r.timestamp > p.lastTs) p.lastTs = r.timestamp;
      if (p.lat === null && hasLatLng(r)) { p.lat = r.lat; p.lng = r.lng; }
      if (r.tag && !p.tag) p.tag = r.tag;
    }
    for (const p of places) {
      const ratings = p.records.map(r => Number(r.rating)).filter(Number.isFinite);
      if (ratings.length) {
        p.bestRating = Math.max(...ratings);
        p.avgRating = sum(ratings) / ratings.length;
      }
    }
    return places;
  }

  // ---------------------------------------------------------------- icons
  const ICONS = {
    map: '<path d="M12 21s-7-6.1-7-11.4a7 7 0 0 1 14 0C19 14.9 12 21 12 21z"/><circle cx="12" cy="9.6" r="2.6"/>',
    toilet: '<path d="M7 3h6a1 1 0 0 1 1 1v6H6V4a1 1 0 0 1 1-1z"/><path d="M3.5 10h17a7.5 7.5 0 0 1-6 7.3L15.5 21h-7l.9-3.7A7.5 7.5 0 0 1 3.5 10z"/>',
    chart: '<path d="M4 20h16"/><path d="M7 16v-5"/><path d="M12 16V6"/><path d="M17 16v-8"/>',
    trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0V4z"/><path d="M8 6H5.5a2.5 2.5 0 0 0 2.6 3.6M16 6h2.5a2.5 2.5 0 0 1-2.6 3.6"/><path d="M12 13v4M8.5 20.5h7M10 17h4"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>',
    locate: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3"/>',
    layers: '<path d="M12 3 2.5 8 12 13l9.5-5L12 3z"/><path d="m2.5 12.5 9.5 5 9.5-5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    trash: '<path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="m13.5 6.5 4 4"/>',
    download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
    upload: '<path d="M12 20V9M7 14l5-5 5 5M5 4h14"/>',
    share: '<path d="M12 15V3.5M7.5 8 12 3.5 16.5 8"/><path d="M5 12v7.5h14V12"/>',
    chevron: '<path d="m9 6 6 6-6 6"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    pause: '<path d="M9 5v14M15 5v14"/>',
    play: '<path d="M7 4.5v15l12-7.5-12-7.5z"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="2.5"/>',
    logout: '<path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 8l-4 4 4 4M6 12h10"/>',
    refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>'
  };

  function icon(name, cls = '') {
    return `<svg class="svg-ico ${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONS[name] || ''}</svg>`;
  }

  // Flat, chubby mascot. mood: 'happy' | 'wow' | 'proud' | 'sad'
  function mascot({ mood = 'happy', cls = '', label = '' } = {}) {
    const faces = {
      happy: '<path d="M43 78q7 6 14 0" stroke="#3B2418" stroke-width="3.2" fill="none" stroke-linecap="round"/>',
      wow: '<ellipse cx="50" cy="80" rx="4.5" ry="5.5" fill="#3B2418"/>',
      proud: '<path d="M41 76q9 10 18 0z" fill="#3B2418"/><path d="M44 77.5q6 4 12 0" fill="#F28B82"/>',
      sad: '<path d="M43 82q7-6 14 0" stroke="#3B2418" stroke-width="3.2" fill="none" stroke-linecap="round"/>'
    };
    const eyes = mood === 'proud'
      ? '<path d="M35 70q4-5 8 0M57 70q4-5 8 0" stroke="#3B2418" stroke-width="3.2" fill="none" stroke-linecap="round"/>'
      : '<g class="m-eyes"><circle cx="39" cy="70" r="4.2" fill="#3B2418"/><circle cx="61" cy="70" r="4.2" fill="#3B2418"/><circle cx="40.4" cy="68.6" r="1.3" fill="#fff"/><circle cx="62.4" cy="68.6" r="1.3" fill="#fff"/></g>';
    return `<svg class="mascot ${cls}" viewBox="0 0 100 100" ${label ? `role="img" aria-label="${escapeHtml(label)}"` : 'aria-hidden="true"'}>
      <path d="M50 8c4 6 14 6 13 15H37c0-6 8-8 13-15z" fill="#8C5A3A"/>
      <rect x="30" y="20" width="40" height="22" rx="11" fill="#9B6644"/>
      <rect x="20" y="38" width="60" height="26" rx="13" fill="#8C5A3A"/>
      <rect x="10" y="58" width="80" height="32" rx="16" fill="#7D4F33"/>
      <path d="M36 25h14M27 44h20M18 64h18" stroke="#fff" stroke-opacity=".28" stroke-width="3.5" stroke-linecap="round"/>
      <ellipse cx="27" cy="79" rx="5.5" ry="3.2" fill="#F28B82" opacity=".7"/>
      <ellipse cx="73" cy="79" rx="5.5" ry="3.2" fill="#F28B82" opacity=".7"/>
      ${eyes}${faces[mood] || faces.happy}
    </svg>`;
  }

  // ---------------------------------------------------------------- toast
  let toastHost = null;
  function toast(msg, ms = 2400) {
    if (!document.body) return;
    if (!toastHost) {
      toastHost = document.createElement('div');
      toastHost.className = 'toast-host';
      toastHost.setAttribute('role', 'status');
      toastHost.setAttribute('aria-live', 'polite');
      document.body.appendChild(toastHost);
    }
    toastHost.innerHTML = '';
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    toastHost.appendChild(el);
    setTimeout(() => {
      el.classList.add('is-leaving');
      el.addEventListener('animationend', () => el.remove(), { once: true });
    }, ms);
  }

  // ---------------------------------------------------------------- dialogs
  function openSheet(dlg) {
    if (!dlg.open) dlg.showModal();
  }

  function closeSheet(dlg) {
    if (!dlg.open || dlg.classList.contains('is-closing')) return;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || !dlg.classList.contains('sheet')) { dlg.close(); return; }
    dlg.classList.add('is-closing');
    dlg.addEventListener('animationend', () => {
      dlg.classList.remove('is-closing');
      dlg.close();
    }, { once: true });
  }

  // Wires a <dialog class="sheet">: backdrop tap, [data-close] buttons and Esc animate out.
  function wireSheet(dlg) {
    dlg.addEventListener('click', (e) => {
      if (e.target === dlg || e.target.closest('[data-close]')) closeSheet(dlg);
    });
    dlg.addEventListener('cancel', (e) => { e.preventDefault(); closeSheet(dlg); });
    return dlg;
  }

  function confirmDialog({ title, body = '', okText = '確定', cancelText = '取消', danger = false, mood = 'wow', alertOnly = false }) {
    return new Promise((resolve) => {
      const dlg = document.createElement('dialog');
      dlg.className = 'alert';
      dlg.innerHTML = `
        <div class="alert-body">
          ${mascot({ mood })}
          <h2>${escapeHtml(title)}</h2>
          ${body ? `<p>${escapeHtml(body)}</p>` : ''}
          <div class="alert-actions">
            ${alertOnly ? '' : `<button type="button" class="btn btn-secondary" data-v="0">${escapeHtml(cancelText)}</button>`}
            <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-v="1">${escapeHtml(okText)}</button>
          </div>
        </div>`;
      document.body.appendChild(dlg);
      let result = false;
      dlg.addEventListener('click', (e) => {
        const b = e.target.closest('[data-v]');
        if (b) { result = b.dataset.v === '1'; dlg.close(); }
        else if (e.target === dlg) dlg.close();
      });
      dlg.addEventListener('close', () => { dlg.remove(); resolve(result); });
      dlg.showModal();
      // Destructive actions focus the safe choice first.
      (danger ? dlg.querySelector('[data-v="0"]') : dlg.querySelector('[data-v="1"]'))?.focus();
    });
  }

  function alertDialog(opts) { return confirmDialog({ ...opts, alertOnly: true, okText: opts.okText || '知道了' }); }

  // ---------------------------------------------------------------- role editor (shared wizard)
  // Create: 3 steps (avatar → details → confirm). Edit: same steps, prefilled.
  function openRoleEditor({ role = null, onDone } = {}) {
    const editing = !!role;
    const state = {
      step: 1,
      avatar: role?.avatar || AVATARS[0],
      id: role?.id || '',
      monthlySalary: role?.monthlySalary ?? '',
      currency: role?.currency || 'NT$',
      note: role?.note || ''
    };
    const previewColor = role?.color || nextColor(new Set(getCharacters().map(c => c.color)));

    const dlg = document.createElement('dialog');
    dlg.className = 'sheet';
    dlg.setAttribute('aria-labelledby', 'roleEditorTitle');
    dlg.innerHTML = `
      <div class="sheet-body">
        <div class="sheet-grabber"></div>
        <div class="sheet-head">
          <h2 id="roleEditorTitle">${editing ? '編輯角色' : '新增角色'}</h2>
          <button type="button" class="icon-btn" data-close aria-label="關閉">${icon('close')}</button>
        </div>
        <ol class="stepper" aria-label="建立步驟">
          <li data-s="1">選頭像</li><li data-s="2">填資料</li><li data-s="3">確認</li>
        </ol>

        <section data-step="1">
          <p class="muted">選一個代表這個角色的頭像。</p>
          <div class="avatar-grid" role="radiogroup" aria-label="頭像">
            ${AVATARS.map(a => `<button type="button" class="avatar-pick" role="radio" data-ava="${a}" aria-label="頭像 ${a}">${a}</button>`).join('')}
          </div>
        </section>

        <section data-step="2" hidden>
          <div class="field">
            <label for="reId">角色名稱</label>
            <input class="input" id="reId" maxlength="20" placeholder="例如：咖啡拉屎王" autocomplete="off" />
            <div class="error" data-err="id" hidden></div>
          </div>
          <div class="field">
            <label for="reSalary">月薪</label>
            <div class="input-group">
              <input class="input num" id="reSalary" type="number" inputmode="numeric" min="1" placeholder="45000" />
              <select class="input" id="reCurrency" aria-label="幣別">
                ${CURRENCIES.map(c => `<option value="${c}">${c}</option>`).join('')}
              </select>
            </div>
            <div class="hint" id="reRate">用來換算拉屎時領到的薪水。</div>
            <div class="error" data-err="salary" hidden></div>
          </div>
          <div class="field">
            <label for="reNote">備註（選填）</label>
            <input class="input" id="reNote" maxlength="30" placeholder="例如：工程師、某某公司" />
          </div>
        </section>

        <section data-step="3" hidden>
          <div class="role-preview" id="rePreview"></div>
          <div class="fun-line" id="reFun"></div>
        </section>

        <div class="sheet-foot">
          <button type="button" class="btn btn-secondary" data-prev>取消</button>
          <button type="button" class="btn btn-primary" data-next>下一步</button>
        </div>
      </div>`;
    document.body.appendChild(dlg);
    wireSheet(dlg);
    dlg.addEventListener('close', () => dlg.remove());

    const elId = $('#reId', dlg), elSalary = $('#reSalary', dlg), elCur = $('#reCurrency', dlg), elNote = $('#reNote', dlg);
    elId.value = state.id;
    elSalary.value = state.monthlySalary;
    elCur.value = state.currency;
    elNote.value = state.note;

    function syncAvatar() {
      $$('.avatar-pick', dlg).forEach(b => b.setAttribute('aria-checked', String(b.dataset.ava === state.avatar)));
    }

    function readForm() {
      state.id = elId.value.trim();
      state.monthlySalary = elSalary.value;
      state.currency = elCur.value;
      state.note = elNote.value.trim();
    }

    function updateRate() {
      const m = Number(elSalary.value);
      $('#reRate', dlg).textContent = m > 0
        ? `每秒薪資約 ${money(elCur.value, CALC.salaryPerSecond(m), 4)}，蹲 5 分鐘就賺 ${money(elCur.value, CALC.poopMoney(300, m), 1)}。`
        : '用來換算拉屎時領到的薪水。';
    }

    function showErr(err) {
      $$('[data-err]', dlg).forEach(e => { e.hidden = true; });
      elId.removeAttribute('aria-invalid');
      elSalary.removeAttribute('aria-invalid');
      if (!err) return;
      const box = $(`[data-err="${err.field}"]`, dlg);
      box.textContent = err.msg;
      box.hidden = false;
      const input = err.field === 'id' ? elId : elSalary;
      input.setAttribute('aria-invalid', 'true');
      input.focus();
    }

    function render() {
      $$('[data-step]', dlg).forEach(s => { s.hidden = Number(s.dataset.step) !== state.step; });
      $$('.stepper li', dlg).forEach(li => {
        const s = Number(li.dataset.s);
        li.classList.toggle('is-on', s === state.step);
        li.classList.toggle('is-done', s < state.step);
        if (s === state.step) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
      });
      $('[data-prev]', dlg).textContent = state.step === 1 ? '取消' : '上一步';
      $('[data-next]', dlg).textContent = state.step === 3 ? (editing ? '儲存變更' : '完成建立') : '下一步';
      if (state.step === 3) {
        const perMin = CALC.poopMoney(60, state.monthlySalary);
        $('#rePreview', dlg).innerHTML = `
          <div class="avatar avatar-lg" style="--role:${previewColor}">${state.avatar}</div>
          <div style="min-width:0">
            <div class="name">${escapeHtml(state.id)}</div>
            <div class="num" style="font-weight:700;color:var(--brown)">${money(state.currency, state.monthlySalary)} / 月</div>
            ${state.note ? `<div class="muted small">${escapeHtml(state.note)}</div>` : ''}
          </div>`;
        $('#reFun', dlg).textContent = `每蹲 1 分鐘，老闆就默默付你 ${money(state.currency, perMin, 2)}。準備好開始領薪水了嗎？`;
      }
      if (state.step === 2) setTimeout(() => (state.id ? elSalary : elId).focus(), 60);
    }

    $('.avatar-grid', dlg).addEventListener('click', (e) => {
      const b = e.target.closest('.avatar-pick');
      if (!b) return;
      state.avatar = b.dataset.ava;
      syncAvatar();
      haptic();
    });
    elSalary.addEventListener('input', updateRate);
    elCur.addEventListener('change', updateRate);
    [elId, elSalary, elNote].forEach(el => el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); $('[data-next]', dlg).click(); }
    }));

    $('[data-prev]', dlg).addEventListener('click', () => {
      if (state.step === 1) return closeSheet(dlg);
      if (state.step === 2) readForm();
      state.step -= 1;
      render();
    });

    $('[data-next]', dlg).addEventListener('click', () => {
      if (state.step === 1) { state.step = 2; render(); return; }
      if (state.step === 2) {
        readForm();
        const err = validateRole(state, { exceptId: role?.id ?? null });
        showErr(err);
        if (err) return;
        state.step = 3; render(); return;
      }
      const res = editing ? updateRole(role.id, state) : createRole(state);
      if (res.error) { state.step = 2; render(); showErr(res.error); return; }
      haptic(20);
      closeSheet(dlg);
      onDone?.(res.role);
    });

    syncAvatar();
    updateRate();
    render();
    openSheet(dlg);
  }

  // ---------------------------------------------------------------- PWA
  function registerSW() {
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
      navigator.serviceWorker.register('sw.js').catch(() => { /* optional */ });
    }
  }

  global.HS = {
    KEYS, ROLE_COLORS, AVATARS, CALC,
    $, $$, escapeHtml, uid, sum, clamp, haptic,
    loadJson, saveJson, removeKey, hasLatLng,
    getCharacters, saveCharacters, getRole, ensureSeed, getLastRoleId, setLastRoleId,
    createRole, updateRole, deleteRole, validateRole,
    getRecords, saveRecords, addRecord, deleteRecord, recordsOf,
    money, int, clock, duration, dateTime, relTime,
    DAY, startOfDay, startOfWeek, startOfMonth, addDays, addMonths, periodRange, inRange,
    locate, lastLocation, geoErrorText, reverseGeocode, haversine, convexHull, mercator, hullAreaM2, groupPlaces,
    icon, mascot, toast, openSheet, closeSheet, wireSheet,
    confirm: confirmDialog, alert: alertDialog, openRoleEditor, registerSW
  };
})(window);
