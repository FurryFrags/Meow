# Code Generator

## Skill ID
`code-generator`

## Description
Generate code snippets, boilerplates, functions, classes, and complete modules in any programming language.

## When to Activate
- User asks to "write", "create", "generate", or "build" code
- User describes functionality they need implemented
- User asks for a function, class, component, or module
- User needs boilerplate or starter code

## Instructions

### Process

1. **Clarify requirements**: Understand what the code should do, inputs/outputs, language, and constraints.

2. **Choose the right approach**: Pick the simplest solution that meets the requirements.

3. **Write clean code**:
   - Use consistent naming conventions for the language
   - Keep functions small and focused
   - Handle edge cases at boundaries
   - Use appropriate data structures

4. **Include usage example**: Show how to call/use the generated code.

### Language Conventions
- **JavaScript/TypeScript**: camelCase, const/let, arrow functions, async/await
- **Python**: snake_case, type hints, docstrings, list comprehensions
- **HTML/CSS**: semantic elements, BEM or utility classes, responsive design
- **SQL**: UPPERCASE keywords, snake_case columns, parameterized queries
- **Shell/Bash**: snake_case, double quotes for variables, set -e

### Code Quality Standards
- No hardcoded values that should be parameters
- Validate inputs at system boundaries
- Use meaningful variable names
- Keep cyclomatic complexity low
- Follow DRY only when there's genuine repetition

### Output Format
```language
// Description of what this does
function example(params) {
  // implementation
}

// Usage:
// example(values);
```

### Testing
When appropriate, use `<terminal_exec>` to verify the generated code works:
```js
// Test the generated function
const result = generatedFunction(testInput);
console.log('Test:', result === expectedOutput ? 'PASS' : 'FAIL', result);
```
