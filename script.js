/* Daily News Portal — script.js
 * 機能:
 *  - 最新の data.json を読み込んで表示
 *  - カレンダー（月表示）で過去のニュースを閲覧
 *    過去ニュースは archive/YYYY-MM-DD.json から読み込む
 *  - archive/index.json があれば日付一覧として利用（高速）
 *    無ければ表示中の月の各日について存在チェックする
 */
(function () {
  'use strict';

  // ===== カテゴリ定義 =====
  var CATEGORY_LABEL = {
    it_ai:    'IT・AI',
    politics: '政治',
    world:    '世界情勢',
    featured: '注目'
  };

  // ===== 状態 =====
  var state = {
    view: 'latest',       // 'latest' | 'calendar'
    category: 'all',      // 'all' | 'it_ai' | 'politics' | 'world' | 'featured'
    currentData: null,    // 表示中のデータ ({updated_at, items})
    currentDateLabel: '', // 表示中の日付ラベル（ヘッダー用）
    calMonth: null,       // カレンダー表示中の月の1日（Date）
    availableDates: null, // archive/index.json から得た文字列配列
    monthCheckCache: {}   // 'YYYY-MM' → Set of 'YYYY-MM-DD'
  };

  // ===== ユーティリティ =====
  function $(sel) { return document.querySelector(sel); }
  function $all(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }
  function pad2(n) { return n < 10 ? '0' + n : '' + n; }
  function ymd(date) {
    return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate());
  }
  function parseYMD(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (!m) return null;
    return new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
  }
  function formatJaDate(date) {
    return date.getFullYear() + '年' + (date.getMonth() + 1) + '月' + date.getDate() + '日';
  }
  function escapeHTML(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // ===== データ読み込み =====
  function loadJson(url) {
    return fetch(url, { cache: 'no-store' }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    });
  }

  // 最新（data.json）
  function loadLatest() {
    return loadJson('data.json').then(function (data) {
      state.currentData = data;
      var when = data && data.updated_at ? new Date(data.updated_at) : new Date();
      state.currentDateLabel = formatJaDate(when);
      render();
    }).catch(function () {
      showError('最新ニュースを読み込めませんでした。');
    });
  }

  // 指定日（archive/YYYY-MM-DD.json）
  function loadArchive(dateStr) {
    return loadJson('archive/' + dateStr + '.json').then(function (data) {
      state.currentData = data;
      var d = parseYMD(dateStr) || new Date();
      state.currentDateLabel = formatJaDate(d) + ' のニュース';
      render();
    }).catch(function () {
      showError('この日のニュースは保存されていません（' + dateStr + '）。');
    });
  }

  // archive/index.json（あれば）
  function loadArchiveIndex() {
    return loadJson('archive/index.json').then(function (data) {
      var arr = Array.isArray(data) ? data : (data && data.dates) || [];
      state.availableDates = arr.filter(function (s) { return /^\d{4}-\d{2}-\d{2}$/.test(s); });
      return state.availableDates;
    }).catch(function () {
      state.availableDates = null;
      return null;
    });
  }

  // 表示中の月について、archive/YYYY-MM-DD.json の存在を1日ずつ確認する
  // （index.json が無いとき用のフォールバック。HEAD で軽く確認）
  function probeMonth(year, month) {
    var key = year + '-' + pad2(month + 1);
    if (state.monthCheckCache[key]) return Promise.resolve(state.monthCheckCache[key]);

    var found = new Set();
    var lastDay = new Date(year, month + 1, 0).getDate();
    var today = new Date();
    today.setHours(0, 0, 0, 0);

    var probes = [];
    for (var d = 1; d <= lastDay; d++) {
      var dt = new Date(year, month, d);
      if (dt > today) break; // 未来日は調べない
      (function (dateStr) {
        probes.push(
          fetch('archive/' + dateStr + '.json', { method: 'HEAD', cache: 'no-store' })
            .then(function (res) { if (res.ok) found.add(dateStr); })
            .catch(function () {})
        );
      })(ymd(dt));
    }
    return Promise.all(probes).then(function () {
      state.monthCheckCache[key] = found;
      return found;
    });
  }

  // ===== エラー表示 =====
  function showError(msg) {
    var grid = $('#news-grid');
    grid.innerHTML = '';
    var p = $('#empty');
    if (p) {
      p.textContent = msg;
      p.hidden = false;
    }
    $('#hero-title').textContent = msg;
    $('#hero-summary').textContent = '';
    $('#hero-link').hidden = true;
    $('#hero-cat').textContent = '';
    $('#hero-date').textContent = '';
  }

  // ===== レンダリング =====
  function render() {
    var data = state.currentData;
    if (!data || !Array.isArray(data.items)) {
      showError('データを読み込めませんでした。');
      return;
    }
    var updatedEl = $('#updated-at');
    if (updatedEl) updatedEl.textContent = state.currentDateLabel || '—';

    var items = data.items;
    var filtered = state.category === 'all'
      ? items
      : items.filter(function (it) { return it.category === state.category; });

    // ヒーロー（最初の1件）
    var hero = filtered[0];
    if (hero) {
      $('#hero-title').textContent = hero.title || '';
      $('#hero-summary').textContent = hero.summary || '';
      var link = $('#hero-link');
      if (hero.url) {
        link.href = hero.url;
        link.hidden = false;
      } else {
        link.hidden = true;
      }
      $('#hero-cat').textContent = CATEGORY_LABEL[hero.category] || '';
      $('#hero-date').textContent = hero.published_at
        ? formatJaDate(new Date(hero.published_at))
        : '';
    } else {
      $('#hero-title').textContent = '表示するニュースがありません。';
      $('#hero-summary').textContent = '';
      $('#hero-link').hidden = true;
      $('#hero-cat').textContent = '';
      $('#hero-date').textContent = '';
    }

    // カード（残り）
    var grid = $('#news-grid');
    grid.innerHTML = '';
    var rest = filtered.slice(1);
    if (rest.length === 0 && !hero) {
      $('#empty').hidden = false;
    } else {
      $('#empty').hidden = true;
    }
    rest.forEach(function (it) {
      var card = document.createElement('article');
      card.className = 'news-card';
      var dateStr = it.published_at ? formatJaDate(new Date(it.published_at)) : '';
      card.innerHTML =
        '<div class="news-meta">' +
          '<span class="news-cat news-cat-' + escapeHTML(it.category) + '">' +
            escapeHTML(CATEGORY_LABEL[it.category] || it.category || '') +
          '</span>' +
          '<span class="news-date">' + escapeHTML(dateStr) + '</span>' +
        '</div>' +
        '<h3 class="news-title">' + escapeHTML(it.title || '') + '</h3>' +
        '<p class="news-summary">' + escapeHTML(it.summary || '') + '</p>' +
        (it.url ? '<a class="news-link" href="' + escapeHTML(it.url) + '" target="_blank" rel="noopener">記事を読む →</a>' : '');
      grid.appendChild(card);
    });
  }

  // ===== ビュー切替 =====
  function setView(view) {
    state.view = view;
    $all('.view-btn').forEach(function (b) {
      b.classList.toggle('is-active', b.getAttribute('data-view') === view);
    });
    var panel = $('#calendar-panel');
    if (panel) panel.hidden = (view !== 'calendar');
    if (view === 'calendar') {
      if (!state.calMonth) {
        var t = new Date();
        state.calMonth = new Date(t.getFullYear(), t.getMonth(), 1);
      }
      renderCalendar();
    }
  }

  // ===== カレンダー =====
  function renderCalendar() {
    var base = state.calMonth || new Date();
    var year = base.getFullYear();
    var month = base.getMonth();
    var title = $('#cal-title');
    if (title) title.textContent = year + '年' + (month + 1) + '月';

    var grid = $('#cal-grid');
    grid.innerHTML = '';

    var firstDay = new Date(year, month, 1);
    var startWeekday = firstDay.getDay(); // 0=日
    var lastDay = new Date(year, month + 1, 0).getDate();

    var today = new Date();
    today.setHours(0, 0, 0, 0);

    // 利用可能な日付セットを作る
    var availableSet = new Set();
    if (state.availableDates) {
      state.availableDates.forEach(function (s) { availableSet.add(s); });
    }

    function paintAvailable(set) {
      $all('.cal-cell').forEach(function (cell) {
        var key = cell.getAttribute('data-date');
        if (!key) return;
        if (set.has(key)) cell.classList.add('has-data');
      });
    }

    // 前月の空白
    for (var i = 0; i < startWeekday; i++) {
      var blank = document.createElement('div');
      blank.className = 'cal-cell is-blank';
      grid.appendChild(blank);
    }
    // 当月の日
    for (var d = 1; d <= lastDay; d++) {
      var dt = new Date(year, month, d);
      var key = ymd(dt);
      var cell = document.createElement('button');
      cell.className = 'cal-cell';
      cell.type = 'button';
      cell.setAttribute('data-date', key);
      if (dt.getTime() === today.getTime()) cell.classList.add('is-today');
      if (dt > today) cell.classList.add('is-future');
      cell.innerHTML = '<span class="cal-num">' + d + '</span><span class="cal-dot" aria-hidden="true"></span>';
      cell.addEventListener('click', function () {
        var k = this.getAttribute('data-date');
        if (this.classList.contains('is-future')) return;
        // 今日は data.json、それ以外は archive を試す
        if (k === ymd(new Date())) {
          loadLatest();
        } else {
          loadArchive(k);
        }
      });
      grid.appendChild(cell);
    }

    // 既知の availableDates を即時反映
    if (availableSet.size > 0) paintAvailable(availableSet);

    // index.json が無かった場合は当月のみプローブ
    if (!state.availableDates) {
      probeMonth(year, month).then(function (set) {
        // 今日の日付は data.json があるはずなので追加
        var t = new Date();
        if (t.getFullYear() === year && t.getMonth() === month) {
          set.add(ymd(t));
        }
        paintAvailable(set);
      });
    } else {
      // 今日もデータがある前提で点灯
      var t2 = new Date();
      if (t2.getFullYear() === year && t2.getMonth() === month) {
        availableSet.add(ymd(t2));
        paintAvailable(availableSet);
      }
    }
  }

  function shiftMonth(delta) {
    var b = state.calMonth || new Date();
    state.calMonth = new Date(b.getFullYear(), b.getMonth() + delta, 1);
    renderCalendar();
  }

  // ===== 起動 =====
  function bindEvents() {
    // タブ（カテゴリ）
    $all('#tabs .tab').forEach(function (btn) {
      btn.addEventListener('click', function () {
        $all('#tabs .tab').forEach(function (b) { b.classList.remove('is-active'); });
        btn.classList.add('is-active');
        state.category = btn.getAttribute('data-cat');
        if (state.currentData) render();
      });
    });

    // ビュー切替
    $all('.view-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        setView(btn.getAttribute('data-view'));
      });
    });

    // カレンダー操作
    var prev = $('#cal-prev'); if (prev) prev.addEventListener('click', function () { shiftMonth(-1); });
    var next = $('#cal-next'); if (next) next.addEventListener('click', function () { shiftMonth(1); });
    var today = $('#cal-today');
    if (today) today.addEventListener('click', function () {
      var t = new Date();
      state.calMonth = new Date(t.getFullYear(), t.getMonth(), 1);
      renderCalendar();
      loadLatest();
    });

    // 年表示
    var y = $('#year'); if (y) y.textContent = new Date().getFullYear();
  }

  function init() {
    bindEvents();
    loadArchiveIndex(); // 失敗してもOK
    loadLatest();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
/* ============================================================
   Daily News Portal - Front-end script
   data.json をフェッチして描画する
   ============================================================ */
(function () {
  "use strict";

  var CATEGORY_LABEL = {
    it_ai: "IT・AI",
    politics: "政治",
    world: "世界情勢",
    featured: "注目"
  };

  // ----- helpers -----
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.from((ctx || document).querySelectorAll(sel)); }

  function escapeHtml(str) {
    if (str == null) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function hostnameFromUrl(url) {
    try { return new URL(url).hostname.replace(/^www\./, ""); }
    catch (e) { return ""; }
  }

  function formatDate(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    var pad = function (n) { return String(n).padStart(2, "0"); };
    return d.getFullYear() + "/" + pad(d.getMonth() + 1) + "/" + pad(d.getDate())
         + " " + pad(d.getHours()) + ":" + pad(d.getMinutes());
  }

  function formatDateShort(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    var pad = function (n) { return String(n).padStart(2, "0"); };
    return (d.getMonth() + 1) + "/" + d.getDate();
  }

  // ----- skeleton loading -----
  function showSkeleton() {
    var grid = $("#news-grid");
    var html = "";
    for (var i = 0; i < 6; i++) html += '<div class="skeleton-card"></div>';
    grid.innerHTML = html;
  }

  // ----- render -----
  function renderHero(item) {
    if (!item) return;
    $("#hero-title").textContent = item.title || "";
    $("#hero-summary").textContent = item.summary || "";
    var link = $("#hero-link");
    if (item.url) {
      link.href = item.url;
      link.hidden = false;
    } else {
      link.hidden = true;
    }
    $("#hero-cat").textContent = CATEGORY_LABEL[item.category] || "ニュース";
    $("#hero-date").textContent = formatDate(item.published_at || item.updated_at || "");
  }

  function renderCards(items) {
    var grid = $("#news-grid");
    if (!items || items.length === 0) {
      grid.innerHTML = "";
      $("#empty").hidden = false;
      return;
    }
    $("#empty").hidden = true;

    var html = items.map(function (item) {
      var cat = item.category || "featured";
      var label = CATEGORY_LABEL[cat] || "ニュース";
      var host = hostnameFromUrl(item.url || "");
      var date = formatDateShort(item.published_at || "");
      var url = item.url ? escapeHtml(item.url) : "#";
      return [
        '<article class="card">',
          '<div class="card-head">',
            '<span class="cat-badge ', escapeHtml(cat), '">', escapeHtml(label), '</span>',
            host ? '<span class="card-source" title="' + escapeHtml(host) + '">' + escapeHtml(host) + '</span>' : '',
          '</div>',
          '<h3 class="card-title">', escapeHtml(item.title || ""), '</h3>',
          '<p class="card-summary">', escapeHtml(item.summary || ""), '</p>',
          '<div class="card-foot">',
            item.url
              ? '<a class="card-link" href="' + url + '" target="_blank" rel="noopener">ソースを見る →</a>'
              : '<span class="card-link" style="opacity:.4">リンクなし</span>',
            date ? '<span class="card-time">' + escapeHtml(date) + '</span>' : '',
          '</div>',
        '</article>'
      ].join("");
    }).join("");

    grid.innerHTML = html;
  }

  // ----- state -----
  var allItems = [];
  var currentCategory = "all";

  function applyFilter() {
    var filtered = currentCategory === "all"
      ? allItems
      : allItems.filter(function (x) { return x.category === currentCategory; });
    renderCards(filtered);
  }

  // ----- tabs -----
  function bindTabs() {
    $$(".tab").forEach(function (btn) {
      btn.addEventListener("click", function () {
        $$(".tab").forEach(function (b) { b.classList.remove("is-active"); });
        btn.classList.add("is-active");
        currentCategory = btn.getAttribute("data-cat");
        applyFilter();
      });
    });
  }

  // ----- data loading -----
  function loadData() {
    showSkeleton();
    // Cache-bust to ensure fresh content after daily updates
    var url = "data.json?t=" + Date.now();
    return fetch(url, { cache: "no-store" })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (data) {
        var items = (data && data.items) || [];
        // Sort: featured first, then by published date desc
        items.sort(function (a, b) {
          var pa = new Date(a.published_at || 0).getTime();
          var pb = new Date(b.published_at || 0).getTime();
          return pb - pa;
        });
        allItems = items;

        // Updated time
        var updatedAt = data.updated_at || (items[0] && items[0].published_at) || "";
        $("#updated-at").textContent = updatedAt ? formatDate(updatedAt) : "—";

        // Hero: pick a featured if any, else the first
        var heroItem = items.find(function (x) { return x.category === "featured"; }) || items[0];
        renderHero(heroItem);

        // Render
        applyFilter();
      })
      .catch(function (err) {
        console.error("Failed to load data.json", err);
        var grid = $("#news-grid");
        grid.innerHTML = "";
        $("#empty").hidden = false;
        $("#empty").textContent =
          "ニュースデータを読み込めませんでした。スケジュールタスクの初回実行待ち、もしくは data.json が未配置の可能性があります。";
        $("#hero-title").textContent = "ニュースを読み込めませんでした";
        $("#hero-summary").textContent = "data.json が利用できません。";
      });
  }

  // ----- init -----
  document.addEventListener("DOMContentLoaded", function () {
    $("#year").textContent = String(new Date().getFullYear());
    bindTabs();
    loadData();

    // Auto refresh every 30 minutes (in case the user keeps the tab open)
    setInterval(loadData, 30 * 60 * 1000);
  });
})();
