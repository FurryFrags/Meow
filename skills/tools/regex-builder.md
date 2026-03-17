# Regex Builder

## Skill ID
`regex-builder`

## Description
Build, test, explain, and debug regular expressions for any programming language.

## When to Activate
- User asks to create a regex or regular expression
- User needs to match, extract, or validate text patterns
- User asks to explain or debug an existing regex
- User needs pattern matching for emails, URLs, dates, etc.

## Instructions

1. **Understand the requirement**: What text should match? What should not match?

2. **Build the regex** with clear annotations:
```
/^(?<year>\d{4})-(?<month>0[1-9]|1[0-2])-(?<day>0[1-9]|[12]\d|3[01])$/
 ^  ^^^^^^^^^^^^^^^^  ^^^^^^^^^^^^^^^^^^^^  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^ ^
 |  Year: 4 digits    Month: 01-12         Day: 01-31                   |
 Start                                                                  End
```

3. **Test with examples** using terminal:
```js
const regex = /pattern/flags;
const tests = ["match1", "match2", "no-match1"];
tests.forEach(t => console.log(`"${t}" → ${regex.test(t)}`));
```

4. **Common patterns library**:
   - **Email**: `/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/`
   - **URL**: `/^https?:\/\/[^\s/$.?#].[^\s]*$/`
   - **Phone (US)**: `/^\+?1?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}$/`
   - **Date (ISO)**: `/^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/`
   - **IP Address**: `/^(?:\d{1,3}\.){3}\d{1,3}$/`
   - **Hex Color**: `/^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/`

5. **Explain existing regex**: Break down each component with plain-language descriptions.

### Flags Reference
- `g` - Global: find all matches
- `i` - Case-insensitive
- `m` - Multiline: ^ and $ match line boundaries
- `s` - Dotall: . matches newlines
- `u` - Unicode support
