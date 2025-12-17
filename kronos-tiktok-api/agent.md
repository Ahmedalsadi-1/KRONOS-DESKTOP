# TikTokApi Agent Integration

## Purpose

The TikTokApi agent provides access to TikTok's public data through an unofficial Python wrapper. It enables automated retrieval of trending videos, user information, video details, comments, and search functionality without requiring user authentication. This agent is designed for data collection, content analysis, and social media monitoring tasks.

## Key Features

- **Trending Content**: Retrieve trending videos from TikTok's "For You" page
- **User Data**: Access user profiles, video lists, and liked posts (if public)
- **Video Analysis**: Get detailed video information, comments, and related content
- **Search Functionality**: Search for users and content
- **Content Download**: Download videos and access media files
- **Hashtag Tracking**: Monitor hashtag usage and related content
- **Sound/Music Data**: Access audio content and sound usage statistics

## API Endpoints

### Core Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `api.trending.videos()` | Async Iterator | Get trending videos |
| `api.user().info()` | GET | Get user profile information |
| `api.user().videos()` | Async Iterator | Get user's videos |
| `api.user().liked()` | Async Iterator | Get user's liked videos (if public) |
| `api.video().info()` | GET | Get detailed video information |
| `api.video().comments()` | Async Iterator | Get video comments |
| `api.video().bytes()` | GET | Download video file |
| `api.search.users()` | Async Iterator | Search for users |
| `api.hashtag().videos()` | Async Iterator | Get videos by hashtag |

### Advanced Endpoints

- `api.video().related_videos()` - Get related video recommendations
- `api.user().playlists()` - Access user-created playlists
- `api.sound().videos()` - Get videos using specific sounds/music

## Dependencies

### Python Requirements
- Python 3.9 or higher
- `TikTokApi>=7.2.1`

### System Dependencies
```bash
# Install Python package
pip install TikTokApi

# Install Playwright browsers
python -m playwright install
```

### Runtime Dependencies
- `requests>=2.31.0,<3.0`
- `playwright>=1.36.0,<2.0`
- `httpx>=0.27.0,<1.0`
- `proxyproviders>=0.2.1,<0.3.0`

## Setup Instructions

### 1. Environment Configuration

Create a `.env` file in the agent directory:

```env
# TikTok API Configuration
TIKTOK_MS_TOKEN=your_ms_token_here
TIKTOK_BROWSER=chromium
TIKTOK_PROXY_PROVIDER=your_proxy_provider_config
TIKTOK_SESSION_COUNT=5
TIKTOK_HEADLESS=true
```

### 2. MS Token Acquisition

The MS token is obtained from TikTok cookies and improves success rates:

1. Visit https://www.tiktok.com
2. Open browser developer tools (F12)
3. Go to Application/Storage > Cookies > tiktok.com
4. Copy the value of the `msToken` cookie
5. Set as `TIKTOK_MS_TOKEN` in environment variables

### 3. Proxy Configuration (Recommended)

For reliable operation, configure proxy providers:

```python
from proxyproviders import ProxyProvider
from proxyproviders.algorithms import RoundRobin

# Example proxy provider setup
proxy_provider = ProxyProvider(
    provider_name="your_provider",
    api_key="your_api_key"
)
```

### 4. Agent Initialization

```python
from TikTokApi import TikTokApi
import asyncio
import os

class TikTokAgent:
    def __init__(self):
        self.api = None
        self.ms_token = os.getenv("TIKTOK_MS_TOKEN")
        self.session_count = int(os.getenv("TIKTOK_SESSION_COUNT", "5"))

    async def initialize(self):
        """Initialize TikTok API with session management"""
        self.api = TikTokApi()

        # Create browser sessions
        await self.api.create_sessions(
            ms_tokens=[self.ms_token] if self.ms_token else None,
            num_sessions=self.session_count,
            sleep_after=3,
            browser=os.getenv("TIKTOK_BROWSER", "chromium"),
            headless=os.getenv("TIKTOK_HEADLESS", "true").lower() == "true"
        )

    async def cleanup(self):
        """Clean up resources"""
        if self.api:
            await self.api.close_sessions()
```

## Commands

