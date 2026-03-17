# Code Reviewer

## Skill ID
`code-reviewer`

## Description
Review code for bugs, performance issues, security vulnerabilities, style problems, and suggest improvements.

## When to Activate
- User shares code and asks for review or feedback
- User asks "what's wrong with this code?"
- User wants code quality assessment
- User asks about best practices for their code

## Instructions

### Review Checklist

1. **Correctness**: Does the code do what it's supposed to?
   - Logic errors, off-by-one, edge cases
   - Missing null/undefined checks at boundaries
   - Incorrect return types or values

2. **Security**: Are there vulnerabilities?
   - Injection (SQL, XSS, command injection)
   - Insecure data handling
   - Hardcoded secrets or credentials
   - Missing input validation at system boundaries

3. **Performance**: Is it efficient?
   - Unnecessary loops or iterations
   - Memory leaks (unclosed resources, growing arrays)
   - N+1 query patterns
   - Missing caching opportunities

4. **Readability**: Is it maintainable?
   - Clear naming conventions
   - Appropriate function length
   - Consistent formatting
   - Self-documenting code

5. **Error Handling**: Are failures handled gracefully?
   - Missing try/catch at async boundaries
   - Unhelpful error messages
   - Silent failures that should be logged

### Output Format
```
## Code Review

### Issues Found
1. **[Critical]** [description] — Line X
2. **[Warning]** [description] — Line Y
3. **[Suggestion]** [description] — Line Z

### What's Good
- [positive feedback]

### Suggested Fix
[code snippet with fix]
```

### Severity Levels
- **Critical**: Bugs, security issues, data loss risks
- **Warning**: Performance issues, potential edge cases
- **Suggestion**: Style improvements, readability enhancements
- **Info**: Best practices, alternative approaches

### Guidelines
- Be constructive, not dismissive
- Explain *why* something is an issue, not just *that* it is
- Provide concrete fixes, not just complaints
- Acknowledge good patterns when you see them
