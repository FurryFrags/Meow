# Unit Converter

## Skill ID
`unit-converter`

## Description
Convert between units of measurement: length, weight, temperature, volume, speed, data, time, and more.

## When to Activate
- User asks to convert between units
- User provides a measurement and asks "how much is that in...?"
- User compares values in different unit systems

## Instructions

### Use Terminal for Precision
```js
const conversions = {
  // Length
  km_to_mi: v => v * 0.621371,
  mi_to_km: v => v * 1.60934,
  m_to_ft: v => v * 3.28084,
  ft_to_m: v => v * 0.3048,
  in_to_cm: v => v * 2.54,
  cm_to_in: v => v / 2.54,

  // Weight
  kg_to_lb: v => v * 2.20462,
  lb_to_kg: v => v * 0.453592,
  oz_to_g: v => v * 28.3495,
  g_to_oz: v => v / 28.3495,

  // Temperature
  c_to_f: v => v * 9/5 + 32,
  f_to_c: v => (v - 32) * 5/9,
  c_to_k: v => v + 273.15,
  k_to_c: v => v - 273.15,

  // Volume
  l_to_gal: v => v * 0.264172,
  gal_to_l: v => v * 3.78541,
  ml_to_floz: v => v * 0.033814,
  floz_to_ml: v => v / 0.033814,

  // Speed
  kmh_to_mph: v => v * 0.621371,
  mph_to_kmh: v => v * 1.60934,
  ms_to_kmh: v => v * 3.6,

  // Data
  bytes_to_kb: v => v / 1024,
  kb_to_mb: v => v / 1024,
  mb_to_gb: v => v / 1024,
  gb_to_tb: v => v / 1024,
};
```

### Supported Categories
| Category | Units |
|----------|-------|
| Length | mm, cm, m, km, in, ft, yd, mi, nm (nautical) |
| Weight | mg, g, kg, oz, lb, ton, stone |
| Temperature | Celsius, Fahrenheit, Kelvin |
| Volume | mL, L, fl oz, cup, pint, quart, gallon |
| Area | mm², cm², m², km², in², ft², acre, hectare |
| Speed | m/s, km/h, mph, knots, mach |
| Time | ms, s, min, hr, day, week, month, year |
| Data | bit, byte, KB, MB, GB, TB, PB |
| Energy | J, kJ, cal, kcal, kWh, BTU |
| Pressure | Pa, kPa, bar, atm, psi, mmHg |

### Output Format
```
42 km = 26.10 mi
```
- Show the conversion formula
- Provide 2-4 decimal places
- Include common reference points for context
