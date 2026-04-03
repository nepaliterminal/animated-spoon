# 🎓 KrynoLux - Advanced Learning Platform

A comprehensive, modern learning platform with real-time admin controls, jump scare mechanics, and full-featured study management. Built with Express.js, SQLite, and vanilla JavaScript.

## ✨ Features

### 👨‍🎓 User Features

#### Study Tools
- **Dashboard** - Overview of progress, goals, and achievements
- **Focus Timer** - Pomodoro timer with multiple focus modes (25min, 50min, 90min, custom)
- **Flashcards** - Create and study with interactive flashcard sets
- **Quiz System** - Answer quiz questions and track performance
- **Progress Tracking** - Real-time study time and streak monitoring
- **Goals & Rewards** - Set study goals and earn badges
- **Offline Mode** - Study without internet connection
- **Dark Mode** - Eye-friendly dark theme

#### Account & Social
- **User Authentication** - Secure JWT-based login/signup
- **Email Verification** - OTP-based email verification for security
- **Password Reset** - Secure password reset with OTP confirmation
- **User Profile** - Customize profile with name, email, education level
- **Account Settings** - Control notifications, offline mode, focus mode preferences
- **Parental Controls** - Weekly email reports and family safety features
- **Notifications** - Real-time alerts for achievements and updates
- **AI Chat Assistant** - Get studying help from AI tutor

### ⚔️ Admin Features (50+)

#### User Management (10 features)
- List and search all users with pagination
- View individual user details and statistics
- Ban/Unban user accounts
- Reset user passwords (send OTP email)
- Verify user emails manually
- Permanently delete user accounts
- Suspend accounts temporarily
- Change user education levels
- Track user registration dates
- View user activity status

#### Content Moderation (10 features)
- List and moderate flashcard content
- Flag inappropriate flashcards
- Approve flagged content
- Delete inappropriate flashcards
- List and moderate quiz questions
- Manage quiz question content
- View user complaints and reports
- Resolve user reports
- Manage banned keyword lists
- Add/remove content filters

#### Analytics & Reports (10 features)
- Total users count and status breakdown
- Verified vs unverified user analytics
- User ban statistics
- Daily signups chart (last 30 days)
- Login statistics
- Average study time per user
- Quiz performance metrics
- Session duration analysis
- Top active users ranking
- User retention metrics

#### System Settings (10 features)
- Configure rate limiting parameters
- Customize email templates
- Toggle features on/off
- Maintenance mode control
- System-wide broadcast messages
- Server logs access
- Database backup triggers
- Security settings configuration
- API configuration review
- Export system data

#### Jump Scare & Online Users (5 features)
- Real-time online user tracking via heartbeat
- Single-user jump scare trigger
- Broadcast jump scare to all online users
- Jump scare history and audit trail
- View currently active users list

#### Admin Management (5 features)
- Add new admin users
- Remove admin privileges
- View all admin accounts
- Manage admin permissions
- Audit log with action history and timestamps

---

## 🛠️ Tech Stack

### Backend
- **Node.js** (v20.x) - JavaScript runtime
- **Express.js** - Web API framework
- **SQLite** (better-sqlite3) - Database with WAL mode
- **JWT** - Secure token-based authentication
- **Bcrypt** - Password hashing
- **Nodemailer** - Email delivery (SMTP)
- **speakeasy** - OTP generation

### Frontend
- **Vanilla JavaScript** - No dependencies
- **HTML5** - Semantic markup
- **CSS3** - Modern styling with CSS variables
- **Fetch API** - REST client
- **Web Storage API** - LocalStorage for session persistence

### Security
- JWT Bearer token authentication
- Bcrypt password hashing
- OTP email verification
- Rate limiting (120 req/15min global, 15 req/15min auth)
- HTTPS-ready configuration
- SQL injection prevention via prepared statements
- Admin role-based access control (RBAC)

---

## 🚀 Getting Started

### Prerequisites
- Node.js v20.x (manage with `nvm use 20`)
- npm or yarn
- Gmail account with app-specific password (for email features)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/nepaliterminal/animated-spoon.git
   cd animated-spoon
   ```

2. **Install dependencies**
   ```bash
   nvm use 20  # Ensure correct Node version
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

4. **Start the server**
   ```bash
   npm start
   ```

The app will start on `http://localhost:3001` (or your configured PORT).

---

## 📝 Environment Variables

Create a `.env` file based on `.env.example`:

```env
# SMTP Configuration (Gmail)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_SECURE=false
EMAIL_FROM=your-email@gmail.com

# JWT Configuration
JWT_SECRET=your-very-long-random-secret-key-make-it-at-least-32-chars
JWT_EXPIRES_IN=7d

# API Configuration
API_PORT=3001
FRONTEND_ORIGIN=http://localhost:3000

# OTP Configuration (optional - these have sensible defaults)
# OTP_DIGITS=6
# OTP_EXPIRES_MINUTES=10
# OTP_MAX_RESENDS=3
```

