# Notification Sounds

This directory contains notification sound files for the attendance system.

## Required Sound Files

### Core Notification Sounds
- `notification.mp3` - Default notification sound (general notifications)
- `announcement.mp3` - Company announcement sound (NEW)
- `admin-notification.mp3` - Distinct sound for admin-to-employee notifications
- `leave-rejection.mp3` - Sound for leave rejection notifications
- `policy-update.mp3` - Unique sound for policy add/update notifications

## Sound File Requirements

- Format: MP3
- Duration: 0.5-3 seconds
- Size: < 100KB recommended for optimal performance
- Volume: Moderate (not too loud or too quiet)
- Quality: Clear and pleasant

## Implementation

### Announcement Sound System
Announcement sounds are managed by `NotificationSoundManager.js` which:
- Prevents sound spam with 1-second throttling
- Handles playback errors gracefully
- Supports volume control (default: 0.7)
- Preloads sounds for instant playback
- Ensures only one sound plays at a time

### Usage
```javascript
import soundManager from '../services/NotificationSoundManager';

// Play announcement sound
await soundManager.playAnnouncement();

// Play general notification sound
await soundManager.playGeneral();

// Adjust volume (0.0 to 1.0)
soundManager.setVolume(0.5);
```

## Free Sound Resources

Replace placeholder files with actual MP3 audio:

1. **Freesound.org** - https://freesound.org/
   - Large library of CC-licensed sounds
   - Search for "notification", "chime", "bell"

2. **Mixkit** - https://mixkit.co/free-sound-effects/
   - Free notification sounds
   - No attribution required

3. **Zapsplat** - https://www.zapsplat.com/
   - Professional sound effects
   - Free with attribution

4. **Notification Sounds** - https://notificationsounds.com/
   - Specifically for notifications
   - Various formats available

## Sound Selection Guidelines

### Announcement Sound (announcement.mp3)
- Duration: 0.5 - 2 seconds
- Tone: Professional, attention-grabbing
- Volume: Medium (not jarring)
- Examples: Bell chime, soft gong, pleasant ding

### General Notification Sound (notification.mp3)
- Duration: 0.3 - 1 second
- Tone: Subtle, non-intrusive
- Volume: Low-medium
- Examples: Soft pop, gentle beep, short tone

## Browser Compatibility

- **Chrome/Edge:** Full support
- **Firefox:** Full support
- **Safari:** Requires user interaction before first play
- **Mobile:** May require user interaction, respects silent mode

## Adding Sound Files

1. Place the sound files in this directory
2. Ensure they are named exactly as specified above
3. Verify file size (< 100KB recommended)
4. Test the sounds in the application

## Testing

Test sounds in the browser console:
```javascript
import soundManager from '../services/NotificationSoundManager';

// Test announcement sound
soundManager.testAnnouncement();

// Test general notification sound
soundManager.testGeneral();
```

## Fallback

If sound files are not available, the system will:
- Log an error to console
- Continue functioning without sound
- Not break the application

## Notes

- Sounds are throttled to prevent spam (1 second minimum between plays)
- Only one sound can play at a time
- Sounds respect browser autoplay policies
- Failed playback is logged but doesn't break functionality

