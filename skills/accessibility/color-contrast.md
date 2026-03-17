# Color Contrast Checker

## Skill ID
`color-contrast`

## Description
Check color contrast ratios for WCAG compliance and suggest accessible color combinations.

## When to Activate
- User asks about color contrast or readability
- User provides colors and asks if they're accessible
- User needs help choosing accessible color schemes
- User mentions WCAG contrast requirements

## Instructions

### WCAG Contrast Requirements
| Level | Normal Text | Large Text (18pt+/14pt bold+) |
|-------|-------------|-------------------------------|
| AA    | 4.5:1       | 3:1                           |
| AAA   | 7:1         | 4.5:1                         |
| UI Components | 3:1 | 3:1                          |

### Calculate Contrast Ratio
Use `<terminal_exec>`:
```js
function luminance(r, g, b) {
  const [rs, gs, bs] = [r, g, b].map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function contrastRatio(hex1, hex2) {
  const parse = h => {
    h = h.replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c+c).join('');
    return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
  };
  const l1 = luminance(...parse(hex1));
  const l2 = luminance(...parse(hex2));
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return ((lighter + 0.05) / (darker + 0.05)).toFixed(2);
}

const ratio = contrastRatio('#7ce08a', '#07070b');
console.log('Contrast ratio:', ratio + ':1');
console.log('AA normal text:', ratio >= 4.5 ? 'PASS' : 'FAIL');
console.log('AA large text:', ratio >= 3 ? 'PASS' : 'FAIL');
console.log('AAA normal text:', ratio >= 7 ? 'PASS' : 'FAIL');
```

### Accessible Color Palettes
**Dark backgrounds**:
- `#07070b` bg + `#ffffff` text = 19.5:1 (AAA)
- `#07070b` bg + `#7ce08a` text = check with calculator
- `#07070b` bg + `#88bbcc` text = check with calculator

**Light backgrounds**:
- `#ffffff` bg + `#333333` text = 12.6:1 (AAA)
- `#ffffff` bg + `#0066cc` text = 4.6:1 (AA)

### Output Format
```
Color Pair: [fg] on [bg]
Contrast Ratio: X.XX:1
AA Normal Text (4.5:1): PASS/FAIL
AA Large Text (3:1): PASS/FAIL
AAA Normal Text (7:1): PASS/FAIL
AAA Large Text (4.5:1): PASS/FAIL
```

### Suggestions
When contrast fails, suggest:
- Darker/lighter alternatives
- Specific hex values that would pass
- Visual preview with the suggested colors
