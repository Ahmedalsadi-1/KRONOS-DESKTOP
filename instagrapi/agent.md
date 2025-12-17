# Instagrapi Agent Integration

## Purpose

Instagrapi is a comprehensive Python library that provides an unofficial Instagram Private API wrapper. It enables programmatic access to Instagram's features including user management, media operations, direct messaging, insights, and content management. As an agent in the unified automation platform, instagrapi enables automated Instagram operations for social media management, content automation, and data collection.

## Key Features

- **Authentication**: Login via username/password, session persistence, and 2FA support
- **Media Operations**: Upload/download photos, videos, IGTV, Reels, Albums, and Stories
- **User Management**: Follow/unfollow, user information retrieval, relationship management
- **Content Interaction**: Like, comment, and engage with posts
- **Direct Messaging**: Send/receive messages and manage conversations
- **Insights & Analytics**: Access account, post, and story analytics
- **Challenge Resolution**: Automated handling of Instagram security challenges
- **Proxy Support**: Built-in proxy management for multiple account operations

## API Endpoints

### Authentication
- `POST /auth/login` - Login with username/password
- `POST /auth/login_session` - Login with session ID
- `POST /auth/logout` - Logout current session
- `POST /auth/challenge_resolve` - Handle security challenges

### User Operations
- `GET /users/{user_id}` - Get user information
- `GET /users/{username}/info` - Get user info by username
- `POST /users/{user_id}/follow` - Follow a user
- `POST /users/{user_id}/unfollow` - Unfollow a user
- `GET /users/{user_id}/followers` - Get user followers
- `GET /users/{user_id}/following` - Get users being followed

### Media Operations
- `GET /media/{media_id}` - Get media information
- `POST /media/upload` - Upload media (photo/video/story)
- `GET /media/{media_id}/download` - Download media
- `POST /media/{media_id}/like` - Like a post
- `POST /media/{media_id}/unlike` - Unlike a post
- `GET /media/{media_id}/comments` - Get post comments
- `POST /media/{media_id}/comment` - Add comment to post

### Direct Messaging
- `GET /direct/threads` - Get message threads
- `POST /direct/send` - Send direct message
- `GET /direct/{thread_id}/messages` - Get thread messages
- `POST /direct/{thread_id}/read` - Mark thread as read

### Insights & Analytics
- `GET /insights/account` - Get account insights
- `GET /insights/media/{media_id}` - Get media insights
- `GET /insights/story/{story_id}` - Get story insights

### Hashtag & Location
- `GET /hashtags/{hashtag}/info` - Get hashtag information
- `GET /hashtags/{hashtag}/media` - Get hashtag media
- `GET /locations/{location_id}/info` - Get location information
- `GET /locations/{location_id}/media` - Get location media

## Commands

### Core Commands
- `instagram login <username> <password>` - Authenticate with Instagram
- `instagram logout` - End current session
- `instagram user info <username>` - Get user information
- `instagram media download <url>` - Download media from URL
- `instagram media upload <path> [caption]` - Upload media with optional caption

### Automation Commands
- `instagram follow <username>` - Follow a user
- `instagram unfollow <username>` - Unfollow a user
- `instagram like <media_url>` - Like a post
- `instagram comment <media_url> <text>` - Comment on a post
- `instagram message <username> <text>` - Send direct message

### Monitoring Commands
- `instagram insights account` - Get account analytics
- `instagram insights media <media_id>` - Get media performance
- `instagram followers <username>` - List user followers
- `instagram following <username>` - List users being followed

## Dependencies

### Core Dependencies
```json
{
  "instagrapi": ">=2.2.1",
  "requests": "==2.32.5",
  "PySocks": "==1.7.1",
  "pydantic": "==2.12.4",
  "moviepy": "==1.0.3",
  "pycryptodomex": "==3.23.0"
}
```

### Optional Dependencies
```json
{
  "Pillow": ">=8.1.1",
  "moviepy": ">=1.0.3"
}
```

### System Requirements
- Python >= 3.9
- pip package manager
- Internet connection for API access

## Setup Instructions

