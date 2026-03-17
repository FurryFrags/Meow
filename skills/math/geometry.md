# Geometry

## Skill ID
`geometry`

## Description
Calculate areas, volumes, perimeters, angles, and properties of geometric shapes. Solve geometry problems with step-by-step explanations.

## When to Activate
- User asks about shapes, areas, volumes, or perimeters
- User needs geometric calculations
- User asks about angles, triangles, or coordinate geometry

## Instructions

### 2D Shapes
```js
const shapes2D = {
  circle:    { area: r => Math.PI*r*r, perimeter: r => 2*Math.PI*r },
  rectangle: { area: (w,h) => w*h, perimeter: (w,h) => 2*(w+h) },
  triangle:  { area: (b,h) => 0.5*b*h, perimeter: (a,b,c) => a+b+c },
  trapezoid: { area: (a,b,h) => 0.5*(a+b)*h },
  ellipse:   { area: (a,b) => Math.PI*a*b, perimeter: (a,b) => Math.PI*(3*(a+b)-Math.sqrt((3*a+b)*(a+3*b))) },
};
```

### 3D Shapes
```js
const shapes3D = {
  sphere:   { volume: r => (4/3)*Math.PI*r**3, surface: r => 4*Math.PI*r*r },
  cube:     { volume: s => s**3, surface: s => 6*s*s },
  cylinder: { volume: (r,h) => Math.PI*r*r*h, surface: (r,h) => 2*Math.PI*r*(r+h) },
  cone:     { volume: (r,h) => (1/3)*Math.PI*r*r*h, surface: (r,h) => Math.PI*r*(r+Math.sqrt(r*r+h*h)) },
};
```

### Trigonometry
```js
// Convert degrees ↔ radians
const toRad = deg => deg * Math.PI / 180;
const toDeg = rad => rad * 180 / Math.PI;

// Pythagorean theorem
const hypotenuse = (a,b) => Math.sqrt(a*a + b*b);
const leg = (c,a) => Math.sqrt(c*c - a*a);

// Law of cosines: c² = a² + b² - 2ab·cos(C)
const lawOfCosines = (a,b,C_deg) => Math.sqrt(a*a + b*b - 2*a*b*Math.cos(toRad(C_deg)));
```

### Coordinate Geometry
```js
const distance = (x1,y1,x2,y2) => Math.sqrt((x2-x1)**2 + (y2-y1)**2);
const midpoint = (x1,y1,x2,y2) => [(x1+x2)/2, (y1+y2)/2];
const slope = (x1,y1,x2,y2) => (y2-y1)/(x2-x1);
```

### Always
- Draw ASCII diagrams when helpful
- Show formulas before computing
- Label all dimensions and units
- Verify results make intuitive sense
