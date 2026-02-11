# Platform adapter safety model

This directory implements a shared adapter interface for:

- X/Twitter
- Reddit
- LinkedIn
- Facebook
- Instagram
- TikTok

## Shared interface

Every adapter implements:

- `login(session_store)`
- `fetch_feed()`
- `draft_response(context)`
- `post(content)`
- `health_check()`

The shared `PlatformAdapter.process_cycle(...)` wrapper applies:

1. Health checks first.
2. Capability matrix gating (`can_fetch_feed`, `can_post`, etc.).
3. Persistent session/cookie bootstrap files in `data/sessions/<platform>.json`.
4. Rate limiting with randomized jitter.
5. Retry with exponential backoff and jitter.
6. Content safety policy checks before any post.

## Fail-closed behavior

If any uncertainty or unsafe condition is detected, the adapter aborts posting. Examples:

- Session is not authenticated.
- Draft is empty or too long.
- Draft appears to include sensitive data markers.
- Draft contains URLs that require manual review.
- The platform capability matrix disables posting.

## Platform limitations and legal/compliance notes

These adapters are intentionally conservative and default-disabled.

- **CAPTCHA and MFA**: Many platforms require periodic interactive challenges. The session file bootstraps local persistence, but manual intervention can still be required.
- **API terms and anti-automation policies**: Platform terms may prohibit browser automation, scraping, or unattended posting.
- **App-review constraints**: Official APIs can require app review, permissions approval, and strict use-case compliance.
- **Jurisdiction/legal constraints**: Data handling, consent, and retention requirements vary by region and organization.

Because of those constraints, some adapters have posting/fetching disabled in the capability matrix until explicit legal and policy approval exists.
