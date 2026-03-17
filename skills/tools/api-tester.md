# API Tester

## Skill ID
`api-tester`

## Description
Test REST API endpoints, construct requests, analyze responses, and debug API issues.

## When to Activate
- User asks to test an API endpoint
- User needs help constructing API requests
- User wants to debug API errors
- User asks about HTTP methods, headers, or status codes

## Instructions

1. **Construct the request**: Build the fetch call with proper method, headers, and body.

2. **Execute via terminal**:
```js
const res = await fetch('https://api.example.com/endpoint', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ key: 'value' })
});
const data = await res.json();
console.log('Status:', res.status);
console.log('Response:', JSON.stringify(data, null, 2));
```

3. **Analyze the response**:
   - Status code and meaning
   - Response headers
   - Body structure and content
   - Performance (timing)

4. **HTTP Status Reference**:
   - **2xx**: Success (200 OK, 201 Created, 204 No Content)
   - **3xx**: Redirect (301 Moved, 304 Not Modified)
   - **4xx**: Client Error (400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found, 429 Rate Limited)
   - **5xx**: Server Error (500 Internal, 502 Bad Gateway, 503 Unavailable)

5. **Debug common issues**:
   - CORS errors: Explain and suggest proxy solutions
   - Auth failures: Check token format, expiration
   - Rate limits: Suggest backoff strategies
   - Malformed requests: Validate JSON, headers, URL encoding

### Output Format
```
Request: [METHOD] [URL]
Headers: [key headers]
Body: [if applicable]

Response:
  Status: [code] [text]
  Time: [ms]
  Body: [formatted JSON]
```

### Security
- Never log or display API keys/tokens in full
- Warn about sending sensitive data over HTTP (not HTTPS)
- Suggest secure storage for credentials
