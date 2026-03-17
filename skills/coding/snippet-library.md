# Snippet Library

## Skill ID
`snippet-library`

## Description
Provide ready-to-use code snippets for common tasks across multiple programming languages.

## When to Activate
- User asks "how do I..." followed by a common coding task
- User needs a quick solution for a standard problem
- User asks for a snippet, template, or example

## Instructions

### Categories & Common Snippets

**String Operations**:
- Capitalize, truncate, slug, reverse, pad
- Template literals, string interpolation
- Regex match, replace, split

**Array/List Operations**:
- Sort, filter, map, reduce, flatten
- Unique values, intersection, difference
- Group by, chunk, zip

**Object/Dict Operations**:
- Deep clone, merge, pick, omit
- Transform keys/values
- Flatten/unflatten nested objects

**Date & Time**:
- Format dates, parse strings
- Add/subtract time
- Time ago / relative time

**DOM Manipulation** (JavaScript):
- Query selectors, event listeners
- Create/append/remove elements
- Form handling, validation

**HTTP & Networking**:
- Fetch with error handling
- POST with JSON body
- File upload, download
- WebSocket connection

**File Operations** (Node.js / Python):
- Read/write files
- Directory listing
- Path manipulation

### Output Format
```language
// Task: [what it does]
// Usage: [how to use it]
const snippet = (params) => {
  // implementation
};

// Example:
snippet(example_input); // → expected_output
```

### Quality Standards
- Every snippet should be copy-paste ready
- Include error handling for external operations
- Show expected output in comments
- Use modern language features
- Keep snippets under 20 lines when possible
