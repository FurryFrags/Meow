# Content Extractor

## Skill ID
`content-extractor`

## Description
Extract clean article text, main content, metadata, and media from web pages, removing ads and navigation.

## When to Activate
- User shares a URL and wants to read the content
- User asks to "extract", "get the text", or "read this article"
- User wants clean content without ads/navigation
- User needs metadata (author, date, title) from a page

## Instructions

1. **Fetch content**: Use `<read_url>` for fast text extraction, or `<browser_navigate>` + `<browser_read/>` for full page analysis.

2. **Extract main content**:
   - Article body text (remove navigation, sidebars, footers, ads)
   - Title and subtitle
   - Author and publication date
   - Featured image descriptions
   - Embedded media references

3. **Clean the output**:
   - Remove duplicate text
   - Fix encoding issues
   - Preserve paragraph structure
   - Maintain heading hierarchy
   - Keep important links inline

4. **Metadata extraction**:
```
Title: [article title]
Author: [author name]
Date: [publication date]
Source: [website name]
URL: [original URL]
Word Count: [approximate]
Reading Time: [estimate]
```

5. **For paywalled content**: The system has automatic fallbacks (Jina Reader, Wayback Machine, 12ft.io) that handle most paywalls transparently.

### Multi-page Articles
- Detect "Next page" or "Continue reading" links
- Use browser agent to navigate through all pages
- Combine content into a single coherent text

### Output Options
- **Full text**: Complete extracted article
- **Summary**: Key points only (combine with summarizer skill)
- **Structured**: JSON with title, author, date, content, links
