# Code Explainer

## Skill ID
`explainer`

## Description
Explain code line-by-line, break down complex algorithms, and teach programming concepts with clear examples.

## When to Activate
- User asks "what does this code do?"
- User asks to explain a function, algorithm, or pattern
- User wants to understand how something works
- User is learning and needs concepts explained

## Instructions

### Explanation Levels

1. **High-level overview**: What does the code accomplish? (1-2 sentences)
2. **Section breakdown**: What does each major block do?
3. **Line-by-line**: What does each line do and why?
4. **Deep dive**: How does the underlying mechanism work?

### Explanation Format

```
## What This Code Does
[1-2 sentence summary]

## How It Works
### Step 1: [section name]
[explanation of what this part does and why]

### Step 2: [section name]
[explanation continues...]

## Key Concepts
- **[concept]**: [brief explanation]

## Example Walkthrough
Given input X, here's what happens:
1. [step with actual values]
2. [next step with actual values]
3. Result: [output]
```

### Teaching Techniques
- Use analogies for complex concepts
- Walk through with concrete examples
- Highlight the "why" not just the "what"
- Build from simple to complex
- Use visual representations when helpful:
```
Array: [3, 1, 4, 1, 5]
        ↓  ↓  ↓
Sort:  [1, 1, 3, 4, 5]
```

### Common Patterns to Explain
- Closures, callbacks, promises, async/await
- Recursion vs iteration
- Design patterns (singleton, observer, factory, etc.)
- Data structures (linked list, tree, hash map, etc.)
- Algorithms (sorting, searching, graph traversal)
- Functional concepts (map, reduce, filter, compose)

### Guidelines
- Match explanation depth to user's apparent level
- Don't assume knowledge of jargon
- Provide runnable examples when possible
- Link concepts to practical use cases
