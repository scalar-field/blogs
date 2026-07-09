#!/usr/bin/env python3
"""Build the blog from docs.json (the single source of truth).

For every page listed in a navigation group this script:

1. Normalizes the post file so it reads like a blog article:
   - ensures frontmatter has `title`, `description`, and `mode: "center"`
   - removes a duplicate leading H1 (the title is rendered from frontmatter)
2. Regenerates `index.mdx` — the mintlify.com/blog-style landing grid.
3. Regenerates `sf-post-data.js` — per-post metadata (category, date,
   read time, related posts) consumed by `blog-post.js` to render the
   article header and "More blog posts" section.

Run this whenever posts are added or removed:

    python3 scripts/build_index.py
"""
import json
import math
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCS_JSON = os.path.join(ROOT, "docs.json")
INDEX_MDX = os.path.join(ROOT, "index.mdx")
POST_DATA_JS = os.path.join(ROOT, "sf-post-data.js")

AVATAR = "/favicon.svg"
AUTHOR = "Scalar Field"
FEATURED = "strategies/ncav-strategy"
CARD_IMAGE_BASE = "https://d32mg6h25qsrpf.cloudfront.net/general_assets/blogs/"


def card_image(page_ref):
    """Card/hero artwork URL from the page slug: blogs/{slug}.png."""
    return CARD_IMAGE_BASE + page_ref.rsplit("/", 1)[-1] + ".png"


FEATURED_IMAGE = card_image(FEATURED)

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
    return CATEGORY.get(group, (group, slugify(group)))


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
    text = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", text)
    text = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", text)
    text = re.sub(r"[*_`>#]", "", text)
    return re.sub(r"\s+", " ", text).strip()


def truncate(text, limit=150):
    if len(text) <= limit:
        return text
    return text[:limit].rsplit(" ", 1)[0].rstrip(",.;:—- ") + "…"


def split_frontmatter(raw):
    """Return (list_of_fm_lines, body). fm_lines is [] when no frontmatter."""
    if not raw.startswith("---"):
        return [], raw
    end = raw.find("\n---", 3)
    if end == -1:
        return [], raw
    block = raw[3:end].strip("\n")
    body = raw[end + 4:]
    if body.startswith("\n"):
        body = body[1:]
    return block.split("\n"), body


def fm_get(fm_lines, key):
    for line in fm_lines:
        m = re.match(rf"^{re.escape(key)}:\s*(.*)$", line)
        if m:
            return m.group(1).strip().strip('"').strip("'")
    return None


def first_h1(body):
    m = re.search(r"^#\s+(.+)$", body, re.MULTILINE)
    return clean_inline(m.group(1)) if m else None


def first_paragraph(body):
    for para in re.split(r"\n\s*\n", body):
        line = para.strip()
        if not line or line.startswith(("#", "---", "!", "|", "<", "$$", "{")):
            continue
        cleaned = clean_inline(line)
        if cleaned:
            return cleaned
    return ""


def strip_leading_h1(body):
    """Remove the first leading H1 (and trailing blank line) from the body."""
    lines = body.split("\n")
    i = 0
    while i < len(lines) and lines[i].strip() == "":
        i += 1
    if i < len(lines) and re.match(r"^#\s+\S", lines[i]):
        del lines[i]
        while i < len(lines) and lines[i].strip() == "":
            del lines[i]
        return "\n".join(lines)
    return body


def file_for(page_ref):
    for ext in (".mdx", ".md"):
        candidate = os.path.join(ROOT, page_ref + ext)
        if os.path.exists(candidate):
            return candidate
    return None


def quote(value):
    return '"' + value.replace('"', '\\"') + '"'


def normalize_post(page_ref):
    """Ensure frontmatter (title/description/mode) and strip duplicate H1.

    Returns metadata dict: {title, description, date, read_time}.
    """
    path = file_for(page_ref)
    if path is None:
        return {"title": humanize(page_ref), "description": "",
                "date": "", "read_time": 1}

    with open(path, "r", encoding="utf-8") as fh:
        raw = fh.read()

    fm_lines, body = split_frontmatter(raw)

    title = fm_get(fm_lines, "title") or first_h1(body) or humanize(page_ref)
    description = fm_get(fm_lines, "description") or truncate(first_paragraph(body))
    date = fm_get(fm_lines, "date") or ""

    # Drop a duplicate leading H1 so the frontmatter title isn't repeated.
    body = strip_leading_h1(body)

    # Rebuild frontmatter, preserving existing keys and adding the rest.
    have = {re.match(r"^([A-Za-z0-9_]+):", ln).group(1)
            for ln in fm_lines if re.match(r"^([A-Za-z0-9_]+):", ln)}
    new_lines = list(fm_lines)
    if "title" not in have:
        new_lines.insert(0, f"title: {quote(title)}")
    if "description" not in have and description:
        idx = next((i for i, ln in enumerate(new_lines)
                    if ln.startswith("title:")), 0)
        new_lines.insert(idx + 1, f"description: {quote(description)}")
    if "mode" not in have:
        new_lines.append('mode: "center"')

    rebuilt = "---\n" + "\n".join(new_lines) + "\n---\n\n" + body.lstrip("\n")
    if rebuilt != raw:
        with open(path, "w", encoding="utf-8") as fh:
            fh.write(rebuilt)

    words = len(re.findall(r"\w+", body))
    read_time = max(1, math.ceil(words / 200))

    return {"title": title, "description": description,
            "date": date, "read_time": read_time}


