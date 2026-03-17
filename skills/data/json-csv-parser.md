# JSON & CSV Parser

## Skill ID
`json-csv-parser`

## Description
Parse, transform, query, and convert between JSON, CSV, and other structured data formats.

## When to Activate
- User provides JSON or CSV data
- User asks to convert between data formats
- User needs to filter, sort, or transform structured data
- User wants to extract fields from JSON

## Instructions

1. **Auto-detect format**: Identify if input is JSON, CSV, TSV, or other structured format.

2. **Parse and validate**: Check for syntax errors and fix common issues.

3. **Common operations**:
   - **Convert**: JSON to CSV, CSV to JSON, JSON to table
   - **Filter**: Extract rows/objects matching criteria
   - **Transform**: Rename fields, compute new columns, reshape
   - **Query**: Find specific values, aggregate, group by
   - **Sort**: Order by any field
   - **Deduplicate**: Remove duplicate entries

4. **Use terminal for processing**:
```js
// Parse CSV to objects
const csv = `name,age,city\nAlice,30,NYC\nBob,25,LA`;
const lines = csv.split('\n');
const headers = lines[0].split(',');
const data = lines.slice(1).map(l => {
  const vals = l.split(',');
  return Object.fromEntries(headers.map((h,i) => [h, vals[i]]));
});
console.log(JSON.stringify(data, null, 2));
```

5. **Display results** in markdown tables when helpful:
```
| name  | age | city |
|-------|-----|------|
| Alice | 30  | NYC  |
| Bob   | 25  | LA   |
```

### Error Handling
- Fix trailing commas in JSON
- Handle quoted CSV fields with commas
- Detect and report encoding issues
- Suggest schema fixes for malformed data
