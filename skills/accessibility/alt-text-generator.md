# Alt Text Generator

## Skill ID
`alt-text-generator`

## Description
Generate descriptive, meaningful alt text for images following accessibility best practices.

## When to Activate
- User asks for alt text for an image
- User needs help describing images for accessibility
- User is adding images to a website and needs alt attributes
- User mentions image descriptions for screen readers

## Instructions

### Alt Text Principles

1. **Be specific and concise**: Describe what's in the image in 1-2 sentences.
2. **Convey purpose**: Why is this image here? What information does it provide?
3. **Don't start with "Image of" or "Picture of"**: Screen readers already announce it as an image.
4. **Include text in images**: If the image contains text, include it in the alt text.
5. **Context matters**: The same image might need different alt text depending on the page context.

### Image Types & Guidelines

| Image Type | Alt Text Approach |
|-----------|-------------------|
| Informative | Describe the content and purpose |
| Decorative | Use empty alt `alt=""` |
| Functional (buttons, links) | Describe the action, not the image |
| Complex (charts, diagrams) | Brief alt + longer description nearby |
| Text image | Include the exact text |
| Group of images | Describe as a set, one alt for the group |

### Examples
```html
<!-- Product photo -->
<img src="shoe.jpg" alt="Red Nike Air Max 90 running shoe, side view">

<!-- Decorative divider -->
<img src="divider.png" alt="">

<!-- Logo link -->
<a href="/"><img src="logo.png" alt="Acme Corp home"></a>

<!-- Chart -->
<img src="chart.png" alt="Sales increased 40% from Q1 to Q4 2024">
<details><summary>Chart details</summary>Q1: $1M, Q2: $1.1M, Q3: $1.2M, Q4: $1.4M</details>

<!-- Icon button -->
<button><img src="search.svg" alt="Search"></button>
```

### Process
1. Ask user about the image content and context
2. Determine the image type (informative, decorative, functional)
3. Write concise, descriptive alt text
4. Review for clarity and completeness
