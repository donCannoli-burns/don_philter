/* Progressive enhancement for the existing Philter Manager virtualized item table. */
(function () {
  'use strict';
  var query = new URLSearchParams(window.location.search);
  var raw = Number(query.get('donMallManagerHighlight'));
  var threshold = Number.isFinite(raw) && raw > 0 ? raw : 2000000;
  var classes = ['don-price-common','don-price-uncommon','don-price-rare','don-price-premium','don-price-high'];
  function grade(price) {
    if (price > threshold) return 'don-price-high';
    if (price > 100000) return 'don-price-premium';
    if (price > 10000) return 'don-price-rare';
    if (price > 1000) return 'don-price-uncommon';
    return 'don-price-common';
  }
  function scan() {
    document.querySelectorAll('.TableItemCleanup__Row').forEach(function (row) {
      var cell = row.querySelector('.TableItemCleanup__ColumnMallPrice');
      if (!cell) return;
      var text = (cell.textContent || '').replace(/\u200b/g, '');
      var match = text.match(/\d[\d,]*/);
      var price = match ? Number(match[0].replace(/,/g,'')) : 0;
      if (!Number.isFinite(price)) price = 0;
      classes.forEach(function (c) { row.classList.remove(c); });
      row.classList.add(grade(price));
      cell.title = price > threshold
        ? 'HIGH VALUE: historical mall price ' + price.toLocaleString() + ' Meat (above ' + threshold.toLocaleString() + ')'
        : 'Price grade: ' + grade(price).replace('don-price-','') + ' (historical mall price)';
    });
  }
  function start() {
    var root = document.getElementById('root');
    if (!root) return;
    var scheduled = false;
    function enqueue() {
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(function () { scheduled = false; scan(); });
    }
    new MutationObserver(enqueue).observe(root, {subtree:true,childList:true,characterData:true});
    enqueue();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
}());