### Data Collection Commands

#### Get Trending Videos
```python
async def get_trending_videos(count=30):
    """Retrieve trending videos from TikTok"""
    videos = []
    async for video in api.trending.videos(count=count):
        video_data = {
            'id': video.id,
            'author': video.author.username,
            'stats': video.stats,
            'hashtags': [h.name for h in video.hashtags],
            'url': f"https://www.tiktok.com/@{video.author.username}/video/{video.id}"
        }
        videos.append(video_data)
    return videos
```

#### User Profile Analysis
```python
async def analyze_user(username):
    """Get comprehensive user information"""
    user = api.user(username=username)
    user_info = await user.info()

    videos = []
    async for video in user.videos(count=10):
        videos.append({
            'id': video.id,
            'stats': video.stats,
            'create_time': video.create_time
        })

    return {
        'profile': user_info,
        'recent_videos': videos,
        'video_count': len(videos)
    }
```

#### Video Content Analysis
```python
async def analyze_video(video_id):
    """Get detailed video information and engagement"""
    video = api.video(id=video_id)
    video_info = await video.info()

    comments = []
    async for comment in video.comments(count=20):
        comments.append({
            'text': comment.text,
            'author': comment.author.username,
            'likes': comment.likes_count
        })

    return {
        'video_info': video_info,
        'comments': comments,
        'engagement_rate': calculate_engagement(video_info)
    }
```

#### Content Search
```python
async def search_content(query, content_type='user', count=10):
    """Search for users or content on TikTok"""
    results = []

    if content_type == 'user':
        async for user in api.search.users(query, count=count):
            user_info = await user.info()
            results.append({
                'username': user.username,
                'follower_count': user_info.get('followerCount', 0),
                'video_count': user_info.get('videoCount', 0)
            })

    return results
```

### Automation Commands

#### Content Monitoring
```python
async def monitor_hashtag(hashtag, interval_minutes=60):
    """Monitor hashtag usage over time"""
    while True:
        videos = []
        async for video in api.hashtag(name=hashtag).videos(count=50):
            videos.append({
                'id': video.id,
                'author': video.author.username,
                'stats': video.stats,
                'timestamp': video.create_time
            })

        # Process and store monitoring data
        await process_monitoring_data(hashtag, videos)

        await asyncio.sleep(interval_minutes * 60)
```

#### Trend Analysis
```python
async def analyze_trends(time_window_hours=24):
    """Analyze trending content patterns"""
    trending_videos = await get_trending_videos(count=100)

    # Analyze patterns
    hashtag_frequency = {}
    sound_usage = {}
    creator_stats = {}

    for video in trending_videos:
        # Count hashtag frequency
        for hashtag in video.get('hashtags', []):
            hashtag_frequency[hashtag] = hashtag_frequency.get(hashtag, 0) + 1

        # Track sound usage
        if video.get('sound'):
            sound_id = video['sound'].get('id')
            sound_usage[sound_id] = sound_usage.get(sound_id, 0) + 1

        # Track creator performance
        creator = video['author']
        if creator not in creator_stats:
            creator_stats[creator] = {'videos': 0, 'total_views': 0}
        creator_stats[creator]['videos'] += 1
        creator_stats[creator]['total_views'] += video['stats'].get('playCount', 0)

    return {
        'top_hashtags': sorted(hashtag_frequency.items(), key=lambda x: x[1], reverse=True)[:10],
        'popular_sounds': sorted(sound_usage.items(), key=lambda x: x[1], reverse=True)[:10],
        'top_creators': sorted(creator_stats.items(), key=lambda x: x[1]['total_views'], reverse=True)[:10]
    }
```

## Integration Details

### Unified Automation Platform Adapter

Create a `tiktok-adapter.js` in the platform's API adapters directory:

