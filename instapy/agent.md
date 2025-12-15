# InstaPy Agent Integration

## Purpose

InstaPy is a Python library that automates Instagram interactions to help grow and manage Instagram accounts. As an agent in the unified automation platform, InstaPy enables automated social media engagement including liking, commenting, following, and relationship analysis.

## Overview

InstaPy uses Selenium WebDriver to automate Instagram interactions through the web interface. It provides comprehensive automation capabilities for social media marketing and account management, with built-in safety features to avoid account bans.

## API Endpoints

### Core Automation Methods

#### Liking
- `like_by_tags(tags, amount, skip_top_posts, randomize)` - Like posts by hashtags
- `like_by_locations(locations, amount, media, skip_top_posts)` - Like posts by location
- `like_by_users(usernames, amount, randomize, media)` - Like posts from specific users
- `like_by_feed(amount, randomize, unfollow, interact)` - Like posts from feed

#### Commenting
- `set_do_comment(enabled, percentage)` - Enable/disable commenting
- `set_comments(comments, media)` - Configure comment templates
- `comment_by_locations(locations, amount, media, skip_top_posts)` - Comment by location

#### Following/Unfollowing
- `set_do_follow(enabled, percentage, times)` - Configure following behavior
- `follow_by_tags(tags, amount, skip_top_posts, randomize)` - Follow users by tags
- `follow_by_locations(locations, amount, media, skip_top_posts)` - Follow by location
- `follow_user_followers(usernames, amount, randomize, interact)` - Follow followers of users
- `unfollow_users(amount, custom_list_enabled, custom_list, style)` - Unfollow users

#### Relationship Analysis
- `grab_followers(username, amount, live_match, store_locally)` - Get followers list
- `grab_following(username, amount, live_match, store_locally)` - Get following list
- `pick_unfollowers(username, compare_by, compare_track, live_match)` - Find unfollowers
- `pick_nonfollowers(username, live_match, store_locally)` - Find non-followers
- `pick_fans(username, live_match, store_locally)` - Find fans

#### Stories
- `set_do_story(enabled, percentage, simulate)` - Configure story watching
- `story_by_tags(tags)` - Watch stories by tags
- `story_by_users(users)` - Watch stories by users

### Configuration Methods

#### Safety & Limits
- `set_quota_supervisor(enabled, sleep_after, sleepyhead, stochastic_flow, notify_me, peak_likes_hourly, peak_likes_daily, peak_comments_hourly, peak_comments_daily, peak_follows_hourly, peak_follows_daily, peak_unfollows_hourly, peak_unfollows_daily, peak_server_calls_hourly, peak_server_calls_daily)` - Set activity limits
- `set_action_delays(enabled, like, comment, follow, unfollow, story, randomize, random_range_from, random_range_to, safety_match)` - Configure delays between actions

#### Filtering
- `set_dont_like(tags)` - Avoid posts with certain hashtags
- `set_mandatory_words(tags)` - Only interact with posts containing certain words
- `set_ignore_users(users)` - Ignore specific users
- `set_dont_include(friends)` - Don't unfollow certain users
- `set_skip_users(skip_private, private_percentage, skip_public, public_percentage, skip_no_profile_pic, no_profile_pic_percentage, skip_business, business_percentage, skip_business_categories, dont_skip_business_categories, skip_bio_keyword, mandatory_bio_keywords)` - Skip users by criteria

#### AI Integration
- `set_use_clarifai(enabled, api_key, models, workflow, probability, full_match, check_video, proxy)` - Enable Clarifai image analysis
- `clarifai_check_img_for(tags, tags_skip, comment, comments)` - Configure AI-based filtering

#### Smart Features
- `set_smart_hashtags(tags, limit, sort, log_tags)` - Generate smart hashtags
- `set_smart_location_hashtags(locations, radius, limit, log_tags)` - Generate location-based hashtags

## Commands

### Basic Usage Pattern
```python
from instapy import InstaPy

session = InstaPy(username="your_username",
                  password="your_password",
                  headless_browser=True)

session.login()

# Configure behavior
session.set_do_like(enabled=True, percentage=70)
session.set_do_comment(enabled=True, percentage=25)
session.set_comments(["Nice post!", "Great shot!"])

# Execute automation
session.like_by_tags(["photography", "landscape"], amount=50)

session.end()
```

### Advanced Automation Script
```python
session = InstaPy(username="user", password="pass", headless_browser=True)
session.login()

# Safety first
session.set_quota_supervisor(enabled=True,
                           peak_likes_daily=585,
                           peak_comments_daily=182)

# Smart filtering
session.set_dont_like(["#nsfw", "#adult"])
session.set_mandatory_words(["#nature", "#photography"])

# Multi-action automation
session.like_by_tags(["travel", "adventure"], amount=100, interact=True)
session.follow_user_followers(["natgeo", "discovery"], amount=50)

session.end()
```

## Dependencies

### Core Dependencies
- `instapy>=0.6.16` - Main InstaPy library
- `selenium>=3.141.0` - Web browser automation
- `requests>=2.20.1` - HTTP requests
- `certifi>=2018.10.15` - SSL certificates
- `chardet>=3.0.4,<4` - Character encoding detection
- `idna>=2.7,<3` - International domain names
- `urllib3>=1.24.1` - HTTP client

### Optional Dependencies
- `clarifai>=2.4.1` - AI image recognition
- `emoji>=1.6.0` - Emoji support
- `python-telegram-bot>=12.0.0` - Telegram integration
- `PyVirtualDisplay>=0.2.1` - Headless display (Linux)
- `MeaningCloud-python>=1.1.1` - Sentiment analysis
- `yandex-translator>=1.1.1` - Language translation

