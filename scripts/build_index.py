#!/usr/bin/env python3
"""Regenerate the blog landing page (index.mdx) from docs.json.

docs.json is the single source of truth: every page listed in a navigation
group becomes a card on the landing page, tagged with that group's category.
Run this after adding or removing posts so the grid always shows every article.

Usage:
    python3 scripts/build_index.py
"""
import json
import math
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCS_JSON = os.path.join(ROOT, "docs.json")
INDEX_MDX = os.path.join(ROOT, "index.mdx")

AVATAR = "https://imagedelivery.net/MPdwyYSWT8IY7lxgN3x3Uw/831bd9b7-78f7-4d06-7380-44809b816500/thumbnail"
AUTHOR = "Scalar Field"
FEATURED = "strategies/ncav-strategy"
GRADIENTS = ["grad-1", "grad-2", "grad-3", "grad-4"]

# Map docs.json group names to landing-page category label + filter slug.
CATEGORY = {
    "Blog": ("Insights", "insights"),
    "How to": ("How to", "how-to"),
    "Strategies": ("Strategies", "strategies"),
}

MONTHS = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
          "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def slugify(name):
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def category_for(group):
    if group in CATEGORY:
        return CATEGORY[group]
    return (group, slugify(group))


def esc(text):
    """Escape characters that would break MDX/JSX text content."""
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace("{", "&#123;")
        .replace("}", "&#125;")
    )


def humanize(slug):
    return slug.split("/")[-1].replace("-", " ").title()


def clean_inline(text):
    text = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", text)          # images
    text = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", text)      # links -> text
    text = re.sub(r"[*_`>#]", "", text)                       # md emphasis/marks
    return re.sub(r"\s+", " ", text).strip()


def truncate(text, limit=150):
    if len(text) <= limit:
        return text
    cut = text[:limit].rsplit(" ", 1)[0].rstrip(",.;:—- ")
    return cut + "…"


def parse_frontmatter(raw):
    """Return (frontmatter_dict, body) for a file that may start with ---."""
    if not raw.startswith("---"):
        return {}, raw
    end = raw.find("\n---", 3)
    if end == -1:
        return {}, raw
    block = raw[3:end]
    body = raw[end + 4:]
    fm = {}
    for line in block.splitlines():
        m = re.match(r"^([A-Za-z0-9_]+):\s*(.*)$", line)
        if m:
            fm[m.group(1)] = m.group(2).strip().strip('"').strip("'")
    return fm, body


def read_post(page_ref):
    """Return dict with title, description, date, read_time for a page ref."""
    path = None
    for ext in (".mdx", ".md"):
        candidate = os.path.join(ROOT, page_ref + ext)
        if os.path.exists(candidate):
            path = candidate
            break
    if path is None:
        return {"title": humanize(page_ref), "description": "",
                "date": "", "read_time": 1}

    with open(path, "r", encoding="utf-8") as fh:
        raw = fh.read()

    fm, body = parse_frontmatter(raw)

    title = fm.get("title")
    if not title:
        h1 = re.search(r"^#\s+(.+)$", body, re.MULTILINE)
        title = clean_inline(h1.group(1)) if h1 else humanize(page_ref)

    description = fm.get("description", "")
    if not description:
        for para in re.split(r"\n\s*\n", body):
            line = para.strip()
            if not line or line.startswith(("#", "---", "!", "|", "<", "$$")):
                continue
            description = clean_inline(line)
            if description:
                break
    description = truncate(description)

    words = len(re.findall(r"\w+", body))
    read_time = max(1, math.ceil(words / 200))

    return {"title": title, "description": description,
            "date": fm.get("date", ""), "read_time": read_time}


def fmt_date(date):
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})", date or "")
    if not m:
        return ""
    year, month, day = int(m.group(1)), int(m.group(2)), int(m.group(3))
    return f"{MONTHS[month]} {day}, {year}"


def meta_line(post):
    date = fmt_date(post["date"])
    read = f"{post['read_time']} min read"
    return f"{date} · {read}" if date else read


def author_block(post, indent):
    return (
        f'{indent}<div className="blog-meta">\n'
        f'{indent}  <img className="blog-avatar" src="{AVATAR}" alt="{AUTHOR}" />\n'
        f'{indent}  <div className="blog-author">\n'
        f'{indent}    <span className="name">{AUTHOR}</span>\n'
        f'{indent}    <span className="sub">{esc(meta_line(post))}</span>\n'
        f'{indent}  </div>\n'
        f'{indent}</div>'
    )


