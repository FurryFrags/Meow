# Data Analysis

## Skill ID
`data-analysis`

## Description
Analyze datasets, compute statistics, identify patterns, and provide data-driven insights.

## When to Activate
- User provides CSV, JSON, or tabular data
- User asks for statistical analysis, trends, or summaries
- User needs to interpret numbers, datasets, or metrics
- User asks to compare data points or find correlations

## Instructions

When analyzing data:

1. **Identify the data type**: Determine if the data is numerical, categorical, time-series, or mixed.
2. **Compute summary statistics**: Mean, median, mode, standard deviation, min/max, percentiles.
3. **Detect patterns**: Trends, outliers, clusters, seasonal effects.
4. **Provide insights**: Explain what the numbers mean in plain language.
5. **Suggest next steps**: Recommend further analysis or visualizations.

### Statistical Methods
- **Descriptive**: Summarize with count, mean, std, quartiles
- **Comparative**: Compare groups with differences, ratios, percent changes
- **Correlation**: Identify relationships between variables
- **Outlier detection**: Flag values beyond 2 standard deviations

### Output Format
Always present findings in structured markdown:
- Use tables for summary statistics
- Use bullet points for key insights
- Provide the raw calculation when precision matters

### Terminal Execution
Use `<terminal_exec>` to compute statistics directly:
```js
// Example: compute stats for an array
const data = [values];
const mean = data.reduce((a,b) => a+b, 0) / data.length;
const sorted = [...data].sort((a,b) => a-b);
const median = sorted[Math.floor(sorted.length/2)];
```
