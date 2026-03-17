# File Converter

## Skill ID
`file-converter`

## Description
Convert between file formats: text, JSON, CSV, XML, YAML, HTML, Markdown, and more.

## When to Activate
- User asks to "convert" data from one format to another
- User provides data in one format and needs it in another
- User asks to "export as" or "save as" a different format

## Instructions

1. **Detect input format**: Identify the source format from the data structure.

2. **Supported conversions**:

| From → To | JSON | CSV | XML | YAML | HTML | Markdown | Plain Text |
|-----------|------|-----|-----|------|------|----------|------------|
| JSON      | -    | ✓   | ✓   | ✓    | ✓    | ✓        | ✓          |
| CSV       | ✓    | -   | ✓   | ✓    | ✓    | ✓        | ✓          |
| XML       | ✓    | ✓   | -   | ✓    | ✓    | ✓        | ✓          |
| Markdown  | -    | -   | -   | -    | ✓    | -        | ✓          |
| HTML      | -    | -   | -   | -    | -    | ✓        | ✓          |

3. **Use terminal for conversions**:
```js
// JSON to CSV
const data = [{name:"Alice",age:30},{name:"Bob",age:25}];
const headers = Object.keys(data[0]).join(',');
const rows = data.map(r => Object.values(r).join(','));
console.log([headers, ...rows].join('\n'));
```

4. **Preserve data integrity**:
   - Handle special characters (quotes, commas, newlines)
   - Maintain data types where possible
   - Warn about lossy conversions (e.g., nested JSON to flat CSV)
   - Escape properly for the target format

5. **Output**: Provide the converted content in a code block with the appropriate language tag.

### Common Patterns
- JSON → CSV: Flatten nested objects, use dot notation for nested keys
- CSV → JSON: Auto-detect types (number, boolean, string)
- Markdown → HTML: Convert headings, lists, links, emphasis
- Any → Markdown Table: Align columns, handle long values