### Getting Gmail App Password
1. Enable 2-Step Verification on your Google Account
2. Go to [Google App Passwords](https://myaccount.google.com/apppasswords)
3. Generate a password for "Mail" and "Windows Computer"
4. Use the 16-character password as `SMTP_PASS`

---

## 👤 Admin Setup

After initial user registration:

1. **Log in with your account:**
   - Signup with `prankes1332@gmail.com`
   - Verify your email with OTP
   - Set a password

2. **Promote to admin:**
   ```bash
   node init-admin.js
   ```
   This script will automatically:
   - Find `prankes1332@gmail.com` in the database
   - Grant admin privileges
   - Enable access to admin panel

3. **Access Admin Panel:**
   - Log in to the app
   - The ⚔️ Admin button will appear in navigation
   - Click to access admin dashboard with all 50+ features

---

## 📊 Database Schema

### Core Tables

**users**
- id, name, email, password (hashed), verified, banned, education_level, created_at

**sessions**
- id, user_id, token_hash, last_heartbeat, expires_at, created_at

**admins**
- id, user_id, role, permissions, created_at

**audit_log**
- id, admin_id, action, target_user_id, details, created_at

**jump_scare_history**
- id, admin_id, target_user_id, triggered_at

---

## 🔄 Real-Time Features

### Session Heartbeat
- Frontend sends `POST /session/heartbeat` every 30 seconds
- Updates user's online status
- Enables "Online Now" tracking in admin panel

### Jump Scare Delivery
- Frontend polls `GET /check-jump-scare` every 5 seconds
- When scare triggered, full-screen modal appears with emoji and animation
- Auto-dismisses after 5 seconds or on click

---

## 🛡️ Security Features

- **Secure Authentication** - JWT tokens with expiration
- **Password Security** - Bcrypt hashing with salt rounds
- **Email Verification** - OTP-based email confirmation
- **Rate Limiting** - Prevents brute force and DDoS
- **Audit Trail** - Every admin action is logged
- **Role-Based Access** - Admin panel requires admin status
- **Token Hashing** - Session tokens hashed in database
- **CORS Protection** - Configurable allowed origins

---

## 📚 API Endpoints

### Authentication (`/auth`)
- `POST /auth/signup` - Register new user
- `POST /auth/login` - Login with credentials
- `POST /auth/verify-otp` - Verify email or reset OTP
- `POST /auth/reset-password` - Complete password reset

### Admin (`/admin`)
- **Users**: `/admin/users`, `/admin/users/search`, `/admin/users/:id/ban`, etc.
- **Content**: `/admin/content/flashcards`, `/admin/content/quiz`, etc.
- **Analytics**: `/admin/analytics/*`
- **Settings**: `/admin/settings/*`
- **Jump Scare**: `/admin/jump-scare/:userId`, `/admin/jump-scare/broadcast`
- **Admins**: `/admin/admins`, `/admin/audit-log`

### Session (`/session`)
- `POST /session/heartbeat` - Update online status

---

## 🎮 Usage Examples

### As a Regular User
1. Sign up and verify email
2. Set up your profile (name, education level, goals)
3. Use the Focus Timer for study sessions
4. Create and study flashcards
5. Take quizzes to test knowledge
6. Check achievements and streaks
7. Enable notifications for reminders

### As an Admin
1. Log in and access Admin Panel
2. Review dashboard statistics
3. Search and manage users
4. Moderate content
5. View analytics and reports
6. Trigger jump scares on specific users or broadcasts
7. View admin audit log of all actions
8. Configure system settings

---

## 🐛 Troubleshooting

### "EADDRINUSE Port 3001"
```bash
pkill -f "node server.js"
npm start
```

### "Better-sqlite3 version mismatch"
```bash
nvm use 20  # Use correct Node version
npm install
```

### "Admin tab shows black screen"
- Ensure inline `style="display:none;"` is removed from admin panel HTML
- Check that `.panel.active { display: block; }` CSS rule exists

### Jump scares not appearing
- Ensure frontend is polling `GET /check-jump-scare` every 5 seconds
- Check browser console for errors
- Verify session heartbeat is active

---

## 📄 Project Structure

```
.
├── index.html          # Frontend single-page app (4000+ lines)
├── server.js           # Express server & routing
├── admin.js            # Admin API endpoints (50+ features)
├── auth.js             # Authentication endpoints
├── db.js               # Database initialization & schema
├── otp.js              # OTP generation & verification
├── init-admin.js       # Admin promotion script
├── package.json        # Dependencies
├── .env.example        # Environment template
├── .gitignore          # Git ignore rules
└── krynolux.db         # SQLite database (auto-created)
```

---

## 📦 Dependencies

```json
{
  "express": "^4.x",
  "better-sqlite3": "^9.x",
  "jsonwebtoken": "^9.x",
  "bcryptjs": "^2.x",
  "nodemailer": "^6.x",
  "speakeasy": "^2.x",
  "express-rate-limit": "^6.x"
}
```

---

## 📞 Features Breakdown by Category

| Category | Count | Examples |
|----------|-------|----------|
| User Management | 10 | Ban, Verify, Reset Password, Delete |
| Content Moderation | 10 | Flag, Approve, Delete, Banned Words |
| Analytics | 10 | User Counts, Signups Chart, Performance Metrics |
| System Settings | 10 | Rate Limits, Email Templates, Feature Toggle |
| Jump Scare & Online Users | 5 | Single Trigger, Broadcast, History |
| Admin Management | 5 | Add Admin, Permissions, Audit Log |
| **User Features** | 20+ | Auth, Profile, Study Tools, Settings |
| **TOTAL** | **70+** | Complete platform |

---

## 🎯 Future Enhancements

- [ ] Redis session caching for scale
- [ ] GraphQL API alternative
- [ ] Mobile app (React Native)
- [ ] Collaborative study groups
- [ ] Advanced analytics dashboard
- [ ] Custom quiz creation UI
- [ ] Certification programs
- [ ] Integration with learning platforms

---

## 📄 License

MIT License - feel free to use and modify

---

## 🤝 Contributing

Fork, make changes, and submit a pull request!

---

**Built with ❤️ for students everywhere**
