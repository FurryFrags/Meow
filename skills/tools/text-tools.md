# Text Tools

## Skill ID
`text-tools`

## Description
Manipulate, transform, and analyze text: encoding/decoding, case conversion, counting, formatting, and more.

## When to Activate
- User needs to encode/decode text (Base64, URL, HTML entities)
- User asks for text transformation (case, trim, pad, wrap)
- User wants word/character/line counts
- User needs text diffing, deduplication, or sorting

## Instructions

### Encoding & Decoding
Use `<terminal_exec>` for all encoding operations:
```js
// Base64
console.log(btoa('Hello World'));        // Encode
console.log(atob('SGVsbG8gV29ybGQ=')); // Decode

// URL encoding
console.log(encodeURIComponent('hello world & more'));
console.log(decodeURIComponent('hello%20world%20%26%20more'));

// HTML entities
const escaped = text.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
```

### Text Transformations
- **Case**: UPPER, lower, Title Case, camelCase, snake_case, kebab-case, CONSTANT_CASE
- **Trim**: Remove whitespace, blank lines, trailing spaces
- **Wrap**: Word wrap at N characters
- **Pad**: Left/right pad to fixed width
- **Reverse**: Reverse characters or words
- **Slug**: Convert to URL-friendly slug

### Text Analysis
```js
const text = "your text here";
console.log("Characters:", text.length);
console.log("Words:", text.split(/\s+/).filter(Boolean).length);
console.log("Lines:", text.split('\n').length);
console.log("Sentences:", text.split(/[.!?]+/).filter(Boolean).length);
console.log("Unique words:", new Set(text.toLowerCase().split(/\s+/)).size);
```

### Advanced Operations
- **Diff**: Compare two texts and highlight changes
- **Sort lines**: Alphabetical, numerical, by length
- **Deduplicate**: Remove duplicate lines
- **Find & replace**: With regex support
- **Extract**: Pull out emails, URLs, numbers, dates from text
