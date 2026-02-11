"""Platform adapters for social integrations.

All adapters are disabled by default in config/defaults.yaml.
"""

from agent_core.platforms.facebook import FacebookAdapter
from agent_core.platforms.instagram import InstagramAdapter
from agent_core.platforms.linkedin import LinkedInAdapter
from agent_core.platforms.reddit import RedditAdapter
from agent_core.platforms.tiktok import TikTokAdapter
from agent_core.platforms.twitter import TwitterAdapter

PLATFORM_ADAPTERS = {
    "twitter": TwitterAdapter(),
    "reddit": RedditAdapter(),
    "linkedin": LinkedInAdapter(),
    "facebook": FacebookAdapter(),
    "instagram": InstagramAdapter(),
    "tiktok": TikTokAdapter(),
}

__all__ = ["PLATFORM_ADAPTERS"]
