# Debugger

## Skill ID
`debugger`

## Description
Debug code issues: identify bugs, trace errors, explain stack traces, and provide fixes.

## When to Activate
- User shares an error message or stack trace
- User says code "doesn't work" or "crashes"
- User asks why their code produces wrong output
- User asks to fix or debug code

## Instructions

### Debugging Process

1. **Read the error carefully**:
   - Error type (TypeError, SyntaxError, ReferenceError, etc.)
   - Error message (what specifically went wrong)
   - Stack trace (where it happened)
   - Line numbers and file names

2. **Identify the root cause** (not just the symptom):
   - What value was unexpected?
   - What assumption was wrong?
   - What edge case was missed?

3. **Common bug patterns**:

| Error | Likely Cause |
|-------|-------------|
| `undefined is not a function` | Wrong method name, missing import, wrong `this` |
| `Cannot read property of null` | Async data not loaded yet, missing null check |
| `Unexpected token` | Missing bracket/paren/quote, wrong syntax |
| `Maximum call stack exceeded` | Infinite recursion, circular reference |
| `CORS error` | Backend missing CORS headers, wrong URL |
| `Module not found` | Wrong import path, missing dependency |
| Off-by-one | `<` vs `<=`, index starting at 0 vs 1 |
| Race condition | Missing await, parallel state mutations |

4. **Test the fix** using `<terminal_exec>`:
```js
// Reproduce the bug
try {
  buggyCode();
} catch(e) {
  console.log('Bug confirmed:', e.message);
}

// Test the fix
try {
  fixedCode();
  console.log('Fix works!');
} catch(e) {
  console.log('Still broken:', e.message);
}
```

### Output Format
```
**Bug**: [what's wrong]
**Cause**: [why it happens]
**Fix**: [how to fix it]

[code diff or corrected code]
```

### Guidelines
- Reproduce the issue before fixing
- Fix the root cause, not the symptom
- Explain why the fix works
- Suggest how to prevent similar bugs
