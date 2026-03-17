# Web Scraper

## Skill ID
`web-scraper`

## Description
Extract structured data from websites including tables, lists, prices, contact info, and more.

## When to Activate
- User asks to "scrape", "extract", or "pull data from" a website
- User needs structured data from a webpage (prices, listings, tables)
- User wants to compare information across multiple pages

## Instructions

1. **Fetch the page**: Use `<read_url>` or `<browser_navigate>` to load the target page.

2. **Identify data structure**: After reading the page, determine:
   - Is the data in tables, lists, cards, or free text?
   - Are there multiple pages (pagination)?
   - Is the data loaded dynamically (SPA)?

3. **Extract data patterns**:
   - **Tables**: Parse rows and columns into structured format
   - **Lists**: Extract items with their attributes
   - **Cards/Items**: Identify repeated patterns (product cards, articles, etc.)
   - **Contact info**: Email, phone, address patterns

4. **For dynamic sites**: Use the browser agent to:
   - Navigate and interact with the page
   - Click "Load More" or pagination buttons
   - Wait for dynamic content to load
   - Read content after JavaScript rendering

5. **Output structured results** as:
   - JSON objects for programmatic use
   - Markdown tables for readability
   - CSV format for spreadsheet import

### Extraction Strategies
- Use `<browser_read/>` for full page content with links and inputs
- Use `<browser_find>` to locate specific elements
- Use `<browser_click>` to navigate pagination
- Chain multiple reads across pages for comprehensive data

### Ethics
- Respect robots.txt and rate limits
- Don't scrape personal data without consent
- Attribute sources when sharing extracted data
- Inform user of any legal considerations
