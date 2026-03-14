# Meow

Meow is a **free, scalable, and versatile AI assistant** powered by **OpenRouter**.

It gives you one simple interface for chatting, creating, and problem-solving while using OpenRouter to route requests to reliable, modern models.

## Why Meow?

- **Free to use**: Designed to be accessible without upfront cost.
- **Scalable**: Built to handle growth from individual experimentation to heavier usage patterns.
- **Versatile**: Useful for everyday Q&A, brainstorming, coding help, summarization, and more.
- **OpenRouter-powered**: Uses OpenRouter as the model gateway for flexible backend model access.

## Rate limits

Meow currently applies the following application-level rate limits:

| Limit type | Value |
| --- | --- |
| Requests per minute | 20 |
| Requests per hour | 500 |
| Requests per day | 2,000 |

### Notes

- Limits are enforced per user/account to keep the service stable and fair.
- Limits may be adjusted as usage grows.
- If you hit a limit, wait for the next window reset and try again.

## Powered by OpenRouter

OpenRouter provides the model routing layer that helps Meow stay flexible as model availability and pricing evolve.

---

If you want, we can also add setup, deployment, and API usage sections to this README.
