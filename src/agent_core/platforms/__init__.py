"""Platform adapters for social integrations.

All adapters are disabled by default in config/defaults.yaml.
"""

from agent_core.platforms.mastodon import MastodonAdapter
from agent_core.platforms.reddit import RedditAdapter
from agent_core.platforms.twitter import TwitterAdapter

PLATFORM_ADAPTERS = {
    "twitter": TwitterAdapter(),
    "reddit": RedditAdapter(),
    "mastodon": MastodonAdapter(),
}

__all__ = ["PLATFORM_ADAPTERS"]