### System Requirements
- Python 3.5+
- WebDriver (Firefox/Chrome)
- SQLite (for data persistence)

## Setup Instructions

### 1. Install InstaPy
```bash
pip install instapy
# or for specific version
pip install instapy==0.6.16
```

### 2. Install WebDriver
```bash
# Firefox (recommended)
pip install webdriverdownloader
python -c "from webdriverdownloader import GeckoDriverDownloader; GeckoDriverDownloader().download_and_install()"

# Or Chrome
pip install chromedriver-binary
```

### 3. Basic Configuration
```python
from instapy import InstaPy

# Initialize with credentials
session = InstaPy(username="your_username",
                  password="your_password",
                  headless_browser=True,  # Run without GUI
                  browser_profile_path=None,
                  page_delay=25)  # Delay between page loads

# Login
session.login()
```

### 4. Safety Configuration
```python
# Set activity limits to avoid bans
session.set_quota_supervisor(enabled=True,
                           peak_likes_daily=500,
                           peak_comments_daily=100,
                           peak_follows_daily=50)

# Add delays between actions
session.set_action_delays(enabled=True,
                         like=3,
                         comment=5,
                         follow=4,
                         unfollow=28)
```

### 5. Content Filtering
```python
# Avoid inappropriate content
session.set_dont_like(["#nsfw", "#adult", "#porn"])

# Focus on specific niches
session.set_mandatory_words(["#photography", "#nature", "#landscape"])

# Skip certain user types
session.set_skip_users(skip_private=True,
                      skip_business=False,
                      skip_no_profile_pic=True)
```

## Integration Details

### Platform Adapter Pattern
Following the unified automation platform's adapter pattern, InstaPy should be integrated as:

```javascript
// instapy-adapter.js
const { spawn } = require('child_process');
const path = require('path');

class InstaPyAdapter {
  constructor(config) {
    this.config = config;
    this.process = null;
  }

  async executeAutomation(script) {
    return new Promise((resolve, reject) => {
      const pythonProcess = spawn('python', [script], {
        cwd: path.join(__dirname, 'scripts'),
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let output = '';
      let errorOutput = '';

      pythonProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      pythonProcess.on('close', (code) => {
        if (code === 0) {
          resolve({ success: true, output });
        } else {
          reject({ success: false, error: errorOutput });
        }
      });
    });
  }

  async likeByTags(tags, amount = 50) {
    const script = `
from instapy import InstaPy
session = InstaPy(username="${this.config.username}",
                  password="${this.config.password}",
                  headless_browser=True)
session.login()
session.like_by_tags(${JSON.stringify(tags)}, amount=${amount})
session.end()
`;
    return this.executeAutomation(script);
  }
}

module.exports = InstaPyAdapter;
```

### API Integration Points
- **Authentication**: Instagram login credentials
- **Browser Control**: Selenium WebDriver management
- **Data Persistence**: SQLite database for tracking
- **External APIs**: Clarifai, Telegram, MeaningCloud
- **Monitoring**: Activity logging and quota supervision

### Error Handling
- Network timeouts and connection issues
- Instagram rate limiting and blocks
- Browser automation failures
- Invalid credentials or account issues

### Monitoring & Logging
- Comprehensive activity logging
- Real-time statistics tracking
- Quota supervision alerts
- Database-backed progress tracking

### Security Considerations
- Credential management (avoid hardcoding)
- Rate limiting to prevent bans
- User consent for automation actions
- Data privacy compliance
- Account security best practices

## Usage Examples

### Simple Liking Bot
```python
from instapy import InstaPy

session = InstaPy(username="user", password="pass", headless_browser=True)
session.login()

session.set_do_like(enabled=True, percentage=80)
session.like_by_tags(["photography", "art"], amount=100)

session.end()
```

### Advanced Marketing Bot
```python
session = InstaPy(username="brand", password="pass", headless_browser=True)
session.login()

# Safety limits
session.set_quota_supervisor(enabled=True,
                           peak_likes_daily=300,
                           peak_follows_daily=50)

# Smart content targeting
session.set_smart_hashtags(["brand", "marketing"], limit=5)
session.set_mandatory_words(["#brand", "#marketing"])

# Multi-action campaign
session.like_by_tags(["marketing", "business"], amount=50, interact=True)
session.follow_user_followers(["competitor1", "competitor2"], amount=20)

session.end()
```

### Relationship Management
```python
session = InstaPy(username="user", password="pass", headless_browser=True)
session.login()

# Analyze relationships
unfollowers = session.pick_unfollowers(username="user")
fans = session.pick_fans(username="user")

# Clean up relationships
session.unfollow_users(amount=50, style="LIFO")

session.end()
```

## Best Practices

1. **Start Small**: Begin with low activity limits and gradually increase
2. **Use Delays**: Always configure action delays to mimic human behavior
3. **Monitor Activity**: Regularly check logs and statistics
4. **Content Filtering**: Use appropriate filters to target relevant content
5. **Account Safety**: Never exceed reasonable daily limits
6. **Backup Data**: Regularly backup the SQLite database
7. **Update Regularly**: Keep InstaPy and dependencies updated

## Troubleshooting

### Common Issues
- **Login Failures**: Check credentials and Instagram's current login flow
- **Rate Limiting**: Reduce activity levels and increase delays
- **Browser Issues**: Update WebDriver and Selenium versions
- **Instagram Changes**: Monitor for API/interface changes

### Debug Mode
```python
session = InstaPy(username="user",
                  password="pass",
                  headless_browser=False,  # Show browser for debugging
                  show_logs=True)
```

### Recovery Strategies
- Implement retry logic for failed actions
- Use multiple accounts for large-scale operations
- Monitor for account restrictions
- Have manual override capabilities