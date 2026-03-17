# Advanced Calculator

## Skill ID
`calculator`

## Description
Perform mathematical calculations from basic arithmetic to advanced operations: algebra, calculus concepts, number theory, and financial math.

## When to Activate
- User asks to calculate, compute, or solve a math problem
- User provides a mathematical expression
- User needs financial calculations (interest, mortgage, ROI)
- User asks about percentages, ratios, or proportions

## Instructions

### Use Terminal for All Calculations
Always use `<terminal_exec>` for precision:

```js
// Basic arithmetic
console.log(2 ** 10);           // Powers: 1024
console.log(Math.sqrt(144));    // Square root: 12
console.log(Math.log2(1024));   // Log base 2: 10

// Percentages
const pct = (part, whole) => ((part / whole) * 100).toFixed(2) + '%';
console.log(pct(35, 200));     // 17.50%

// Percentage change
const change = (old, new_) => (((new_ - old) / old) * 100).toFixed(2) + '%';
console.log(change(100, 135)); // 35.00%
```

### Financial Calculations
```js
// Compound interest: A = P(1 + r/n)^(nt)
function compoundInterest(principal, rate, n, years) {
  return principal * Math.pow(1 + rate/n, n * years);
}
console.log('$10k at 5% for 10yr:', compoundInterest(10000, 0.05, 12, 10).toFixed(2));

// Loan payment: M = P[r(1+r)^n]/[(1+r)^n-1]
function monthlyPayment(principal, annualRate, years) {
  const r = annualRate / 12;
  const n = years * 12;
  return principal * (r * Math.pow(1+r, n)) / (Math.pow(1+r, n) - 1);
}
console.log('$300k mortgage at 6.5% 30yr:', monthlyPayment(300000, 0.065, 30).toFixed(2));
```

### Number Theory
```js
// Prime check
const isPrime = n => { if (n<2) return false; for(let i=2;i*i<=n;i++) if(n%i===0) return false; return true; };

// GCD & LCM
const gcd = (a,b) => b ? gcd(b, a%b) : a;
const lcm = (a,b) => a * b / gcd(a,b);

// Factorial
const fact = n => n <= 1 ? 1 : n * fact(n-1);

// Fibonacci
const fib = n => { let a=0,b=1; for(let i=0;i<n;i++) [a,b]=[b,a+b]; return a; };
```

### Constants
- Pi: `Math.PI` (3.14159265...)
- Euler's number: `Math.E` (2.71828182...)
- Golden ratio: `(1 + Math.sqrt(5)) / 2` (1.61803398...)

### Always
- Show your work step by step
- Verify results with terminal execution
- Round appropriately for the context
- Use proper notation (², ³, ×, ÷, ±, ≈)
