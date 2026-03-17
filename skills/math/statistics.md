# Statistics

## Skill ID
`statistics`

## Description
Perform statistical analysis: descriptive stats, probability, distributions, hypothesis testing concepts, and regression.

## When to Activate
- User provides a dataset and needs statistical analysis
- User asks about probability or statistical concepts
- User needs to understand distributions or sampling
- User wants correlation, regression, or trend analysis

## Instructions

### Descriptive Statistics
```js
function stats(data) {
  const n = data.length;
  const sorted = [...data].sort((a,b) => a-b);
  const sum = data.reduce((a,b) => a+b, 0);
  const mean = sum / n;
  const variance = data.reduce((s,x) => s + (x-mean)**2, 0) / (n-1);
  const std = Math.sqrt(variance);
  const median = n%2 ? sorted[Math.floor(n/2)] : (sorted[n/2-1]+sorted[n/2])/2;
  const q1 = sorted[Math.floor(n*0.25)];
  const q3 = sorted[Math.floor(n*0.75)];
  const iqr = q3 - q1;
  return { n, mean, median, std, variance, min: sorted[0], max: sorted[n-1], q1, q3, iqr, range: sorted[n-1]-sorted[0] };
}
const result = stats([your_data]);
console.log(JSON.stringify(result, null, 2));
```

### Probability
```js
// Combinations: C(n,k) = n! / (k! * (n-k)!)
function C(n,k) { let r=1; for(let i=0;i<k;i++) r=r*(n-i)/(i+1); return r; }

// Permutations: P(n,k) = n! / (n-k)!
function P(n,k) { let r=1; for(let i=n;i>n-k;i--) r*=i; return r; }

// Binomial probability: P(X=k) = C(n,k) * p^k * (1-p)^(n-k)
function binomial(n,k,p) { return C(n,k) * p**k * (1-p)**(n-k); }
```

### Correlation & Regression
```js
function correlation(x, y) {
  const n = x.length;
  const mx = x.reduce((a,b)=>a+b,0)/n;
  const my = y.reduce((a,b)=>a+b,0)/n;
  let num=0, dx=0, dy=0;
  for(let i=0;i<n;i++) {
    num += (x[i]-mx)*(y[i]-my);
    dx += (x[i]-mx)**2;
    dy += (y[i]-my)**2;
  }
  const r = num / Math.sqrt(dx*dy);
  // Linear regression: y = slope*x + intercept
  const slope = num / dx;
  const intercept = my - slope * mx;
  return { r, rSquared: r*r, slope, intercept };
}
```

### Output Format
- Present key statistics in a clean table
- Interpret the numbers in plain language
- Note any outliers or unusual patterns
- Provide context for what the statistics mean