def fmt_date(date):
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})", date or "")
    if not m:
        return ""
    return f"{MONTHS[int(m.group(2))]} {int(m.group(3))}, {int(m.group(1))}"


def meta_line(post):
    date = fmt_date(post["date"])
    read = f"{post['read_time']} min read"
    return f"{date} · {read}" if date else read


def author_block(post, indent):
    return (
        f'{indent}<div className="blog-meta">\n'
        f'{indent}  <span className="blog-avatar" role="img" aria-label="{AUTHOR}" />\n'
        f'{indent}  <div className="blog-author">\n'
        f'{indent}    <span className="name">{AUTHOR}</span>\n'
        f'{indent}    <span className="sub">{esc(meta_line(post))}</span>\n'
        f'{indent}  </div>\n'
        f'{indent}</div>'
    )


def hero(post, label):
    return (
        f'<a href="/{FEATURED}" className="blog-hero">\n'
        f'  <img className="blog-hero-img" src="{FEATURED_IMAGE}" '
        f'alt="{esc(post["title"])}" />\n'
        f'  <div className="blog-hero-content">\n'
        f'    <span className="blog-hero-eyebrow">{esc(label)}</span>\n'
        f'    <h2>{esc(post["title"])}</h2>\n'
        f'    <p>{esc(post["description"])}</p>\n'
        f'{author_block(post, "    ")}\n'
        f'  </div>\n'
        f'</a>'
    )


def card(page_ref, post, label, slug):
    image = card_image(page_ref)
    media = (
        f'    <div className="blog-card-media">'
        f'<img src="{image}" alt="{esc(post["title"])}" /></div>\n'
    )
    return (
        f'  <a href="/{page_ref}" className="blog-card" data-category="{slug}">\n'
        f'{media}'
        f'    <div className="blog-card-body">\n'
        f'      <span className="blog-card-tag">{esc(label)}</span>\n'
        f'      <h3>{esc(post["title"])}</h3>\n'
        f'      <p>{esc(post["description"])}</p>\n'
        f'    </div>\n'
        f'  </a>'
    )


def write_index(entries, posts, categories):
    featured = posts[FEATURED]
    featured_label = next((lbl for ref, lbl, _ in entries if ref == FEATURED),
                          "Featured")

    pills = ['  <button type="button" className="blog-pill is-active" '
             'data-filter="all" aria-pressed="true">All articles</button>']
    for label, slug in categories:
        pills.append(
            f'  <button type="button" className="blog-pill" '
            f'data-filter="{slug}" aria-pressed="false">{esc(label)}</button>'
        )

    cards = [
        card(ref, posts[ref], label, slug)
        for ref, label, slug in entries
    ]

    out = [
        "---",
        'title: "Scalar Field Blog"',
        'sidebarTitle: "Overview"',
        'description: "Research notes, strategy write-ups, and insights '
        'from the Scalar Field quantitative trading platform."',
        'mode: "custom"',
        "---",
        "",
        "{/* Generated by scripts/build_index.py — edit that script, not this file. */}",
        "",
        '<div className="blog-wrap">',
        "",
        "{/* ---- Featured / hero post ---- */}",
        hero(featured, featured_label),
        "",
        "{/* ---- Category filter pills (wired up by blog-filter.js) ---- */}",
        '<div className="blog-pills">',
        *pills,
        "</div>",
        "",
        "{/* ---- Unified, filterable card grid ---- */}",
        '<div className="blog-grid">',
        "",
        "\n\n".join(cards),
        "",
        "</div>",
        "",
        "</div>",
        "",
    ]
    with open(INDEX_MDX, "w", encoding="utf-8") as fh:
        fh.write("\n".join(out))
    return len(cards)


def write_post_data(entries, posts):
    records = []
    for ref, label, slug in entries:
        post = posts[ref]
        records.append({
            "path": "/" + ref,
            "title": post["title"],
            "category": label,
            "slug": slug,
            "date": fmt_date(post["date"]),
            "readTime": post["read_time"],
            "image": card_image(ref),
        })
    payload = {"author": AUTHOR, "avatar": AVATAR, "posts": records}
    body = (
        "/* Generated by scripts/build_index.py — do not edit by hand. */\n"
        "window.__SF_BLOG = " + json.dumps(payload, ensure_ascii=False, indent=2)
        + ";\n"
    )
    with open(POST_DATA_JS, "w", encoding="utf-8") as fh:
        fh.write(body)


def main():
    with open(DOCS_JSON, "r", encoding="utf-8") as fh:
        docs = json.load(fh)

    groups = docs.get("navigation", {}).get("groups", [])

    seen = set()
    entries = []          # (page_ref, label, slug)
    categories = []       # ordered unique (label, slug)
    for group in groups:
        label, slug = category_for(group.get("group", ""))
        real_pages = [p for p in group.get("pages", []) if p != "index"]
        if real_pages and (label, slug) not in categories:
            categories.append((label, slug))
        for page_ref in real_pages:
            if page_ref in seen:
                continue
            seen.add(page_ref)
            entries.append((page_ref, label, slug))

    posts = {ref: normalize_post(ref) for ref, _, _ in entries}

    n_cards = write_index(entries, posts, categories)
    write_post_data(entries, posts)

    print(f"Normalized {len(entries)} posts. "
          f"Wrote index.mdx ({n_cards} cards, {len(categories)} categories) "
          f"and sf-post-data.js.")


if __name__ == "__main__":
    main()
