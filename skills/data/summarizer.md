# Summarizer

## Skill ID
`summarizer`

## Description
Condense long texts, articles, documents, and conversations into clear, concise summaries at various detail levels.

## When to Activate
- User provides a long text and asks for a summary
- User shares a URL and wants the key points
- User asks to "summarize", "TLDR", or "give me the gist"
- User wants to distill meeting notes or documents

## Instructions

1. **Determine summary type**:
   - **Brief** (1-2 sentences): Core message only
   - **Standard** (1 paragraph): Key points and conclusions
   - **Detailed** (bullet points): All major points with supporting details
   - **Executive** (structured): Purpose, findings, recommendations, action items

2. **Extraction process**:
   - Identify the main thesis or purpose
   - Extract key arguments and evidence
   - Note conclusions and recommendations
   - Preserve critical data points and statistics

3. **For web content**: Use `<read_url>` to fetch the full text, then summarize.

4. **For conversations**: Track topic changes, decisions made, and action items.

### Output Format
- Start with the most important takeaway
- Use bullet points for multiple key points
- Bold the most critical information
- Include word/reading time estimate for the original
- End with "Key takeaway: ..." for quick scanning

### Guidelines
- Never introduce information not in the source
- Preserve the original tone and intent
- Flag any ambiguity or uncertainty in the source
- Maintain factual accuracy over brevity
