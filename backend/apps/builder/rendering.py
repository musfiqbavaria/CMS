"""Server-side rendering for built sites. Pure functions over models (testable)."""

from django.utils.html import escape


def theme_of(site) -> dict:
    defaults = {
        "colors": {"primary": "#0f172a", "background": "#ffffff", "text": "#0f172a"},
        "fonts": {"heading": "system-ui", "body": "system-ui"},
        "radius": 8,
    }
    if getattr(site, "theme", None) and site.theme.settings:
        merged = dict(defaults)
        merged.update(site.theme.settings)
        return merged
    return defaults


def nav_items(site) -> list:
    menu = site.menus.prefetch_related("items").order_by("id").first()
    if menu is None:
        return [{"label": "Home", "url": "/"}]
    return [{"label": i.label, "url": i.url} for i in menu.items.all()]


def shell(site, *, title: str, description: str, body: str) -> str:
    t = theme_of(site)
    c, f = t["colors"], t["fonts"]
    links = "".join(
        f'<a href="{escape(i["url"])}" style="margin:0 10px;color:inherit;text-decoration:none">{escape(i["label"])}</a>'
        for i in nav_items(site)
    )
    return f"""<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{escape(title)}</title>
<meta name="description" content="{escape(description)}">
<style>body{{margin:0;font-family:{escape(f['body'])};color:{escape(c['text'])};background:{escape(c['background'])}}}h1,h2,h3{{font-family:{escape(f['heading'])}}}a{{color:{escape(c['primary'])}}}.wrap{{max-width:960px;margin:0 auto;padding:24px}}</style>
</head><body>
<header style="border-bottom:1px solid #eee"><div class="wrap" style="display:flex;gap:16px;align-items:center"><strong>{escape(site.name)}</strong><nav>{links}</nav></div></header>
<main class="wrap">{body}</main>
<footer style="border-top:1px solid #eee;margin-top:32px"><div class="wrap"><p>© {escape(site.name)}</p></div></footer>
</body></html>"""


def render_section(site, section) -> str:
    s = section.settings or {}
    t = section.type
    e = escape
    if t == "hero":
        button = ""
        if s.get("primary_label"):
            url = e(s.get("primary_url", "/"))
            label = e(s.get("primary_label", ""))
            button = f'<p><a href="{url}">{label}</a></p>'
        return (
            f"<section style=\"padding:64px 0;text-align:center;background:{e(s.get('background', '#f1f5f9'))}\">"
            f"<h1>{e(s.get('heading', ''))}</h1><p>{e(s.get('subheading', ''))}</p>"
            f"{button}</section>"
        )
    if t == "features":
        items = "".join(
            f"<div><h3>{e(i.get('title', ''))}</h3><p>{e(i.get('text', ''))}</p></div>"
            for i in (s.get("items") or [])[:6]
        )
        return f"<section><h2>{e(s.get('title', 'Features'))}</h2>{items}</section>"
    if t == "gallery":
        imgs = "".join(
            f'<img src="{e(u)}" alt="" style="max-width:200px;margin:4px">'
            for u in (s.get("images", []) or [])[:12]
        )
        return f"<section><h2>{e(s.get('title', 'Gallery'))}</h2>{imgs}</section>"
    if t == "testimonials":
        items = "".join(
            f"<blockquote><p>{e(i.get('text', ''))}</p><cite>{e(i.get('author', ''))}</cite></blockquote>"
            for i in (s.get("items") or [])[:6]
        )
        return f"<section><h2>{e(s.get('title', 'Testimonials'))}</h2>{items}</section>"
    if t == "pricing":
        plans = "".join(
            f"<div><h3>{e(p.get('name', ''))} — {e(str(p.get('price', '')))}</h3><p>{e(p.get('blurb', ''))}</p></div>"
            for p in (s.get("plans") or [])[:4]
        )
        return f"<section><h2>{e(s.get('title', 'Pricing'))}</h2>{plans}</section>"
    if t == "faq":
        items = "".join(
            f"<details><summary>{e(i.get('q', ''))}</summary><p>{e(i.get('a', ''))}</p></details>"
            for i in (s.get("items") or [])[:20]
        )
        return f"<section><h2>{e(s.get('title', 'FAQ'))}</h2>{items}</section>"
    if t == "contact":
        return (
            "<section><h2>Contact</h2>"
            f"<p>Email: {e(s.get('email', ''))}</p><p>Phone: {e(s.get('phone', ''))}</p><p>{e(s.get('address', ''))}</p>"
            "</section>"
        )
    if t == "blog_list":
        posts = site.posts.filter(status="published").order_by("-published_at", "-id")[
            : int(s.get("count", 5) or 5)
        ]
        items = "".join(
            f'<p><a href="/blog/{e(p.slug)}/">{e(p.title)}</a></p>' for p in posts
        )
        return f"<section><h2>{e(s.get('title', 'Latest posts'))}</h2>{items or '<p>No posts yet.</p>'}</section>"
    if t == "product_grid":
        qs = site.products.filter(status="published")
        if s.get("category"):
            qs = qs.filter(category__slug=s["category"])
        products = qs.order_by("name")[: int(s.get("count", 8) or 8)]
        items = "".join(
            f'<p><a href="/shop/{e(p.slug)}/">{e(p.name)}</a> — ${p.price}</p>'
            for p in products
        )
        return f"<section><h2>{e(s.get('title', 'Products'))}</h2>{items or '<p>No products yet.</p>'}</section>"
    if t == "custom_html":
        return f"<section>{s.get('html', '')}</section>"  # admin-authored, trusted like custom_js
    return f"<!-- unknown section {e(t)} -->"


