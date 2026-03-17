# Refactorer

## Skill ID
`refactorer`

## Description
Refactor code to improve readability, performance, and maintainability while preserving functionality.

## When to Activate
- User asks to "refactor", "clean up", or "improve" code
- User asks to make code more readable or maintainable
- User wants to optimize performance of existing code
- User asks to modernize legacy code

## Instructions

### Refactoring Principles
1. **Preserve behavior**: The code must do the same thing before and after
2. **Small steps**: Make one improvement at a time
3. **Test between changes**: Verify nothing broke
4. **Simplify**: Reduce complexity, not add it

### Common Refactoring Patterns

| Before | After | When |
|--------|-------|------|
| Nested if/else | Early return / guard clauses | Deep nesting |
| Repeated code blocks | Extracted function (only with 3+ uses) | Actual repetition |
| Magic numbers | Named constants | Unclear meaning |
| Long function | Smaller focused functions | >30 lines with clear sections |
| var | const/let | JavaScript modernization |
| Callbacks | async/await | Promise-based code |
| for loops | map/filter/reduce | Data transformation |
| Switch statement | Object lookup | Simple value mapping |

### Process
1. **Analyze**: Read the code, understand what it does
2. **Identify issues**: List what could be improved
3. **Prioritize**: Fix the biggest improvements first
4. **Refactor**: Make changes step by step
5. **Verify**: Test with `<terminal_exec>` that behavior is preserved

### Output Format
Show before and after with explanation:
```
**Before:**
[original code]

**After:**
[refactored code]

**Changes:**
- [what changed and why]
```

### Guidelines
- Don't over-abstract (3 similar lines > premature utility function)
- Don't change what isn't broken
- Don't add features while refactoring
- Keep the same API/interface unless explicitly asked to change it