def hero(post, label):
    return (
        f'<a href="/{FEATURED}" className="blog-hero">\n'
        f'  <div className="blog-hero-media">\n'
        f'    <span className="blog-badge">{esc(label)}</span>\n'
        f'  </div>\n'
        f'  <div className="blog-hero-body">\n'
        f'    <span className="blog-card-tag">{esc(label)}</span>\n'
        f'    <h2>{esc(post["title"])}</h2>\n'
        f'    <p>{esc(post["description"])}</p>\n'
        f'{author_block(post, "    ")}\n'
        f'  </div>\n'
        f'</a>'
    )


def card(page_ref, post, label, slug, grad):
    return (
        f'  <a href="/{page_ref}" className="blog-card" data-category="{slug}">\n'
        f'    <div className="blog-card-media {grad}"></div>\n'
        f'    <div className="blog-card-body">\n'
        f'      <span className="blog-card-tag">{esc(label)}</span>\n'
        f'      <h3>{esc(post["title"])}</h3>\n'
        f'      <p>{esc(post["description"])}</p>\n'
        f'{author_block(post, "      ")}\n'
        f'    </div>\n'
        f'  </a>'
    )


def main():
    with open(DOCS_JSON, "r", encoding="utf-8") as fh:
        docs = json.load(fh)

    groups = docs.get("navigation", {}).get("groups", [])

    # Collect (page_ref, label, slug), de-duplicated, preserving first group seen.
    seen = set()
    entries = []
    categories = []  # ordered unique (label, slug)
    for group in groups:
        label, slug = category_for(group.get("group", ""))
        if (label, slug) not in categories and any(
            p != "index" for p in group.get("pages", [])
        ):
            categories.append((label, slug))
        for page_ref in group.get("pages", []):
            if page_ref == "index" or page_ref in seen:
                continue
            seen.add(page_ref)
            entries.append((page_ref, label, slug))

    featured = read_post(FEATURED)
    featured_label = next(
        (lbl for ref, lbl, _ in entries if ref == FEATURED), "Featured"
    )

    pills = ['  <button type="button" className="blog-pill is-active" '
             'data-filter="all" aria-pressed="true">All articles</button>']
    for label, slug in categories:
        pills.append(
            f'  <button type="button" className="blog-pill" '
            f'data-filter="{slug}" aria-pressed="false">{esc(label)}</button>'
        )

    cards = []
    for i, (page_ref, label, slug) in enumerate(entries):
        post = read_post(page_ref)
        cards.append(card(page_ref, post, label, slug, GRADIENTS[i % len(GRADIENTS)]))

    out = []
    out.append("---")
    out.append('title: "Scalar Field Blog"')
    out.append('sidebarTitle: "Overview"')
    out.append('description: "Research notes, strategy write-ups, and insights '
               'from the Scalar Field quantitative trading platform."')
    out.append('mode: "custom"')
    out.append("---")
    out.append("")
    out.append("{/* This page is generated by scripts/build_index.py — "
               "edit that script, not this file. */}")
    out.append("")
    out.append('<div className="blog-wrap">')
    out.append("")
    out.append('<div className="blog-head">')
    out.append("  <h1>Scalar Field Blog</h1>")
    out.append("  <p>Research notes, strategy write-ups, and insights on "
               "building systematic, agentic trading strategies.</p>")
    out.append("</div>")
    out.append("")
    out.append("{/* ---- Featured / hero post ---- */}")
    out.append(hero(featured, featured_label))
    out.append("")
    out.append("{/* ---- Category filter pills (wired up by blog-filter.js) ---- */}")
    out.append('<div className="blog-pills">')
    out.extend(pills)
    out.append("</div>")
    out.append("")
    out.append("{/* ---- Unified, filterable card grid ---- */}")
    out.append('<div className="blog-grid">')
    out.append("")
    out.append("\n\n".join(cards))
    out.append("")
    out.append("</div>")
    out.append("")
    out.append("</div>")
    out.append("")

    with open(INDEX_MDX, "w", encoding="utf-8") as fh:
        fh.write("\n".join(out))

    print(f"Wrote {INDEX_MDX} with {len(cards)} cards across "
          f"{len(categories)} categories.")


if __name__ == "__main__":
    main()
