# Link Checker

## Skill ID
`link-checker`

## Description
Verify links on a webpage, check for broken URLs, redirects, and link health.

## When to Activate
- User asks to check links on a page
- User wants to find broken links
- User is auditing a website
- User needs to verify a list of URLs

## Instructions

1. **Collect links**: Use `<browser_navigate>` + `<browser_read/>` to get all links from a page.

2. **Test each link**: For each URL, attempt to read and check status:
   - Use `<read_url>` to verify accessibility
   - Note any redirects
   - Check if content loads

3. **Categorize results**:
   - **Working** (200): Link loads correctly
   - **Redirect** (301/302): Link redirects to another URL
   - **Broken** (404): Page not found
   - **Error** (500+): Server error
   - **Timeout**: No response within limit
   - **Blocked**: Access denied or CORS blocked

4. **Report format**:
```
Link Health Report for [URL]
Total links: X
├── Working: X (XX%)
├── Redirects: X (XX%)
├── Broken: X (XX%)
└── Errors: X (XX%)

Broken Links:
- [link text](URL) → 404 Not Found
- [link text](URL) → Timeout
```

### Priority
- Check internal links first (same domain)
- Then external links
- Flag any suspicious or potentially harmful links
