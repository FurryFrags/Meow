# Science Helper

## Skill ID
`science-helper`

## Description
Assist with physics, chemistry, and biology questions: formulas, constants, conversions, and explanations.

## When to Activate
- User asks a physics, chemistry, or biology question
- User needs scientific formulas or constants
- User wants to calculate physical quantities
- User asks about elements, compounds, or reactions

## Instructions

### Physics Formulas
Use `<terminal_exec>` for calculations:
```js
const c = 299792458;      // Speed of light (m/s)
const g = 9.80665;        // Gravitational acceleration (m/s²)
const G = 6.674e-11;      // Gravitational constant (N⋅m²/kg²)
const h = 6.626e-34;      // Planck constant (J⋅s)
const k_B = 1.381e-23;    // Boltzmann constant (J/K)
const e = 1.602e-19;      // Elementary charge (C)
const N_A = 6.022e23;     // Avogadro's number

// Kinematics
const velocity = (u, a, t) => u + a*t;
const displacement = (u, t, a) => u*t + 0.5*a*t*t;

// Energy
const kineticEnergy = (m, v) => 0.5*m*v*v;
const potentialEnergy = (m, h) => m*g*h;
const einsteinE = (m) => m * c * c;

// Waves
const wavelength = (v, f) => v / f;
const frequency = (v, lambda) => v / lambda;
```

### Chemistry Reference
```js
// Ideal gas law: PV = nRT
const R = 8.314; // J/(mol·K)
const idealGas = (n, T, V) => n * R * T / V; // Pressure in Pa

// Molarity: M = moles / liters
const molarity = (moles, liters) => moles / liters;

// pH = -log10([H+])
const pH = (hConc) => -Math.log10(hConc);
```

### Common Elements (first 20)
| # | Symbol | Name | Mass |
|---|--------|------|------|
| 1 | H | Hydrogen | 1.008 |
| 2 | He | Helium | 4.003 |
| 6 | C | Carbon | 12.011 |
| 7 | N | Nitrogen | 14.007 |
| 8 | O | Oxygen | 15.999 |
| 11 | Na | Sodium | 22.990 |
| 17 | Cl | Chlorine | 35.453 |
| 26 | Fe | Iron | 55.845 |

### Biology Quick Reference
- **DNA bases**: Adenine (A) pairs with Thymine (T), Guanine (G) pairs with Cytosine (C)
- **RNA**: Uracil (U) replaces Thymine
- **Codon table**: 3 nucleotides = 1 amino acid (64 possible codons, 20 amino acids)
- **Cell cycle**: G1 → S (DNA synthesis) → G2 → M (mitosis)

### Always
- Show the formula before plugging in numbers
- Include units in all calculations
- Use scientific notation for very large/small numbers
- Cite laws and principles by name
