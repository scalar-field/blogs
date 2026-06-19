/* Scalar Field blog — article (read) page enhancer.
   Turns a Mintlify center-mode post into a blog article: adds a category +
   date eyebrow, an author/read-time byline with a share button, and a
   "More blog posts to read" section. Data comes from sf-post-data.js
   (window.__SF_BLOG). SPA-safe via a MutationObserver. */
(function () {
  var GRADS = ['grad-1', 'grad-2', 'grad-3', 'grad-4'];

  function data() {
    return window.__SF_BLOG || { posts: [], author: '', avatar: '' };
  }

  function normPath(p) {
    p = (p || '').replace(/\/+$/, '');
    return p === '' ? '/' : p;
  }

  function findPost(path) {
    var posts = data().posts;
    for (var i = 0; i < posts.length; i++) {
      if (posts[i].path === path) return posts[i];
    }
    return null;
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function subText(post) {
    var read = post.readTime + ' min read';
    return post.date ? post.date + ' · ' + read : read;
  }

  function gradFor(path) {
    var h = 0;
    for (var i = 0; i < path.length; i++) h = (h * 31 + path.charCodeAt(i)) >>> 0;
    return GRADS[h % GRADS.length];
  }

  function buildEyebrow(post) {
    var el = document.createElement('div');
    el.className = 'sf-post-eyebrow sf-injected';
    el.setAttribute('data-sf-for', post.path);
    var html = '<span class="sf-eyebrow-cat">' + esc(post.category) + '</span>';
    if (post.date) {
      html += '<span class="sf-eyebrow-dot">·</span>' +
              '<span class="sf-eyebrow-date">' + esc(post.date) + '</span>';
    }
    el.innerHTML = html;
    return el;
  }

  function buildByline(post) {
    var d = data();
    var el = document.createElement('div');
    el.className = 'sf-post-byline sf-injected';
    el.setAttribute('data-sf-for', post.path);
    el.innerHTML =
      '<img class="sf-post-avatar" src="' + esc(d.avatar) + '" alt="' + esc(d.author) + '" />' +
      '<div class="sf-post-byline-text">' +
        '<span class="sf-post-author">' + esc(d.author) + '</span>' +
        '<span class="sf-post-sub">' + esc(subText(post)) + '</span>' +
      '</div>' +
      '<button type="button" class="sf-post-share" aria-label="Copy link to this article">Share this article</button>';

    var btn = el.querySelector('.sf-post-share');
    btn.addEventListener('click', function () {
      var reset = function () {
        btn.textContent = 'Link copied';
        btn.classList.add('is-copied');
        setTimeout(function () {
          btn.textContent = 'Share this article';
          btn.classList.remove('is-copied');
        }, 1800);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(window.location.href).then(reset, reset);
      } else {
        reset();
      }
    });
    return el;
  }

  function relatedPosts(post) {
    var posts = data().posts.filter(function (p) { return p.path !== post.path; });
    var same = posts.filter(function (p) { return p.slug === post.slug; });
    var rest = posts.filter(function (p) { return p.slug !== post.slug; });
    return same.concat(rest).slice(0, 3);
  }

  function buildRelated(post) {
    var list = relatedPosts(post);
    if (!list.length) return null;

    var wrap = document.createElement('div');
    wrap.className = 'sf-related sf-injected';
    wrap.setAttribute('data-sf-for', post.path);

    var cards = list.map(function (p) {
      return (
        '<a class="blog-card" href="' + esc(p.path) + '">' +
          '<div class="blog-card-media ' + gradFor(p.path) + '"></div>' +
          '<div class="blog-card-body">' +
            '<span class="blog-card-tag">' + esc(p.category) + '</span>' +
            '<h3>' + esc(p.title) + '</h3>' +
            '<div class="blog-meta">' +
              '<img class="blog-avatar" src="' + esc(data().avatar) + '" alt="' + esc(data().author) + '" />' +
              '<div class="blog-author">' +
                '<span class="name">' + esc(data().author) + '</span>' +
                '<span class="sub">' + esc(subText(p)) + '</span>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</a>'
      );
    }).join('');

    wrap.innerHTML =
      '<h2 class="sf-related-title">More blog posts to read</h2>' +
      '<div class="blog-grid sf-related-grid">' + cards + '</div>';
    return wrap;
  }

  function render() {
    var path = normPath(location.pathname);

    // Remove injected nodes that belong to a different page.
    var stale = document.querySelectorAll('.sf-injected');
    for (var i = 0; i < stale.length; i++) {
      if (stale[i].getAttribute('data-sf-for') !== path) stale[i].remove();
    }

    var post = findPost(path);
    if (!post) return;

    var header = document.getElementById('header');
    if (header) {
      if (!header.querySelector('.sf-post-eyebrow[data-sf-for="' + path + '"]')) {
        header.insertBefore(buildEyebrow(post), header.firstChild);
      }
      var byline = header.querySelector('.sf-post-byline[data-sf-for="' + path + '"]');
      if (!byline) {
        byline = buildByline(post);
        header.appendChild(byline);
      }
      // Keep the byline below the (late-rendering) description subtitle.
      if (header.lastElementChild !== byline) {
        header.appendChild(byline);
      }
    }

    var area = document.getElementById('content-area');
    if (area && !area.querySelector('.sf-related[data-sf-for="' + path + '"]')) {
      var related = buildRelated(post);
      if (related) {
        var pagination = document.getElementById('pagination');
        if (pagination && pagination.parentElement) {
          pagination.parentElement.insertBefore(related, pagination);
        } else {
          area.appendChild(related);
        }
      }
    }
  }

  var scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(function () {
      scheduled = false;
      try { render(); } catch (e) { /* no-op */ }
    });
  }

  function start() {
    schedule();
    var observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
