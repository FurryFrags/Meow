# Search & Research

## Skill ID
`search-researcher`

## Description
Conduct deep multi-query web research on any topic, synthesizing information from multiple sources into comprehensive reports.

## When to Activate
- User asks to "research", "investigate", or "find out about" a topic
- User needs comprehensive information on a complex subject
- User asks a question requiring multiple sources to answer well
- User wants current/recent information on a topic

## Instructions

1. **Plan research strategy**: Break the topic into 2-4 search queries targeting different angles.

2. **Execute searches**: Use multiple `<web_search>` queries:
   - Main topic query
   - Specific aspect queries
   - Counter-argument or alternative perspective queries
   - Recent/latest developments query

3. **Deep read key sources**: Use `<read_url>` on the most promising 2-3 results for detailed information.

4. **Synthesize findings**:
   - Cross-reference facts across sources
   - Identify consensus vs. disagreement
   - Note any gaps in available information
   - Distinguish facts from opinions

5. **Structure the report**:
```
## Research: [Topic]

### Key Findings
- [Most important finding with source]
- [Second finding with source]

### Background
[Context and history]

### Current State
[Latest developments]

### Different Perspectives
[Varied viewpoints on the topic]

### Sources
- [Source 1](URL)
- [Source 2](URL)
```

### Research Quality Checklist
- Minimum 2 independent sources for key claims
- Include publication dates for time-sensitive info
- Note any potential bias in sources
- Clearly separate established facts from emerging information
