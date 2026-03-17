# Keyboard Navigation

## Skill ID
`keyboard-navigation`

## Description
Ensure web interfaces are fully operable via keyboard, implement focus management, and build keyboard-friendly components.

## When to Activate
- User asks about keyboard accessibility
- User needs to make components keyboard-navigable
- User is building custom interactive elements
- User reports keyboard navigation issues

## Instructions

### Essential Keyboard Interactions

| Key | Action |
|-----|--------|
| Tab | Move to next focusable element |
| Shift+Tab | Move to previous focusable element |
| Enter | Activate button/link |
| Space | Toggle checkbox, activate button |
| Escape | Close modal/dropdown/popup |
| Arrow keys | Navigate within widgets (tabs, menus, radios) |
| Home/End | Jump to first/last item in a list |

### Focusable Elements (by default)
- `<a href="...">` - Links
- `<button>` - Buttons
- `<input>`, `<textarea>`, `<select>` - Form controls
- Elements with `tabindex="0"` - Custom focusable elements

### Focus Management Patterns

**Skip Navigation**:
```html
<a href="#main-content" class="skip-link">Skip to main content</a>
<!-- ... navigation ... -->
<main id="main-content" tabindex="-1">
```

**Focus Trap (Modals)**:
```js
// Trap focus within a modal
function trapFocus(modal) {
  const focusable = modal.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  modal.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      }
    }
    if (e.key === 'Escape') closeModal();
  });
  first.focus();
}
```

**Roving Tabindex (Tab Lists, Menus)**:
```js
// Only one item in the group is tabbable
items.forEach((item, i) => {
  item.tabIndex = i === activeIndex ? 0 : -1;
});
// Arrow keys move between items
container.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight') activateNext();
  if (e.key === 'ArrowLeft') activatePrev();
});
```

### Visible Focus Styles
```css
/* Remove default only if replacing with custom */
:focus-visible {
  outline: 2px solid #7ce08a;
  outline-offset: 2px;
}

/* Don't hide focus for keyboard users */
/* Never use: *:focus { outline: none; } */
```

### Testing
1. Unplug your mouse / disable trackpad
2. Navigate entire page with Tab
3. Ensure all actions are possible via keyboard
4. Check that focus is never lost or trapped unexpectedly
5. Verify focus order matches visual layout