```javascript
const { TikTokApi } = require('tiktokapi');
const BaseAdapter = require('./base-adapter');

class TikTokAdapter extends BaseAdapter {
    constructor(config) {
        super(config);
        this.api = null;
        this.initialized = false;
    }

    async initialize() {
        if (this.initialized) return;

        this.api = new TikTokApi({
            logging_level: this.config.loggingLevel || 'WARN'
        });

        await this.api.create_sessions({
            ms_tokens: this.config.msTokens,
            num_sessions: this.config.sessionCount || 5,
            browser: this.config.browser || 'chromium',
            headless: this.config.headless !== false
        });

        this.initialized = true;
    }

    async getTrendingVideos(count = 30) {
        await this.ensureInitialized();

        const videos = [];
        for await (const video of this.api.trending.videos({ count })) {
            videos.push(this.transformVideoData(video));
        }

        return videos;
    }

    async getUserInfo(username) {
        await this.ensureInitialized();

        const user = this.api.user({ username });
        const info = await user.info();
        return this.transformUserData(info);
    }

    async searchUsers(query, count = 10) {
        await this.ensureInitialized();

        const users = [];
        for await (const user of this.api.search.users(query, { count })) {
            users.push(this.transformUserData(user));
        }

        return users;
    }

    transformVideoData(video) {
        return {
            id: video.id,
            author: video.author?.username,
            description: video.as_dict?.desc,
            stats: video.stats,
            hashtags: video.hashtags?.map(h => h.name),
            sound: video.sound?.title,
            createTime: video.create_time,
            url: `https://www.tiktok.com/@${video.author?.username}/video/${video.id}`
        };
    }

    transformUserData(user) {
        return {
            username: user.username,
            userId: user.user_id,
            secUid: user.sec_uid,
            followerCount: user.as_dict?.stats?.followerCount,
            followingCount: user.as_dict?.stats?.followingCount,
            videoCount: user.as_dict?.stats?.videoCount,
            profile: user.as_dict
        };
    }

    async ensureInitialized() {
        if (!this.initialized) {
            await this.initialize();
        }
    }

    async cleanup() {
        if (this.api && this.initialized) {
            await this.api.close_sessions();
            this.initialized = false;
        }
    }
}

module.exports = TikTokAdapter;
```

### Configuration Schema

```json
{
    "tiktok": {
        "msTokens": ["token1", "token2"],
        "sessionCount": 5,
        "browser": "chromium",
        "headless": true,
        "loggingLevel": "WARN",
        "proxyProvider": {
            "name": "provider_name",
            "apiKey": "api_key"
        }
    }
}
```

### Error Handling

The TikTokApi agent may encounter several types of errors:

- **EmptyResponseException**: TikTok detected bot behavior
  - Solution: Use proxies, reduce request frequency, use different browser types

- **InvalidResponseException**: API response format changed
  - Solution: Update TikTokApi package, check for breaking changes

- **Session failures**: Browser sessions become invalid
  - Solution: Agent automatically recovers sessions, implement retry logic

### Rate Limiting and Best Practices

- Implement request throttling (1-2 seconds between requests)
- Use proxy rotation to avoid IP blocking
- Monitor session health and recreate when needed
- Cache results when appropriate to reduce API calls
- Handle TikTok's dynamic content loading gracefully

### Security Considerations

- MS tokens contain session information - store securely
- Avoid logging sensitive authentication data
- Use HTTPS for all communications
- Implement proper error handling to avoid information leakage
- Regular security audits of dependencies

## Monitoring and Maintenance

### Health Checks

```python
async def health_check():
    """Verify TikTok API connectivity and session health"""
    try:
        # Test basic connectivity
        test_video = None
        async for video in api.trending.videos(count=1):
            test_video = video
            break

        # Check session status
        health = await api.health_check()

        return {
            'status': 'healthy' if test_video and health['healthy_sessions'] > 0 else 'unhealthy',
            'session_count': len(api.sessions),
            'healthy_sessions': health.get('healthy_sessions', 0),
            'last_check': datetime.now()
        }
    except Exception as e:
        return {
            'status': 'error',
            'error': str(e),
            'last_check': datetime.now()
        }
```

### Maintenance Tasks

- Regular dependency updates
- Monitor TikTok API changes
- Update MS tokens periodically
- Review and update proxy configurations
- Clean up old session data
- Monitor error rates and success rates

This integration enables powerful TikTok data collection and analysis capabilities within the unified automation platform, supporting use cases from social media monitoring to content research and trend analysis.