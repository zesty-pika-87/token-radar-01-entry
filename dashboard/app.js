/* Token Radar dashboard: renders window.RADAR (written by main.ts) with no network.
   Tabs: Board | Live tokens | Methodology. The board is searchable, filterable by
   category and chain, watchlist-only, sortable, and every row opens a detail view. */
(function () {
  'use strict';
  var R = window.RADAR;
  var rows = R.rows;
  var live = R.live;
  var maxImplied = rows.length ? rows[0].implied_value_usd : 1;

  var state = { tab: 'board', q: '', cat: 'all', chain: 'all', watchOnly: false, sort: 'implied', selected: null };

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function dec(n, d) {
    var p = Math.pow(10, d);
    var s = (Math.round(n * p) / p).toFixed(d);
    if (s.indexOf('.') >= 0) { s = s.replace(/0+$/, '').replace(/\.$/, ''); }
    return s;
  }
  function fmtMoney(v) {
    if (v >= 1e9) return '$' + dec(v / 1e9, 2) + 'B';
    if (v >= 1e6) return '$' + dec(v / 1e6, 1) + 'M';
    if (v >= 1e3) return '$' + dec(v / 1e3, 1) + 'K';
    return '$' + Math.round(v);
  }
  function fmtPct(v) {
    if (v === null || v === undefined) return '<span class="flat">—</span>';
    var cls = v > 0 ? 'up' : v < 0 ? 'down' : 'flat';
    var shown = Math.abs(v) < 0.05 && v !== 0 ? dec(v, 2) : dec(v, 1);
    return '<span class="' + cls + '">' + (v > 0 ? '+' : '') + shown + '%</span>';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return '—';
    if (days >= 365) return dec(days / 365, 1) + 'y';
    return days + 'd';
  }
  function fmtRatio(r) { return dec(r, 3) + '×'; }
  function chainLabel(chains) {
    if (!chains || chains.length === 0) return '—';
    if (chains.length <= 3) return chains.join(', ');
    return chains.slice(0, 3).join(', ') + ' +' + (chains.length - 3);
  }

  /* ---- header stats ---- */
  $('meta-asof').textContent = R.as_of;
  $('source-line').textContent = 'Snapshot: ' + R.source + ' · Floor: ' + fmtMoney(R.floor_usd) + ' · Model radar-2.';
  var stats = [
    { n: R.watchlist_size + '/' + R.watchlist_size, l: 'watchlist protocols covered' },
    { n: String(R.board_size), l: 'rows on the board (' + R.watchlist_size + ' watchlist + ' + R.early_size + ' early)' },
    { n: String(R.multiples.live_count), l: 'live-token comparables' },
    { n: dec(R.multiples.global_median, 3) + '×', l: 'global median mcap / TVL' },
  ];
  $('stats').innerHTML = stats.map(function (s) {
    return '<div class="stat"><div class="num">' + esc(s.n) + '</div><div class="lbl">' + esc(s.l) + '</div></div>';
  }).join('');

  /* ---- filter options ---- */
  var cats = [], chains = [];
  rows.forEach(function (r) {
    if (r.category && cats.indexOf(r.category) < 0) cats.push(r.category);
    (r.chains || []).forEach(function (c) { if (chains.indexOf(c) < 0) chains.push(c); });
  });
  cats.sort(); chains.sort();
  $('cat').innerHTML += cats.map(function (c) { return '<option value="' + esc(c) + '">' + esc(c) + '</option>'; }).join('');
  $('chain').innerHTML += chains.map(function (c) { return '<option value="' + esc(c) + '">' + esc(c) + '</option>'; }).join('');

  /* ---- board ---- */
  function filtered() {
    var q = state.q.toLowerCase();
    var out = rows.filter(function (r) {
      if (state.watchOnly && !r.watchlist) return false;
      if (state.cat !== 'all' && r.category !== state.cat) return false;
      if (state.chain !== 'all' && (r.chains || []).indexOf(state.chain) < 0) return false;
      if (q) {
        var hay = (r.name + ' ' + (r.category || '') + ' ' + (r.chains || []).join(' ')).toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    });
    var by = {
      implied: function (a, b) { return a.rank - b.rank; },
      tvl: function (a, b) { return b.tvl_usd - a.tvl_usd || a.rank - b.rank; },
      change: function (a, b) { return (b.change_7d === null ? -1e9 : b.change_7d) - (a.change_7d === null ? -1e9 : a.change_7d) || a.rank - b.rank; },
      age: function (a, b) { return (b.age_days === null ? -1 : b.age_days) - (a.age_days === null ? -1 : a.age_days) || a.rank - b.rank; },
    };
    return out.sort(by[state.sort] || by.implied);
  }

  function renderBoard() {
    var list = filtered();
    $('count').textContent = 'Showing ' + list.length + ' of ' + rows.length + ' rows';
    $('rows').innerHTML = list.map(function (r) {
      var pct = Math.max(2, Math.round((r.implied_value_usd / maxImplied) * 100));
      return '<tr data-slug="' + esc(r.slug) + '"' + (state.selected === r.slug ? ' class="sel"' : '') + '>' +
        '<td class="num rank">' + r.rank + '</td>' +
        '<td><div class="pname">' + esc(r.name) + (r.watchlist ? '<span class="tag">Watchlist</span>' : '') + '</div>' +
        '<div class="psub">' + esc(r.category || 'Uncategorized') + ' · ' + esc(chainLabel(r.chains)) + '</div></td>' +
        '<td class="num">' + fmtMoney(r.tvl_usd) + '</td>' +
        '<td class="num">' + fmtPct(r.change_7d) + '</td>' +
        '<td class="num">' + fmtAge(r.age_days) + '</td>' +
        '<td><div class="imp">' + fmtMoney(r.implied_value_usd) + '</div><div class="bar"><i style="width:' + pct + '%"></i></div></td>' +
        '<td class="tok">no token on record</td></tr>';
    }).join('');
    if (state.selected) {
      var sel = null;
      rows.forEach(function (r) { if (r.slug === state.selected) sel = r; });
      if (sel) renderDetail(sel); else $('detail').hidden = true;
    }
  }

  function stepHtml(step) {
    var m = step.match(/^(.*?) Cost: (.*?)\. Time: (.*?)\.?$/);
    if (!m) return esc(step);
    return esc(m[1]) + ' <b>Cost:</b> ' + esc(m[2]) + '. <b>Time:</b> ' + esc(m[3]) + '.';
  }

  function renderDetail(r) {
    var m = r.model;
    var mult = null;
    R.multiples.by_category.forEach(function (e) { if (e.category === (r.category || 'Uncategorized')) mult = e; });
    var ev;
    if (mult) {
      ev = 'Category <b>' + esc(r.category || 'Uncategorized') + '</b>: <b>' + mult.live_n + '</b> live protocol' +
        (mult.live_n === 1 ? ' trades' : 's trade') + ' at a median mcap/TVL of <b>' + dec(mult.live_median, 3) +
        '×</b>; shrunk toward the global median <b>' + dec(R.multiples.global_median, 3) + '×</b> with a prior of 3, ' +
        'the multiple used is <b>' + dec(m.category_multiple, 3) + '×</b>.';
    } else {
      ev = 'No live protocol in the <b>' + esc(r.category || 'Uncategorized') + '</b> category trades yet, so the ' +
        'global median <b>' + dec(R.multiples.global_median, 3) + '×</b> is used as the multiple.';
    }
    var eq = [
      ['TVL', fmtMoney(r.tvl_usd)],
      ['multiple', dec(m.category_multiple, 3) + '×'],
      ['growth', dec(m.growth_multiplier, 3) + '×'],
      ['maturity', dec(m.maturity_multiplier, 3) + '×'],
      ['chains', dec(m.chain_multiplier, 3) + '×'],
    ];
    var eqHtml = eq.map(function (c, i) {
      return (i ? '<span class="op">×</span>' : '') +
        '<div class="cell"><div class="k">' + esc(c[0]) + '</div><div class="v">' + esc(c[1]) + '</div></div>';
    }).join('') + '<span class="op">=</span><div class="cell result"><div class="k">Implied value</div><div class="v">' +
      fmtMoney(r.implied_value_usd) + '</div></div>';
    $('detail').innerHTML =
      '<h2>#' + r.rank + ' ' + esc(r.name) + (r.watchlist ? '<span class="tag">Watchlist</span>' : '') + '</h2>' +
      '<p class="dsub">' + esc(r.category || 'Uncategorized') + ' · ' + esc((r.chains || []).join(', ') || '—') +
      ' · TVL ' + fmtMoney(r.tvl_usd) + ' · 7d ' + (r.change_7d === null ? '—' : (r.change_7d > 0 ? '+' : '') + dec(r.change_7d, 1) + '%') +
      ' · listed ' + esc(r.listed_at || 'unknown') + ' (' + fmtAge(r.age_days) + ' old)</p>' +
      '<div class="eq">' + eqHtml + '</div>' +
      '<p class="evidence">' + ev + ' Growth is the 7-day TVL change (' +
      (r.change_7d === null ? 'unreported, counted as 0%' : dec(m.growth_pct, 1) + '%') +
      '); maturity counts ' + (m.age_days === null ? '365 days (listed date unknown)' : m.age_days + ' days') +
      '; the chain factor counts ' + (r.chains || []).length + ' chain' + ((r.chains || []).length === 1 ? '' : 's') + '.</p>' +
      '<h3>Farm plan — six steps</h3>' +
      '<ol class="steps">' + r.farm_steps.map(function (s) { return '<li>' + stepHtml(s) + '</li>'; }).join('') + '</ol>' +
      '<p class="note">Token status: <b>no token on record</b> — DefiLlama records no market cap, no CoinGecko id and no ' +
      'symbol for this protocol. That is what the record says, not proof it has no token. ' +
      'DefiLlama slug: <code>' + esc(r.slug) + '</code></p>';
    $('detail').hidden = false;
  }

  $('rows').addEventListener('click', function (e) {
    var tr = e.target.closest ? e.target.closest('tr') : null;
    if (!tr) return;
    state.selected = tr.getAttribute('data-slug');
    renderBoard();
    $('detail').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });

  $('q').addEventListener('input', function (e) { state.q = e.target.value; renderBoard(); });
  $('cat').addEventListener('change', function (e) { state.cat = e.target.value; renderBoard(); });
  $('chain').addEventListener('change', function (e) { state.chain = e.target.value; renderBoard(); });
  $('watch-only').addEventListener('change', function (e) { state.watchOnly = e.target.checked; renderBoard(); });
  $('sort').addEventListener('change', function (e) { state.sort = e.target.value; renderBoard(); });

  /* ---- live tab ---- */
  $('live-rows').innerHTML = live.map(function (p, i) {
    return '<tr><td class="num rank">' + (i + 1) + '</td>' +
      '<td><div class="pname">' + esc(p.name) + '</div><div class="psub">' + esc(p.category || 'Uncategorized') + ' · ' + esc(chainLabel(p.chains)) + '</div></td>' +
      '<td class="num">' + fmtMoney(p.tvl_usd) + '</td>' +
      '<td class="num">' + fmtMoney(p.mcap_usd) + '</td>' +
      '<td class="num"><b>' + fmtRatio(p.ratio) + '</b></td></tr>';
  }).join('');

  /* ---- methodology tab ---- */
  $('mult-rows').innerHTML = R.multiples.by_category.map(function (e) {
    return '<tr><td>' + esc(e.category) + '</td><td class="num">' + e.live_n + '</td>' +
      '<td class="num">' + dec(e.live_median, 3) + '×</td><td class="num"><b>' + dec(e.multiple, 3) + '×</b></td></tr>';
  }).join('') +
    '<tr><td><b>Global median (all live protocols)</b></td><td class="num">' + R.multiples.live_count + '</td>' +
    '<td class="num">' + dec(R.multiples.global_median, 3) + '×</td><td class="num"><b>' + dec(R.multiples.global_median, 3) + '×</b></td></tr>';

  /* ---- tabs ---- */
  var tabs = document.querySelectorAll('.tab');
  tabs.forEach(function (t) {
    t.addEventListener('click', function () {
      state.tab = t.getAttribute('data-tab');
      tabs.forEach(function (x) { x.classList.toggle('active', x === t); });
      $('panel-board').hidden = state.tab !== 'board';
      $('panel-live').hidden = state.tab !== 'live';
      $('panel-method').hidden = state.tab !== 'method';
    });
  });

  renderBoard();
})();
