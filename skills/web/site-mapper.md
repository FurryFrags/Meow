# Site Mapper

## Skill ID
`site-mapper`

## Description
Map website structure, discover pages, analyze navigation hierarchy, and generate sitemaps.

## When to Activate
- User asks to "map" a website or understand its structure
- User needs to find all pages or sections on a site
- User wants a sitemap or navigation overview
- User is auditing a website's architecture

## Instructions

1. **Start from the homepage**: Use `<browser_navigate>` to load the main page.

2. **Read navigation**: Use `<browser_read/>` to extract all links.

3. **Categorize links**:
   - **Internal**: Same domain, part of the site structure
   - **External**: Links to other domains
   - **Resource**: CSS, JS, images, PDFs
   - **Anchor**: Same-page navigation (#sections)

4. **Build the site tree**:
```
example.com/
├── /about
│   ├── /about/team
│   └── /about/careers
├── /products
│   ├── /products/category-a
│   └── /products/category-b
├── /blog
│   ├── /blog/post-1
│   └── /blog/post-2
└── /contact
```

5. **Analyze structure**:
   - Depth: How many levels deep?
   - Breadth: How many pages per level?
   - Orphans: Pages not linked from navigation
   - Dead links: Links that return errors

6. **Multi-tab exploration**: Use `<browser_new_tab>` to explore sections in parallel.

### Output Format
- ASCII tree for visual hierarchy
- Table with URL, title, depth, links count
- Summary statistics (total pages, avg depth, etc.)
