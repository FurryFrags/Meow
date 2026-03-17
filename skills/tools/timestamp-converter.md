# Timestamp Converter

## Skill ID
`timestamp-converter`

## Description
Convert between date formats, timezones, Unix timestamps, and human-readable dates.

## When to Activate
- User provides a timestamp or date and needs conversion
- User asks about timezones or date math
- User needs to parse or format dates
- User mentions Unix timestamp, epoch, ISO 8601

## Instructions

### Common Conversions
Use `<terminal_exec>` for precise calculations:
```js
// Current timestamp
console.log("Unix (seconds):", Math.floor(Date.now()/1000));
console.log("Unix (ms):", Date.now());
console.log("ISO 8601:", new Date().toISOString());

// Unix to readable
const ts = 1700000000;
const d = new Date(ts * 1000);
console.log(d.toISOString());
console.log(d.toLocaleString('en-US', { timeZone: 'America/New_York' }));

// Parse any date string
const parsed = new Date('March 15, 2024 3:30 PM EST');
console.log("Unix:", Math.floor(parsed.getTime()/1000));
console.log("ISO:", parsed.toISOString());
```

### Date Math
```js
const now = new Date();
const future = new Date(now);
future.setDate(future.getDate() + 30); // 30 days from now
console.log("30 days from now:", future.toISOString());

// Difference between dates
const d1 = new Date('2024-01-01');
const d2 = new Date('2024-12-31');
const diffDays = Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
console.log("Days between:", diffDays);
```

### Format Reference
| Format | Example |
|--------|---------|
| Unix (s) | 1700000000 |
| Unix (ms) | 1700000000000 |
| ISO 8601 | 2024-03-15T14:30:00.000Z |
| RFC 2822 | Fri, 15 Mar 2024 14:30:00 +0000 |
| Human | March 15, 2024 2:30 PM |
| Short | 2024-03-15 |
| US | 03/15/2024 |
| EU | 15/03/2024 |

### Timezone Support
Common timezones: UTC, America/New_York (EST/EDT), America/Chicago (CST/CDT), America/Denver (MST/MDT), America/Los_Angeles (PST/PDT), Europe/London (GMT/BST), Europe/Paris (CET/CEST), Asia/Tokyo (JST), Asia/Shanghai (CST), Australia/Sydney (AEST/AEDT)
