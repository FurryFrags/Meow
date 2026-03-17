# Screen Reader Guide

## Skill ID
`screen-reader-guide`

## Description
Optimize web content for screen readers, write proper ARIA attributes, and ensure assistive technology compatibility.

## When to Activate
- User asks about screen reader compatibility
- User needs ARIA attributes for custom components
- User is building accessible web components
- User asks how assistive technology interprets their code

## Instructions

### ARIA Roles & Properties

**Landmark Roles**:
```html
<header role="banner">        <!-- Site header -->
<nav role="navigation">        <!-- Navigation -->
<main role="main">             <!-- Main content -->
<aside role="complementary">   <!-- Sidebar -->
<footer role="contentinfo">    <!-- Site footer -->
<form role="search">           <!-- Search form -->
```

**Widget Roles**:
```html
<div role="alert">             <!-- Important message -->
<div role="dialog">            <!-- Modal dialog -->
<div role="tablist">           <!-- Tab container -->
<div role="tab">               <!-- Individual tab -->
<div role="tabpanel">          <!-- Tab content -->
<div role="status">            <!-- Status update -->
<div role="progressbar">       <!-- Progress indicator -->
```

### Common ARIA Attributes
```html
aria-label="Description"       <!-- Labels element when no visible text -->
aria-labelledby="id"           <!-- Points to element that labels this -->
aria-describedby="id"          <!-- Points to element that describes this -->
aria-hidden="true"             <!-- Hides from screen readers -->
aria-expanded="true/false"     <!-- Expandable sections -->
aria-selected="true/false"     <!-- Selected state (tabs, options) -->
aria-live="polite/assertive"   <!-- Dynamic content announcements -->
aria-required="true"           <!-- Required form fields -->
aria-invalid="true"            <!-- Invalid form input -->
aria-current="page"            <!-- Current item in navigation -->
```

### Custom Component Patterns

**Accordion**:
```html
<h3>
  <button aria-expanded="false" aria-controls="panel1">Section Title</button>
</h3>
<div id="panel1" role="region" aria-labelledby="btn1" hidden>Content</div>
```

**Modal Dialog**:
```html
<div role="dialog" aria-labelledby="title" aria-modal="true">
  <h2 id="title">Dialog Title</h2>
  <p>Content</p>
  <button>Close</button>
</div>
```

**Live Region** (for dynamic updates):
```html
<div aria-live="polite" aria-atomic="true">
  <!-- Screen reader announces when content changes -->
  3 new messages
</div>
```

### Testing Approach
1. Navigate the page using only keyboard (Tab, Enter, Escape, Arrow keys)
2. Check that all interactive elements are focusable
3. Verify focus order matches visual order
4. Ensure all content is announced by screen readers
5. Test with dynamic content changes

### Golden Rules
1. Use semantic HTML first, ARIA only when needed
2. Don't use `role="presentation"` on focusable elements
3. All interactive elements need accessible names
4. Dynamic changes need `aria-live` regions
5. Test with actual screen readers when possible