def render_page(site, page) -> str:
    sections = "".join(
        render_section(site, s) for s in page.sections.filter(enabled=True)
    )
    seo = page.seo or {}
    return shell(
        site,
        title=seo.get("title") or page.title,
        description=seo.get("description", ""),
        body=f"<h1>{escape(page.title)}</h1>{sections}",
    )


def render_post(site, post) -> str:
    seo = post.seo or {}
    tags = ", ".join(t.name for t in post.tags.all())
    body = (
        f"<h1>{escape(post.title)}</h1>"
        f"<p><em>{escape(post.excerpt)}</em></p>"
        f"<article>{escape(post.body)}</article>"
        f"<p>Category: {escape(post.category.name) if post.category else '—'} · Tags: {escape(tags) or '—'}</p>"
    )
    return shell(
        site,
        title=seo.get("title") or post.title,
        description=seo.get("description") or post.excerpt,
        body=body,
    )


def render_product(site, product) -> str:
    imgs = "".join(
        f'<img src="{escape(u)}" alt="" style="max-width:200px;margin:4px">'
        for u in (product.images or [])[:8]
    )
    variants = "".join(
        f"<li>{escape(v.get('name', ''))}: {escape(str(v.get('price_delta', '')))} (stock {escape(str(v.get('stock', '')))})</li>"
        for v in (product.variants or [])
    )
    body = (
        f"<h1>{escape(product.name)}</h1>{imgs}"
        f"<p>Price: ${product.price}</p>"
        + (f"<p><s>${product.compare_at}</s></p>" if product.compare_at else "")
        + f"<p>{'In stock' if product.stock > 0 else 'Out of stock'} ({product.stock})</p>"
        f"<p>{escape(product.description)}</p>"
        + (f"<h3>Variants</h3><ul>{variants}</ul>" if variants else "")
    )
    return shell(
        site, title=product.name, description=product.description[:160], body=body
    )


def render_home(site) -> str:
    home_id = getattr(site, "homepage_id", None)
    if home_id:
        page = (
            site.pages.filter(pk=home_id, status="published")
            .prefetch_related("sections")
            .first()
        )
        if page is not None:
            return render_page(site, page)
    page = site.pages.filter(status="published", slug__in=["", "home"]).first()
    if page is not None:
        return render_page(site, page)
    page = site.pages.filter(status="published").order_by("title").first()
    if page is not None:
        return render_page(site, page)
    return shell(
        site,
        title=site.name,
        description="",
        body="<h1>Welcome</h1><p>This site has no published pages yet.</p>",
    )


def render_not_found(site) -> str:
    name = site.name if site else "Site"
    base = (
        shell(site, title="Not found", description="", body="<h1>Not found</h1>")
        if site
        else "<h1>Not found</h1>"
    )
    return base.replace("<h1>", f"<h1>{escape(name)} — ", 1) if site else base
