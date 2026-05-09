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
