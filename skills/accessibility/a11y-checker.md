# Accessibility Checker

## Skill ID
`a11y-checker`

## Description
Audit web content and code for accessibility compliance (WCAG 2.1), identify issues, and suggest fixes.

## When to Activate
- User asks to check accessibility of a webpage or code
- User mentions WCAG, ADA, a11y, or accessibility
- User shares HTML/CSS and wants it to be accessible
- User asks about screen reader compatibility

## Instructions

### Audit Checklist (WCAG 2.1 AA)

**Perceivable**:
- [ ] All images have alt text
- [ ] Videos have captions and audio descriptions
- [ ] Color is not the only way to convey information
- [ ] Text has sufficient contrast (4.5:1 for normal, 3:1 for large)
- [ ] Content can be resized to 200% without loss
- [ ] Content is readable without CSS

**Operable**:
- [ ] All functionality available via keyboard
- [ ] No keyboard traps
- [ ] Skip navigation link present
- [ ] Page titles are descriptive
- [ ] Focus order is logical
- [ ] Focus indicator is visible
- [ ] No content flashes more than 3 times/second

**Understandable**:
- [ ] Language is declared (`lang` attribute)
- [ ] Navigation is consistent across pages
- [ ] Form labels are associated with inputs
- [ ] Error messages are clear and helpful
- [ ] Instructions don't rely on sensory characteristics

**Robust**:
- [ ] Valid HTML (proper nesting, closing tags)
- [ ] ARIA roles used correctly
- [ ] Custom components have proper ARIA attributes
- [ ] Content works across browsers and assistive tech

### For Web Pages
Use `<browser_navigate>` + `<browser_read/>` to analyze the page structure, then check:
- Heading hierarchy (h1 → h2 → h3, no skips)
- Link text (avoid "click here", "read more")
- Form labels and error handling
- ARIA landmarks (main, nav, banner, contentinfo)

### For Code Review
Check HTML/JSX for:
```html
<!-- Bad -->
<div onclick="...">Click me</div>
<img src="photo.jpg">
<input type="text">

<!-- Good -->
<button onclick="...">Click me</button>
<img src="photo.jpg" alt="Description of image">
<label for="name">Name</label><input id="name" type="text">
```

### Output Format
```
## Accessibility Audit

### Critical Issues (Must Fix)
1. [issue] — [WCAG criterion]
   Fix: [solution]

### Warnings (Should Fix)
1. [issue] — [WCAG criterion]
   Fix: [solution]

### Passed Checks
- [what's already good]

### Score: X/10
```