### 1. Environment Setup
```bash
# Create virtual environment
python -m venv instagrapi_env
source instagrapi_env/bin/activate  # Linux/Mac
# or
instagrapi_env\Scripts\activate     # Windows

# Install instagrapi
pip install instagrapi
```

### 2. Configuration
Create a configuration file `config.json`:
```json
{
  "username": "your_instagram_username",
  "password": "your_instagram_password",
  "session_file": "session.json",
  "proxy": null,
  "delay_range": [1, 3]
}
```

### 3. Basic Usage Example
```python
from instagrapi import Client

# Initialize client
cl = Client()

# Login
cl.login("username", "password")

# Get user information
user = cl.user_info_by_username("target_user")
print(f"User: {user.username}, Followers: {user.follower_count}")

# Download recent posts
medias = cl.user_medias(user.pk, amount=5)
for media in medias:
    cl.photo_download(media.pk)
```

### 4. Session Persistence
```python
# Save session after login
cl.dump_settings("session.json")

# Load session later
cl = Client()
cl.load_settings("session.json")
cl.login("username", "password")  # No credentials needed if session is valid
```

## Integration Details

### Platform Adapter Structure
```
unified-automation-platform/
├── src/main/api/
│   └── instagrapi-adapter.js
├── src/main/services/
│   └── instagram-service.js
└── src/renderer/components/
    └── InstagramManager.js
```

### Adapter Implementation
```javascript
// instagrapi-adapter.js
class InstagrapiAdapter extends BaseAdapter {
  constructor() {
    super();
    this.pythonProcess = null;
    this.client = null;
  }

  async initialize(config) {
    // Start Python process with instagrapi
    this.pythonProcess = spawn('python', ['instagram_agent.py'], {
      cwd: path.join(__dirname, '../../../instagrapi'),
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // Setup IPC communication
    this.setupIPC();
  }

  async login(credentials) {
    return this.sendCommand('login', credentials);
  }

  async getUserInfo(username) {
    return this.sendCommand('get_user_info', { username });
  }

  async uploadMedia(filePath, caption) {
    return this.sendCommand('upload_media', { filePath, caption });
  }
}
```

### Service Registration
```javascript
// service-registry.js
const instagrapiAdapter = new InstagrapiAdapter();
serviceRegistry.register('instagram', instagrapiAdapter);
```

### Error Handling
Instagrapi includes comprehensive error handling for:
- Authentication failures
- Rate limiting
- Challenge requirements
- Network issues
- Invalid media formats

### Security Considerations
- Store credentials securely (environment variables or encrypted storage)
- Use session persistence to avoid frequent logins
- Implement rate limiting to respect Instagram's API limits
- Handle 2FA challenges appropriately
- Use proxies for multiple account management

### Monitoring & Logging
- Session status monitoring
- API rate limit tracking
- Error logging and alerting
- Performance metrics collection

### Scaling Considerations
- Multiple account support via proxy rotation
- Session management for concurrent operations
- Queue system for bulk operations
- Distributed deployment for high-volume automation

## Testing

### Unit Tests
```bash
# Run instagrapi test suite
cd instagrapi
python -m pytest tests/ -v
```

### Integration Tests
```javascript
// Test adapter integration
describe('InstagrapiAdapter', () => {
  test('should login successfully', async () => {
    const adapter = new InstagrapiAdapter();
    await adapter.initialize(testConfig);
    const result = await adapter.login(testCredentials);
    expect(result.success).toBe(true);
  });
});
```

## Troubleshooting

### Common Issues
1. **Login Challenges**: Instagram may require additional verification
2. **Rate Limiting**: Respect API limits to avoid bans
3. **Session Expiration**: Implement automatic re-authentication
4. **Proxy Issues**: Ensure proxy compatibility with Instagram

### Debug Mode
```python
import logging
logging.basicConfig(level=logging.DEBUG)
cl = Client()
```

### Support Resources
- [Instagrapi GitHub](https://github.com/subzeroid/instagrapi)
- [Telegram Support Chat](https://t.me/instagrapi)
- [Documentation](https://subzeroid.github.io/instagrapi/)

## Future Enhancements

- Account registration automation
- Captcha solving integration
- Advanced analytics dashboard
- Multi-account management interface
- Scheduled posting system
- Content generation integration