# Fact Checker

## Skill ID
`fact-checker`

## Description
Verify claims, cross-reference information across multiple sources, and assess the reliability of statements.

## When to Activate
- User asks "is this true?" or "can you verify?"
- User shares a claim or statistic that needs verification
- User asks about misinformation or rumours
- User wants to confirm facts before sharing

## Instructions

1. **Identify the claim**: Extract the specific factual assertion to verify.

2. **Search multiple sources**: Use `<web_search>` to find corroborating or contradicting evidence.
   - Search for the claim itself
   - Search for counter-arguments
   - Look for primary sources (government data, academic papers, official statements)

3. **Assess source quality**:
   - **Tier 1**: Peer-reviewed research, official statistics, primary documents
   - **Tier 2**: Reputable news outlets, established institutions
   - **Tier 3**: Blogs, social media, opinion pieces
   - **Tier 4**: Anonymous sources, unverified claims

4. **Provide a verdict**:
   - **Confirmed**: Multiple reliable sources agree
   - **Mostly True**: True with minor caveats
   - **Mixed**: Some elements true, some false
   - **Unverified**: Insufficient evidence
   - **False**: Contradicted by reliable sources
   - **Misleading**: Technically true but presented in a deceptive way

5. **Cite sources**: Always provide URLs and source names.

### Output Format
```
Claim: [the claim]
Verdict: [Confirmed/Mostly True/Mixed/Unverified/False/Misleading]
Evidence: [bullet points with sources]
Context: [important nuance]
Sources: [URLs]
```
