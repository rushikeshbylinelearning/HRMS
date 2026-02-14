# Announcements Feature - Visual Guide

## 🎨 UI Components Overview

### 1. Megaphone Icon with Unread Indicator

```
┌─────────────────────────────────────┐
│  TopBar                             │
│  ┌──────┐  ┌──────┐  ┌──────┐      │
│  │  📢  │  │  🔔  │  │  👤  │      │
│  │  •   │  │  99+ │  │      │      │
│  └──────┘  └──────┘  └──────┘      │
│   ^                                 │
│   └─ Blue blinking dot              │
└─────────────────────────────────────┘
```

**Features:**
- Megaphone icon (📢) instead of bell
- Blue dot (•) in top-right corner when unread
- Dot blinks with 1.5s animation cycle
- Disappears when dropdown is opened

---

### 2. Dropdown Panel Layout

```
┌─────────────────────────────────────────┐
│  📢 Company Announcements          ✕    │
├─────────────────────────────────────────┤
│                                         │
│  👤 John Doe                            │
│     ┌─────────────────────┐            │
│     │ Hey team! Meeting   │            │
│     │ at 3pm today        │            │
│     └─────────────────────┘            │
│     2m ago                              │
│                                         │
│                              You        │
│            ┌─────────────────────┐     │
│            │ Thanks for the      │     │
│            │ update! 👍          │     │
│            └─────────────────────┘     │
│                              Just now   │
│                                         │
├─────────────────────────────────────────┤
│  😊  [Write a message...]         ➤    │
└─────────────────────────────────────────┘
```

**Layout:**
- Header with megaphone icon and close button
- Scrollable message area
- Input bar with emoji picker and send button

---

### 3. Message Styles

#### Other User's Message (Left-aligned, Gray)
```
👤 John Doe
   ┌──────────────────────┐
   │ Hello everyone!      │  ← Gray bubble (#e5e5ea)
   └──────────────────────┘     Black text
   2m ago
```

#### Your Message (Right-aligned, Blue)
```
                        You
   ┌──────────────────────┐
   │ Thanks for sharing!  │  ← Blue bubble (#007AFF)
   └──────────────────────┘     White text
                        Just now
```

#### Grouped Messages (Same sender)
```
👤 John Doe
   ┌──────────────────────┐
   │ First message        │
   └──────────────────────┘
   
   ┌──────────────────────┐  ← No avatar repeated
   │ Second message       │
   └──────────────────────┘
   2m ago
```

---

### 4. Emoji Picker

```
┌─────────────────────────────────┐
│  Smileys                        │
│  😀 😃 😄 😁 😅 😂 🤣 😊      │
│  😇 🙂 🙃 😉 😌 😍 🥰 😘      │
│                                 │
│  Gestures                       │
│  👍 👎 👊 ✊ 🤛 🤜 🤞 ✌️      │
│  🤟 🤘 👌 🤌 🤏 👈 👉 👆      │
│                                 │
│  Hearts                         │
│  ❤️ 🧡 💛 💚 💙 💜 🖤 🤍      │
│                                 │
│  Celebrations                   │
│  🎉 🎊 🎈 🎁 🎀 🎂 🍰 🧁      │
│                                 │
│  Objects                        │
│  💼 📁 📂 🗂️ 📅 📆 🗒️ 🗓️      │
└─────────────────────────────────┘
```

**Features:**
- 5 categories with 170+ emojis
- 8-column grid layout
- Scrollable content
- Hover effects (scale 1.2)
- Click to insert emoji

---

### 5. Input Bar

```
┌─────────────────────────────────────────┐
│  😊  [Write a message...]         ➤    │
│  ^    ^                           ^     │
│  │    │                           │     │
│  │    └─ Input field              │     │
│  │                                 │     │
│  └─ Emoji picker button           │     │
│                                    │     │
│                    Send button ────┘     │
└─────────────────────────────────────────┘
```

**Components:**
1. **Emoji button** (😊) - Opens emoji picker
2. **Input field** - Rounded, 1000 char limit
3. **Send button** (➤) - Blue circle, disabled when empty

---

## 🎨 Color Palette

### Primary Colors
- **iOS Blue**: `#007AFF` - Own messages, send button, unread dot
- **Light Gray**: `#e5e5ea` - Other messages
- **Dark Gray**: `#8e8e93` - Labels, timestamps

### Text Colors
- **On Blue**: `#ffffff` (white)
- **On Gray**: `#000000` (black)
- **Labels**: `#8e8e93` (gray)

### Backgrounds
- **Panel**: `rgba(255, 255, 255, 0.95)` with backdrop-blur
- **Input**: `#ffffff` (white)
- **Hover**: `rgba(0, 0, 0, 0.05)`

