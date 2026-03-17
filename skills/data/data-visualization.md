# Data Visualization

## Skill ID
`data-visualization`

## Description
Create text-based charts, graphs, and visual data representations. Recommend visualization types and explain data visually.

## When to Activate
- User asks for a chart, graph, or visual representation
- User has data that would benefit from visualization
- User asks "show me" or "plot" or "graph"

## Instructions

1. **Choose the right chart type**:
   - **Bar chart**: Comparing categories
   - **Line chart**: Trends over time
   - **Pie/percentage**: Parts of a whole
   - **Scatter**: Relationships between variables
   - **Histogram**: Distribution of values
   - **Heatmap**: Matrix/grid data

2. **Create ASCII visualizations** when helpful:
```
Revenue by Quarter
Q1 ████████████░░░░░░░░ 60%
Q2 ██████████████░░░░░░ 70%
Q3 ████████████████████ 100%
Q4 ██████████████████░░ 90%
```

3. **Use terminal execution** for dynamic charts:
```js
// Generate ASCII bar chart
const data = {labels: [...], values: [...]};
const max = Math.max(...data.values);
data.labels.forEach((l, i) => {
  const bar = '█'.repeat(Math.round(data.values[i]/max*30));
  console.log(`${l.padEnd(10)} ${bar} ${data.values[i]}`);
});
```

4. **Recommend tools**: Suggest Chart.js, D3.js, or similar for production visualizations.

### Best Practices
- Always label axes and provide a legend
- Use consistent scales
- Highlight the key takeaway
- Choose colors with accessibility in mind
