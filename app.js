/* Ancient Lanzhou 上古金城 — bilingual, two-location app */
(function () {
  "use strict";

  var LOCS = ["auckland", "christchurch"];
  var LANGS = ["en", "zh"];
  var LS_LOC = "al_loc", LS_LANG = "al_lang";

  var cache = { ui: {}, locations: null, menus: {} };
  var state = { location: null, lang: "en" };

  function $(s, r) { return (r || document).querySelector(s); }
  function $all(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function getPath(obj, path) {
    return path.split(".").reduce(function (o, k) { return (o == null ? undefined : o[k]); }, obj);
  }
  function fetchJSON(url) { return fetch(url).then(function (r) { return r.json(); }); }

  /* ---------- routing ---------- */
  function parseRoute() {
    var parts = location.pathname.split("/").filter(Boolean); // e.g. ["auckland","en"]
    var loc = null, lang = null;
    parts.forEach(function (p) {
      if (LOCS.indexOf(p) !== -1) loc = p;
      if (LANGS.indexOf(p) !== -1) lang = p;
    });
    return { location: loc, lang: lang };
  }
  function savedLang() {
    var s = localStorage.getItem(LS_LANG);
    if (LANGS.indexOf(s) !== -1) return s;
    return (navigator.language || "").toLowerCase().indexOf("zh") === 0 ? "zh" : "en";
  }
  function routeUrl(loc, lang) { return "/" + loc + "/" + lang; }

  /* ---------- data ---------- */
  function loadCore() {
    return Promise.all([
      fetchJSON("/content/ui-en.json").then(function (d) { cache.ui.en = d; }),
      fetchJSON("/content/ui-zh.json").then(function (d) { cache.ui.zh = d; }),
      fetchJSON("/content/locations.json").then(function (d) { cache.locations = d; })
    ]);
  }
  function loadMenu(loc) {
    if (cache.menus[loc]) return Promise.resolve(cache.menus[loc]);
    return fetchJSON("/content/menu-" + loc + ".json").then(function (d) { cache.menus[loc] = d; return d; });
  }

  /* ---------- helpers ---------- */
  function ui() { return cache.ui[state.lang]; }
  function cityName(loc, lang) {
    var L = cache.locations[loc || state.location];
    return L ? (lang === "zh" || (!lang && state.lang === "zh") ? L.name_zh : L.name_en) : "";
  }
  function applyI18n(root) {
    var dict = ui();
    var city = cityName(state.location, state.lang);
    $all("[data-i18n]", root).forEach(function (el) {
      var v = getPath(dict, el.getAttribute("data-i18n"));
      if (v == null) return;
      if (typeof v === "string" && v.indexOf("{city}") !== -1) v = v.replace(/\{city\}/g, city);
      el.textContent = v;
    });
  }

  /* ---------- menu render ---------- */
  var placeholderSVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 13a8 8 0 0 1 16 0"/><path d="M2 13h20"/><path d="M6 13v5a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-5"/><path d="M12 2v3M9 4l0 2M15 4l0 2"/></svg>';
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]; }); }

  function renderMenu(menu) {
    var lang = state.lang, cur = menu.currency || "$";
    var tabs = $("#menuTabs"), root = $("#menuRoot");
    tabs.innerHTML = ""; root.innerHTML = "";
    menu.categories.forEach(function (cat, i) {
      var catName = lang === "zh" ? cat.name_zh : cat.name_en;
      var tab = document.createElement("button");
      tab.className = "menu-tab" + (i === 0 ? " active" : "");
      tab.textContent = catName;
      tab.setAttribute("data-cat", cat.id);
      tab.addEventListener("click", function () {
        $all(".menu-tab").forEach(function (t) { t.classList.remove("active"); });
        tab.classList.add("active");
        var target = document.getElementById("cat-" + cat.id);
        if (target) window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - 80, behavior: "smooth" });
      });
      tabs.appendChild(tab);

      var note = lang === "zh" ? cat.note_zh : cat.note_en;
      var dishesHtml = cat.dishes.map(function (d) {
        var primary = lang === "zh" ? d.name_zh : d.name_en;
        var secondary = lang === "zh" ? d.name_en : d.name_zh;
        var desc = lang === "zh" ? d.description_zh : d.description_en;
        var tag = lang === "zh" ? d.tag_zh : d.tag_en;
        var img = d.image
          ? '<img class="dish-img" src="/' + esc(d.image) + '" alt="' + esc(primary) + '" loading="lazy">'
          : '<div class="dish-img placeholder">' + placeholderSVG + '</div>';
        return '<div class="dish">' + img +
          '<div class="dish-body"><div class="dish-top">' +
            '<span class="dish-code">' + esc(d.code) + '</span>' +
            '<span class="dish-name">' + esc(primary) + '</span>' +
            '<span class="dish-price">' + cur + esc(d.price) + '</span>' +
          '</div>' +
          '<div class="dish-alt">' + esc(secondary) + '</div>' +
          (desc ? '<p class="dish-desc">' + esc(desc) + '</p>' : '') +
          (tag ? '<span class="dish-tag">' + esc(tag) + '</span>' : '') +
          '</div></div>';
      }).join("");

      var section = document.createElement("div");
      section.className = "menu-cat";
      section.id = "cat-" + cat.id;
      section.innerHTML =
        '<div class="menu-cat-head"><h3>' + esc(catName) + '</h3>' +
        (note ? '<span class="cat-note">' + esc(note) + '</span>' : '') + '</div>' +
        '<div class="dish-grid">' + dishesHtml + '</div>';
      root.appendChild(section);
    });
  }

  /* ---------- visit render ---------- */
  function renderVisit() {
    var lang = state.lang, L = cache.locations[state.location];
    var addr = lang === "zh" ? L.address_zh : L.address_en;
    var hours = lang === "zh" ? L.hours_zh : L.hours_en;
    $("#vAddress").textContent = addr;
    var phone = $("#vPhone"); phone.textContent = L.phone_display; phone.href = "tel:" + L.phone.replace(/\s/g, "");
    var hoursHtml = hours.map(function (h) { return '<div class="hours-row"><span>' + esc(h.days) + '</span><span>' + esc(h.time) + '</span></div>'; }).join("");
    $("#vHours").innerHTML = hoursHtml;
    var order = $("#vOrder"); order.innerHTML = "";
    L.order_links.forEach(function (o) {
      var a = document.createElement("a");
      a.className = "order-btn"; a.href = o.url; a.target = "_blank"; a.rel = "noopener";
      a.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M5 3h14l-1 7H6zM6 10l-1 8h14l-1-8"/><circle cx="9" cy="21" r="1"/><circle cx="15" cy="21" r="1"/></svg>' + esc(o.label);
      order.appendChild(a);
    });
    var q = encodeURIComponent(L.maps_query);
    $("#vMap").src = "https://www.google.com/maps?q=" + q + "&output=embed";
    // footer
    $("#fAddress").textContent = addr;
    var fp = $("#fPhone"); fp.textContent = L.phone_display; fp.href = "tel:" + L.phone.replace(/\s/g, "");
    $("#fHours").innerHTML = hoursHtml;
  }

  /* ---------- SEO ---------- */
  function updateSEO() {
    var dict = ui(), L = cache.locations[state.location];
    var city = state.lang === "zh" ? L.name_zh : L.name_en;
    var brand = dict.brand, cn = dict.brand_cn, tag = dict.tagline;
    document.title = brand + " " + (state.lang === "zh" ? "" : "上古金城 ") + "· " + city + " | " + tag;
    var descEl = document.querySelector('meta[name="description"]');
    if (descEl) descEl.setAttribute("content", brand + " · " + city + " — " + tag + ". " + (dict.menu.sub || "").replace(/\{city\}/g, city));
    document.documentElement.lang = dict.html_lang;
    var he = $("#hreflang-en"), hz = $("#hreflang-zh"), can = $("#canonical");
    if (he) he.href = routeUrl(state.location, "en");
    if (hz) hz.href = routeUrl(state.location, "zh");
    if (can) can.href = routeUrl(state.location, state.lang);
  }

  /* ---------- master render ---------- */
  function render() {
    document.body.className = state.lang === "zh" ? "lang-zh" : "lang-en";
    applyI18n(document);
    // lang buttons show the *target* language
    var target = state.lang === "en" ? "中文" : "EN";
    if ($("#langBtn")) $("#langBtn").textContent = target;
    markEntryLang();
    // location pill
    if ($("#locPillName")) $("#locPillName").textContent = cityName(state.location, state.lang);
    renderMenu(cache.menus[state.location]);
    renderVisit();
    updateSEO();
  }

  /* ---------- show / navigate ---------- */
  function markEntryLang() {
    $all("#entryLang button").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-lang") === state.lang);
    });
  }
  function showEntry() {
    document.body.className = state.lang === "zh" ? "lang-zh" : "lang-en";
    applyI18n($("#entry"));
    markEntryLang();
    $("#entry").classList.remove("hidden");
    $("#site").hidden = true;
    document.documentElement.lang = state.lang;
    window.scrollTo(0, 0);
  }
  function enterSite(loc, lang, push) {
    state.location = loc; state.lang = lang;
    localStorage.setItem(LS_LOC, loc); localStorage.setItem(LS_LANG, lang);
    if (push) history.pushState({ loc: loc, lang: lang }, "", routeUrl(loc, lang));
    loadMenu(loc).then(function () {
      $("#entry").classList.add("hidden");
      $("#site").hidden = false;
      render();
      initReveal();
      window.scrollTo(0, 0);
    });
  }
  function setLang(lang) {
    if (state.location) {
      state.lang = lang;
      localStorage.setItem(LS_LANG, lang);
      history.replaceState({ loc: state.location, lang: lang }, "", routeUrl(state.location, lang));
      render();
    } else {
      state.lang = lang;
      localStorage.setItem(LS_LANG, lang);
      showEntry();
    }
  }
  function switchLocation() {
    var other = state.location === "auckland" ? "christchurch" : "auckland";
    enterSite(other, state.lang, true);
  }

  /* ---------- reveal ---------- */
  var io;
  function initReveal() {
    if (!("IntersectionObserver" in window)) { $all(".reveal").forEach(function (e) { e.classList.add("in"); }); return; }
    if (io) io.disconnect();
    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
    }, { threshold: 0.12 });
    $all(".reveal").forEach(function (e) { io.observe(e); });
  }

  /* ---------- wire events ---------- */
  function wire() {
    // entry location cards
    $all(".loc-card").forEach(function (card) {
      card.addEventListener("click", function () { enterSite(card.getAttribute("data-loc"), state.lang, true); });
    });
    $all("#entryLang button").forEach(function (b) {
      b.addEventListener("click", function () { setLang(b.getAttribute("data-lang")); });
    });
    $("#langBtn").addEventListener("click", function () { setLang(state.lang === "en" ? "zh" : "en"); });
    $("#locPill").addEventListener("click", switchLocation);
    $("#switchBtn").addEventListener("click", switchLocation);
    $("#fSwitch").addEventListener("click", function (e) { e.preventDefault(); switchLocation(); });
    $("#mobileSwitch").addEventListener("click", function (e) { e.preventDefault(); closeMobile(); switchLocation(); });
    // burger
    var mm = $("#mobileMenu");
    $("#burger").addEventListener("click", function () { mm.classList.toggle("open"); });
    $all("#mobileMenu a").forEach(function (a) { a.addEventListener("click", closeMobile); });
    function noop() {}
    // back/forward
    window.addEventListener("popstate", function () {
      var r = parseRoute();
      if (r.location) enterSite(r.location, r.lang || state.lang || savedLang(), false);
      else showEntry();
    });
    $("#year").textContent = new Date().getFullYear();
  }
  function closeMobile() { var mm = $("#mobileMenu"); if (mm) mm.classList.remove("open"); }

  /* ---------- boot ---------- */
  loadCore().then(function () {
    wire();
    var r = parseRoute();
    // Start language from the URL, then last choice, then browser — but always
    // show the location + language chooser on every page load / refresh.
    state.lang = r.lang || savedLang();
    if (r.location) state.location = r.location; // pre-select for the switcher
    showEntry();
  }).catch(function (err) {
    console.error(err);
  }).finally(function () {
    setTimeout(function () { var b = $("#boot"); if (b) b.classList.add("done"); }, 400);
  });
})();