---

## 📐 Dimensions

### Desktop (Default)
- **Dropdown width**: 420px
- **Dropdown height**: 500px
- **Emoji picker**: 320px × 300px
- **Message bubble**: Max 260px width

### Tablet
- **Dropdown width**: 360px
- **Dropdown height**: 450px
- **Message bubble**: Max 220px width

### Mobile
- **Dropdown width**: Full width - 16px
- **Dropdown height**: 70vh (max 500px)
- **Message bubble**: Max 80% width

---

## 🎭 Animations

### 1. Unread Dot Blink
```
0%   ━━━━━━━━━━ Opacity: 1.0, Scale: 1.0
25%  ━━━━━━━━━━ Opacity: 0.7, Scale: 0.95
50%  ━━━━━━━━━━ Opacity: 0.4, Scale: 0.9
75%  ━━━━━━━━━━ Opacity: 0.7, Scale: 0.95
100% ━━━━━━━━━━ Opacity: 1.0, Scale: 1.0
```
Duration: 1.5s, Infinite loop

### 2. Message Fade-In
```
0%   ━━━━━━━━━━ Opacity: 0, Y: +4px
100% ━━━━━━━━━━ Opacity: 1, Y: 0px
```
Duration: 0.3s, Ease-out

### 3. Dropdown Slide-Down
```
0%   ━━━━━━━━━━ Opacity: 0, Y: -8px, Scale: 0.95
100% ━━━━━━━━━━ Opacity: 1, Y: 0px, Scale: 1.0
```
Duration: 0.2s, Ease-out

### 4. Emoji Hover
```
Normal ━━━━━━━━ Scale: 1.0
Hover  ━━━━━━━━ Scale: 1.2
```
Duration: 0.15s, Ease

---

## 🔄 State Indicators

### Unread State
```
📢  ← Megaphone icon
 •  ← Blue blinking dot (unread)
```

### Read State
```
📢  ← Megaphone icon only
    (no dot)
```

### Sending State
```
[Write a message...]  [➤]  ← Normal
[Sending...]          [⊗]  ← Disabled (grayed out)
```

### Empty State
```
┌─────────────────────────────────┐
│                                 │
│           📢                    │
│                                 │
│    No announcements yet         │
│    Be the first to post!        │
│                                 │
└─────────────────────────────────┘
```

---

## 🎯 Interactive Elements

### Hover States
1. **Megaphone button**: Light gray background
2. **Emoji button**: Light gray background, blue color
3. **Send button**: Darker blue, scale 1.05
4. **Emoji**: Blue background, scale 1.2
5. **Close button**: Light gray background

### Active States
1. **Megaphone button**: Darker gray background
2. **Send button**: Scale 0.95
3. **Input focus**: Blue border, blue shadow

### Disabled States
1. **Send button**: Gray background, no hover
2. **Input (sending)**: Gray background, no interaction

---

## 📱 Responsive Breakpoints

```
Desktop (≥768px)
├─ Width: 420px
├─ Height: 500px
└─ Emoji grid: 8 columns

Tablet (480px - 767px)
├─ Width: 360px
├─ Height: 450px
└─ Emoji grid: 8 columns

Mobile (≤479px)
├─ Width: calc(100vw - 16px)
├─ Height: 70vh (max 500px)
└─ Emoji grid: 8 columns
```

---

## 🎨 Typography

### Font Sizes
- **Header title**: 15px, weight 600
- **Sender label**: 11px, weight 500
- **Message text**: 15px, weight 400
- **Timestamp**: 11px, weight 400
- **Input**: 14px, weight 400
- **Emoji category**: 12px, weight 600

### Line Heights
- **Message text**: 1.4
- **All others**: Default (1.5)

---

## 🔍 Accessibility

### ARIA Labels
- Megaphone button: "Announcements"
- Close button: "Close"
- Emoji button: "Add emoji"
- Send button: "Send message"

### Keyboard Support
- `Enter` - Send message
- `Esc` - Close dropdown (via click-outside)
- `Tab` - Navigate between input and buttons

### Screen Reader
- Sender names announced before messages
- Timestamps announced after messages
- Button states announced (disabled/enabled)

---

## 🎉 Visual Hierarchy

```
1. Header (Megaphone + Title)
   ↓
2. Messages (Scrollable)
   ├─ Sender name (small, gray)
   ├─ Message bubble (large, colored)
   └─ Timestamp (small, gray)
   ↓
3. Input Bar (Fixed bottom)
   ├─ Emoji button (left)
   ├─ Input field (center)
   └─ Send button (right)
```

This visual guide provides a complete reference for the announcements feature design!
