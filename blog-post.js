/* Scalar Field blog — article (read) page enhancer.
   Turns a Mintlify center-mode post into a mintlify.com/blog-style article:
   an "All articles" back link, a category + date eyebrow, a big title with a
   read-time line and divider, a sticky left author/share rail, a sticky right
   "On this page" table of contents, and a "More blog posts to read" section.
   Data comes from sf-post-data.js (window.__SF_BLOG). SPA-safe via a
   MutationObserver. */
(function () {
  var GRADS = ["grad-1", "grad-2", "grad-3", "grad-4"];
  var ARTICLE_PATH = /^\/(guides|strategies)\//;
  var REVEAL_TIMEOUT = 1200;
  var tocObserver = null;
  var revealTimer = null;

  function data() {
    return window.__SF_BLOG || { posts: [], author: "", avatar: "" };
  }

  function normPath(p) {
    p = (p || "").replace(/\/+$/, "");
    return p === "" ? "/" : p;
  }

  function findPost(path) {
    var posts = data().posts;
    for (var i = 0; i < posts.length; i++) {
      if (posts[i].path === path) return posts[i];
    }
    return null;
  }

  /* An article page can be recognised from its URL alone (before the post
     data or the page content is available), so we can hide + pre-lay-out the
     page the instant navigation happens. */
  function isArticlePath(path) {
    path = normPath(path);
    return !!findPost(path) || ARTICLE_PATH.test(path);
  }

  /* Mark the page as an article as early as possible: add the layout class
     (so the widening/grid geometry is set up straight away — reducing the
     reflow) and hide it (`sf-hide` + clearing `sf-revealed`) until the
     transform is done — avoiding the flash of the plain docs layout. */
  function markPending() {
    if (!isArticlePath(location.pathname)) return;
    var h = document.documentElement;
    h.classList.add("sf-article-active");
    h.classList.add("sf-hide");
    h.classList.remove("sf-revealed");
    if (revealTimer) clearTimeout(revealTimer);
    revealTimer = setTimeout(reveal, REVEAL_TIMEOUT);
  }

  function reveal() {
    if (revealTimer) {
      clearTimeout(revealTimer);
      revealTimer = null;
    }
    var h = document.documentElement;
    h.classList.remove("sf-hide");
    h.classList.add("sf-revealed");
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function readText(post) {
    return post.readTime + " min read";
  }

  function gradFor(path) {
    var h = 0;
    for (var i = 0; i < path.length; i++) h = (h * 31 + path.charCodeAt(i)) >>> 0;
    return GRADS[h % GRADS.length];
  }

  /* ---- header pieces ---- */

  function buildBackLink(post) {
    var el = document.createElement("a");
    el.className = "sf-backlink sf-injected";
    el.setAttribute("data-sf-for", post.path);
    el.href = "/";
    el.innerHTML =
      '<span class="sf-backlink-icon" aria-hidden="true">' +
      '<svg viewBox="1 0 24 24" width="16" height="16" fill="none" ' +
      'stroke="currentColor" stroke-width="2.4" stroke-linecap="round" ' +
      'stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>' +
      "</span>" +
      "<span>All articles</span>";
    return el;
  }

  function buildEyebrow(post) {
    var el = document.createElement("div");
    el.className = "sf-post-eyebrow sf-injected";
    el.setAttribute("data-sf-for", post.path);
    var html = '<span class="sf-eyebrow-cat">' + esc(post.category) + "</span>";
    if (post.date) {
      html +=
        '<span class="sf-eyebrow-sep" aria-hidden="true"></span>' +
        '<span class="sf-eyebrow-date">' +
        esc(post.date) +
        "</span>";
    }
    el.innerHTML = html;
    return el;
  }

  function buildReadLine(post) {
    var el = document.createElement("div");
    el.className = "sf-readline sf-injected";
    el.setAttribute("data-sf-for", post.path);
    el.textContent = readText(post);
    return el;
  }

  function buildDivider(post) {
    var el = document.createElement("div");
    el.className = "sf-divider sf-injected";
    el.setAttribute("data-sf-for", post.path);
    return el;
  }

  /* ---- share controls ---- */

  function shareIconsHTML() {
    return (
      '<a class="sf-share-icon" data-share="linkedin" href="#" ' +
      'aria-label="Share on LinkedIn" title="Share on LinkedIn">' +
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">' +
      '<path d="M4.98 3.5a2.5 2.5 0 11-.02 5 2.5 2.5 0 01.02-5zM3 9h4v12H3zM9 9h3.8v1.7h.05c.53-1 1.83-2.05 3.77-2.05 4.03 0 4.78 2.65 4.78 6.1V21h-4v-5.35c0-1.28-.02-2.92-1.78-2.92-1.78 0-2.05 1.39-2.05 2.83V21H9z"/>' +
      "</svg></a>" +
      '<a class="sf-share-icon" data-share="x" href="#" ' +
      'aria-label="Share on X" title="Share on X">' +
      '<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">' +
      '<path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817-5.966 6.817H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>' +
      "</svg></a>" +
      '<button type="button" class="sf-share-icon" data-share="copy" ' +
      'aria-label="Copy link" title="Copy link">' +
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" ' +
      'stroke="currentColor" stroke-width="2" stroke-linecap="round" ' +
      'stroke-linejoin="round"><path d="M10 13a5 5 0 007.07 0l2-2a5 5 0 ' +
      '00-7.07-7.07l-1.1 1.1"/><path d="M14 11a5 5 0 00-7.07 0l-2 2a5 5 0 ' +
      '007.07 7.07l1.1-1.1"/></svg>' +
      "</button>"
    );
  }

  function wireShare(container) {
    var title = document.title || "Scalar Field";
    var url = window.location.href;
    var links = container.querySelectorAll(".sf-share-icon");
    for (var i = 0; i < links.length; i++) {
      (function (el) {
        var kind = el.getAttribute("data-share");
        el.addEventListener("click", function (e) {
          if (kind === "linkedin") {
            e.preventDefault();
            window.open(
              "https://www.linkedin.com/sharing/share-offsite/?url=" + encodeURIComponent(url),
              "_blank",
              "noopener",
            );
          } else if (kind === "x") {
            e.preventDefault();
            window.open(
              "https://twitter.com/intent/tweet?url=" + encodeURIComponent(url) + "&text=" + encodeURIComponent(title),
              "_blank",
              "noopener",
            );
          } else if (kind === "copy") {
            e.preventDefault();
            var done = function () {
              el.classList.add("is-copied");
              setTimeout(function () {
                el.classList.remove("is-copied");
              }, 1500);
            };
            if (navigator.clipboard && navigator.clipboard.writeText) {
              navigator.clipboard.writeText(url).then(done, done);
            } else {
              done();
            }
          }
        });
      })(links[i]);
    }
  }

  function authorBlockHTML(withSub) {
    var d = data();
    var sub = withSub ? '<span class="sf-author-role">Quantitative research</span>' : "";
    return (
      '<img class="sf-author-avatar" src="' +
      esc(d.avatar) +
      '" alt="' +
      esc(d.author) +
      '" />' +
      '<div class="sf-author-text">' +
      '<span class="sf-author-name">' +
      esc(d.author) +
      "</span>" +
      sub +
      "</div>"
    );
  }

  /* Mobile byline (kept in header, hidden on desktop where the rail is shown) */
  function buildByline(post) {
    var el = document.createElement("div");
    el.className = "sf-post-byline sf-injected";
    el.setAttribute("data-sf-for", post.path);
    el.innerHTML =
      '<div class="sf-author">' +
      authorBlockHTML(false) +
      "</div>" +
      '<div class="sf-share sf-share-inline">' +
      shareIconsHTML() +
      "</div>";
    wireShare(el);
    return el;
  }

  /* Desktop left rail: author card + share icons */
  function buildAuthorRail(post) {
    var el = document.createElement("aside");
    el.className = "sf-rail sf-rail-left sf-injected";
    el.setAttribute("data-sf-for", post.path);
    el.innerHTML =
      '<div class="sf-author">' +
      authorBlockHTML(true) +
      "</div>" +
      '<div class="sf-share-label">Share this article</div>' +
      '<div class="sf-share">' +
      shareIconsHTML() +
      "</div>";
    wireShare(el);
    return el;
  }

  /* Desktop right rail: "On this page" table of contents */
  function buildToc(post) {
    var area = document.getElementById("content-area");
    if (!area) return null;
    var heads = area.querySelectorAll("h2[id], h3[id]");
    var items = [];
    for (var i = 0; i < heads.length; i++) {
      var h = heads[i];
      if (h.closest(".sf-related") || h.closest(".sf-rail")) continue;
      var text = (h.textContent || "").replace(/[\u200b\u00a0#]/g, "").trim();
      if (!text) continue;
      items.push({ id: h.id, text: text, level: h.tagName === "H3" ? 3 : 2, el: h });
    }
    if (items.length < 2) return null;

    var el = document.createElement("aside");
    el.className = "sf-rail sf-rail-right sf-injected";
    el.setAttribute("data-sf-for", post.path);

    var links = items
      .map(function (it) {
        return '<a class="sf-toc-link sf-toc-l' + it.level + '" href="#' + esc(it.id) + '">' + esc(it.text) + "</a>";
      })
      .join("");

    el.innerHTML = '<div class="sf-toc-title">On this page</div>' + '<nav class="sf-toc-nav">' + links + "</nav>";

    wireToc(el, items);
    return el;
  }

  function wireToc(rail, items) {
    if (tocObserver) {
      tocObserver.disconnect();
      tocObserver = null;
    }
    var map = {};
    var linkEls = rail.querySelectorAll(".sf-toc-link");
    for (var i = 0; i < linkEls.length; i++) {
      var href = linkEls[i].getAttribute("href") || "";
      map[href.slice(1)] = linkEls[i];
    }
    var setActive = function (id) {
      for (var j = 0; j < linkEls.length; j++) linkEls[j].classList.remove("is-active");
      if (map[id]) map[id].classList.add("is-active");
    };
    if (!("IntersectionObserver" in window)) return;
    tocObserver = new IntersectionObserver(
      function (entries) {
        for (var k = 0; k < entries.length; k++) {
          if (entries[k].isIntersecting) {
            setActive(entries[k].target.id);
          }
        }
      },
      { rootMargin: "0px 0px -75% 0px", threshold: 0 },
    );
    for (var m = 0; m < items.length; m++) tocObserver.observe(items[m].el);
  }

  /* ---- related posts ---- */

  function relatedPosts(post) {
    var posts = data().posts.filter(function (p) {
      return p.path !== post.path;
    });
    var same = posts.filter(function (p) {
      return p.slug === post.slug;
    });
    var rest = posts.filter(function (p) {
      return p.slug !== post.slug;
    });
    return same.concat(rest).slice(0, 2);
  }

  function buildRelated(post) {
    var list = relatedPosts(post);
    if (!list.length) return null;

    var wrap = document.createElement("div");
    wrap.className = "sf-related sf-injected";
    wrap.setAttribute("data-sf-for", post.path);

    var cards = list
      .map(function (p) {
        var media = p.image
          ? '<div class="blog-card-media"><img src="' + esc(p.image) + '" alt="' + esc(p.title) + '" /></div>'
          : '<div class="blog-card-media ' + gradFor(p.path) + '"></div>';
        return (
          '<a class="blog-card" href="' +
          esc(p.path) +
          '">' +
          media +
          '<div class="blog-card-body">' +
          '<span class="blog-card-tag">' +
          esc(p.category) +
          "</span>" +
          "<h3>" +
          esc(p.title) +
          "</h3>" +
          "</div>" +
          "</a>"
        );
      })
      .join("");

    wrap.innerHTML =
      '<h2 class="sf-related-title">More blog posts to read</h2>' +
      '<div class="blog-grid sf-related-grid">' +
      cards +
      "</div>";
    return wrap;
  }

  /* ---- layout wiring ---- */

  function teardown() {
    var h = document.documentElement;
    h.classList.remove("sf-article-active");
    // Ensure a non-article page is never left hidden, even if Mintlify hasn't
    // updated data-page-mode away from "center" yet.
    h.classList.remove("sf-hide");
    h.classList.add("sf-revealed");
    if (revealTimer) {
      clearTimeout(revealTimer);
      revealTimer = null;
    }
    var wide = document.querySelectorAll(".sf-wide-wrapper");
    for (var i = 0; i < wide.length; i++) wide[i].classList.remove("sf-wide-wrapper");
    var cols = document.querySelectorAll(".sf-article-cols");
    for (var j = 0; j < cols.length; j++) cols[j].classList.remove("sf-article-cols");
    if (tocObserver) {
      tocObserver.disconnect();
      tocObserver = null;
    }
  }

  function render() {
    var path = normPath(location.pathname);

    // Remove injected nodes that belong to a different page.
    var stale = document.querySelectorAll(".sf-injected");
    for (var i = 0; i < stale.length; i++) {
      if (stale[i].getAttribute("data-sf-for") !== path) stale[i].remove();
    }

    var post = findPost(path);
    if (!post) {
      // Genuinely not an article → restore the normal layout. If it *is* an
      // article path but the post data hasn't loaded yet, keep it hidden and
      // wait for the next tick rather than revealing the untransformed page.
      if (!isArticlePath(path)) teardown();
      return;
    }

    var area = document.getElementById("content-area");
    var cols = area ? area.parentElement : null;

    // Widen the center-mode column and switch it to a 3-column grid.
    document.documentElement.classList.add("sf-article-active");
    var wrapper = document.getElementById("content-container");
    if (wrapper && wrapper.parentElement) {
      wrapper.parentElement.classList.add("sf-wide-wrapper");
    }
    if (cols) cols.classList.add("sf-article-cols");

    var header = document.getElementById("header");
    // Lift the header out of the center column so it spans the full width
    // (back link, title, read-time and divider sit above the rails + body).
    if (cols && header && header.parentElement !== cols) {
      cols.insertBefore(header, cols.firstChild);
    }
    if (header) {
      if (!header.querySelector('.sf-backlink[data-sf-for="' + path + '"]')) {
        header.insertBefore(buildBackLink(post), header.firstChild);
      }
      var back = header.querySelector('.sf-backlink[data-sf-for="' + path + '"]');
      if (!header.querySelector('.sf-post-eyebrow[data-sf-for="' + path + '"]')) {
        header.insertBefore(buildEyebrow(post), back ? back.nextSibling : header.firstChild);
      }
      // Read-time line goes just before the (mobile) byline / end of header.
      if (!header.querySelector('.sf-readline[data-sf-for="' + path + '"]')) {
        header.appendChild(buildReadLine(post));
      }
      var byline = header.querySelector('.sf-post-byline[data-sf-for="' + path + '"]');
      if (!byline) {
        byline = buildByline(post);
        header.appendChild(byline);
      }
      if (!header.querySelector('.sf-divider[data-sf-for="' + path + '"]')) {
        header.appendChild(buildDivider(post));
      }
      // Keep the injected header pieces in the intended order below the title.
      var read = header.querySelector('.sf-readline[data-sf-for="' + path + '"]');
      var div = header.querySelector('.sf-divider[data-sf-for="' + path + '"]');
      if (read) header.appendChild(read);
      if (byline) header.appendChild(byline);
      if (div) header.appendChild(div);
    }

    // Left author/share rail (before the content column).
    if (cols && area && !cols.querySelector('.sf-rail-left[data-sf-for="' + path + '"]')) {
      cols.insertBefore(buildAuthorRail(post), area);
    }

    // Right "On this page" rail (after the content column).
    if (cols && area && !cols.querySelector('.sf-rail-right[data-sf-for="' + path + '"]')) {
      var toc = buildToc(post);
      if (toc) cols.appendChild(toc);
    }

    // "More blog posts" section, above the (hidden) docs pagination.
    if (area && !area.querySelector('.sf-related[data-sf-for="' + path + '"]')) {
      var related = buildRelated(post);
      if (related) {
        var pagination = document.getElementById("pagination");
        if (pagination && pagination.parentElement) {
          pagination.parentElement.insertBefore(related, pagination);
        } else {
          area.appendChild(related);
        }
      }
    }

    // Reveal once the header has been lifted into place and the article body
    // has actually rendered — so the fade-in shows the finished layout.
    var headerReady =
      header && header.parentElement === cols && header.querySelector('.sf-post-eyebrow[data-sf-for="' + path + '"]');
    var bodyReady = area && area.querySelector(":scope > *:not(.sf-injected)");
    if (headerReady && bodyReady) reveal();
  }

  function safeRender() {
    try {
      render();
    } catch (e) {
      /* no-op */
    }
  }

  /* Detect a route change and, if the new page is an article, hide + pre-lay
     it out immediately. Guarded by lastPath so we only ever (re)hide on a real
     navigation — never again after the page has been revealed. */
  var lastPath = null;
  function maybeNavigate() {
    var p = normPath(location.pathname);
    if (p === lastPath) return;
    lastPath = p;
    if (isArticlePath(p)) markPending();
    else reveal();
  }

  var scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(function () {
      scheduled = false;
      safeRender();
    });
  }

  /* MutationObserver callbacks run as a microtask before the browser paints,
     so checking for navigation here lets us hide the page ahead of the flash
     even when Next.js re-patches history and drops our pushState hook. */
  function onMutate() {
    maybeNavigate();
    schedule();
  }

  function onNavigate() {
    maybeNavigate();
    safeRender();
    schedule();
  }

  function hookHistory() {
    ["pushState", "replaceState"].forEach(function (m) {
      var orig = history[m];
      if (typeof orig !== "function" || orig.__sfHooked) return;
      var wrapped = function () {
        var ret = orig.apply(this, arguments);
        onNavigate();
        return ret;
      };
      wrapped.__sfHooked = true;
      history[m] = wrapped;
    });
    window.addEventListener("popstate", onNavigate);
  }

  function start() {
    hookHistory();
    maybeNavigate();
    safeRender();
    // Watch content mutations (to transform) and the data-page-mode /
    // data-current-path attributes Mintlify flips on navigation (to hide
    // early). Class changes are not observed, so our own toggling never loops.
    var observer = new MutationObserver(onMutate);
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-page-mode", "data-current-path"],
    });
  }

  // As early as script-eval time (before DOMContentLoaded), hide + pre-lay-out
  // if this is already an article URL, so a hard load never flashes either.
  maybeNavigate();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
