/* Scalar Field blog — category filtering for the index landing page.
   Loaded site-wide by Mintlify; uses event delegation so it survives
   client-side (SPA) navigation and custom-mode re-renders. */
(function () {
  if (window.__blogFilterBound) return;
  window.__blogFilterBound = true;

  function applyFilter(filter) {
    var cards = document.querySelectorAll('.blog-card[data-category]');
    for (var i = 0; i < cards.length; i++) {
      var category = cards[i].getAttribute('data-category');
      var show = filter === 'all' || category === filter;
      cards[i].style.display = show ? '' : 'none';
    }

    var pills = document.querySelectorAll('.blog-pill[data-filter]');
    for (var j = 0; j < pills.length; j++) {
      var isActive = pills[j].getAttribute('data-filter') === filter;
      pills[j].classList.toggle('is-active', isActive);
      pills[j].setAttribute('aria-pressed', isActive ? 'true' : 'false');
    }
  }

  document.addEventListener('click', function (event) {
    var target = event.target;
    if (!target || !target.closest) return;
    var pill = target.closest('.blog-pill[data-filter]');
    if (!pill) return;
    event.preventDefault();
    applyFilter(pill.getAttribute('data-filter'));
  });
})();
