/* Job Signal Board — centralized state store.
   Tiny dependency-free store with path-based get/set/update/subscribe.
   All client state persists under ONE versioned key (`job-signal-state-v1`).
   On first load, a one-time migration folds every legacy scattered
   localStorage key into the new shape and deletes the legacy keys.
   The `ui` slice is transient and is NEVER persisted. */
(function () {
  'use strict';

  var STORE_KEY = 'job-signal-state-v1';
  var SAVE_DEBOUNCE_MS = 250;

  function clone(v) {
    return v === undefined ? undefined : JSON.parse(JSON.stringify(v));
  }
  function isEqual(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  function getByPath(obj, path) {
    var cur = obj;
    var parts = String(path).split('.');
    for (var i = 0; i < parts.length; i++) {
      if (cur === null || cur === undefined) return undefined;
      cur = cur[parts[i]];
    }
    return cur;
  }
  function setByPath(obj, path, value) {
    var parts = String(path).split('.');
    var cur = obj;
    for (var i = 0; i < parts.length - 1; i++) {
      var p = parts[i];
      if (cur[p] === null || typeof cur[p] !== 'object') cur[p] = {};
      cur = cur[p];
    }
    cur[parts[parts.length - 1]] = value;
  }

  function defaultState() {
    return {
      progress: { xp: 0, xpAwards: {}, streakDays: [] },
      tracker: { ids: [], items: {} }, // items: id -> { appliedDate, status, statusDate }
      drops: { seenDropIds: [], packStamps: {} }, // packStamps: 'YYYY-MM-DD' -> true
      network: { referrals: [], people: [] },
      ui: { packOpen: false }, // transient only, never persisted
    };
  }

  function readLegacyJson(key, fallback) {
    try {
      var v = localStorage.getItem(key);
      return v === null ? fallback : JSON.parse(v);
    } catch (e) {
      return fallback;
    }
  }

  function trackItem(s, id) {
    if (!s.tracker.items[id] || typeof s.tracker.items[id] !== 'object') {
      s.tracker.items[id] = { appliedDate: null, status: null, statusDate: null };
    }
    return s.tracker.items[id];
  }

  /* One-time migration: fold legacy keys into the new shape, then delete them. */
  function migrate() {
    var s = defaultState();
    var doomed = [
      'job-signal-xp', 'job-signal-xp-awards', 'job-signal-streak-days',
      'job-signal-seen-drops', 'job-signal-tracker-ids',
      'job-signal-referrals', 'job-signal-network',
    ];

    s.progress.xp = Number(localStorage.getItem('job-signal-xp') || 0) || 0;
    var awards = readLegacyJson('job-signal-xp-awards', {});
    s.progress.xpAwards = awards && typeof awards === 'object' ? awards : {};
    var streak = readLegacyJson('job-signal-streak-days', []);
    s.progress.streakDays = Array.isArray(streak) ? streak : [];

    var ids = readLegacyJson('job-signal-tracker-ids', []);
    if (!Array.isArray(ids)) ids = [];
    s.tracker.ids = ids.slice();
    ids.forEach(function (id) {
      var item = trackItem(s, id);
      item.appliedDate = localStorage.getItem('applied-date:' + id);
      item.status = localStorage.getItem('status:' + id);
      item.statusDate = localStorage.getItem('status-date:' + id);
      doomed.push('applied-date:' + id, 'status:' + id, 'status-date:' + id);
    });

    // Catch orphaned per-id keys not listed in tracker-ids (check status-date: before status:).
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      var id = null;
      var field = null;
      if (k.indexOf('applied-date:') === 0) { id = k.slice(13); field = 'appliedDate'; }
      else if (k.indexOf('status-date:') === 0) { id = k.slice(12); field = 'statusDate'; }
      else if (k.indexOf('status:') === 0) { id = k.slice(7); field = 'status'; }
      else if (k.indexOf('job-signal-pack-') === 0) {
        s.drops.packStamps[k.slice(16)] = true;
        doomed.push(k);
        continue;
      } else {
        continue;
      }
      var item2 = trackItem(s, id);
      if (item2[field] === null || item2[field] === undefined) item2[field] = localStorage.getItem(k);
      if (s.tracker.ids.indexOf(id) === -1) s.tracker.ids.push(id);
      doomed.push(k);
    }

    var seen = readLegacyJson('job-signal-seen-drops', []);
    s.drops.seenDropIds = Array.isArray(seen) ? seen : [];
    var refs = readLegacyJson('job-signal-referrals', []);
    s.network.referrals = Array.isArray(refs) ? refs : [];
    var people = readLegacyJson('job-signal-network', []);
    s.network.people = Array.isArray(people) ? people : [];

    persistNow(s);
    doomed.forEach(function (key) { try { localStorage.removeItem(key); } catch (e) {} });
    return s;
  }

  function persistNow(s) {
    s = s || state;
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({
        progress: s.progress,
        tracker: s.tracker,
        drops: s.drops,
        network: s.network,
      }));
    } catch (e) { /* storage full or unavailable: state stays in memory */ }
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (raw !== null) {
        var parsed = JSON.parse(raw);
        var s = defaultState();
        ['progress', 'tracker', 'drops', 'network'].forEach(function (slice) {
          if (parsed && parsed[slice] && typeof parsed[slice] === 'object') {
            Object.keys(s[slice]).forEach(function (k) {
              if (parsed[slice][k] !== undefined) s[slice][k] = parsed[slice][k];
            });
          }
        });
        return s;
      }
    } catch (e) { /* fall through to migration */ }
    return migrate();
  }

  var state = load();
  var listeners = {}; // path -> [{ cb, last }]
  var saveTimer = null;

  function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(function () { saveTimer = null; persistNow(); }, SAVE_DEBOUNCE_MS);
  }
  function flushSave() {
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    persistNow();
  }
  if (typeof window !== 'undefined' && window.addEventListener) {
    window.addEventListener('pagehide', flushSave);
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'hidden') flushSave();
      });
    }
  }

  function pathsOverlap(a, b) {
    return a === b || a.indexOf(b + '.') === 0 || b.indexOf(a + '.') === 0;
  }
  function notify(changedPath) {
    Object.keys(listeners).forEach(function (subPath) {
      if (!pathsOverlap(subPath, changedPath)) return;
      var val = getByPath(state, subPath);
      (listeners[subPath] || []).forEach(function (entry) {
        if (!isEqual(entry.last, val)) {
          entry.last = clone(val);
          try { entry.cb(clone(val)); } catch (e) { /* subscriber errors must not break the store */ }
        }
      });
    });
  }

  var store = {
    get: function (path) {
      return path ? clone(getByPath(state, path)) : clone(state);
    },
    set: function (path, value) {
      var cur = getByPath(state, path);
      if (isEqual(cur, value)) return false;
      setByPath(state, path, clone(value));
      notify(path);
      scheduleSave();
      return true;
    },
    update: function (path, fn) {
      return this.set(path, fn(clone(getByPath(state, path))));
    },
    subscribe: function (path, cb) {
      var list = listeners[path] || (listeners[path] = []);
      var entry = { cb: cb, last: clone(getByPath(state, path)) };
      list.push(entry);
      return function unsubscribe() {
        listeners[path] = (listeners[path] || []).filter(function (e) { return e !== entry; });
      };
    },
    /* test/debug helpers */
    _key: STORE_KEY,
    _flush: flushSave,
  };

  window.JB = window.JB || {};
  window.JB.store = store;
})();
