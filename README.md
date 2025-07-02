# FitV: AI Fitness Tracker

A full-stack fitness app with AI-powered exercise info, real-time squat/pushup counting, user authentication, stats, and leaderboards.

---

## Project Structure

```
pls/
  app.py                # Main Flask backend
  config.py             # Configuration (env vars, DB, JWT, Gemini)
  models.py             # SQLAlchemy models (User, SquatSession, PushupSession)
  requirements.txt      # Python dependencies
  frontend/
    src/
      App.js            # Main React app
      components/
        article.js      # AI Exercise Info (Gemini)
        home.js         # Home page
        login.js        # Login form
        signup.js       # Signup form
        squat.js        # AI Squat Counter
        pushup.js       # AI Pushup Counter
        dashboard.js    # User stats and profile
        leaderboard.js  # Leaderboard (all-time & daily)
        NavBar.js       # Navigation bar
      index.js, App.css, etc.
    package.json        # Frontend dependencies
```

---

## Backend (Flask) Overview

### Key Files
- **app.py**: All API endpoints, extension setup, and business logic.
- **models.py**: SQLAlchemy models for users, squats, and pushups.
- **config.py**: Loads environment variables and configures Flask, DB, JWT, Gemini API.

### Main Models
- **User**: id, username, email, password_hash, created_at, updated_at
- **SquatSession**: id, user_id, squat_count, duration, timestamp, date, time
- **PushupSession**: id, user_id, pushup_count, duration, timestamp, date, time

### Key Endpoints
- **Auth:**  
  - `POST /api/register` — Register
  - `POST /api/login` — Login
  - `POST /api/refresh` — Refresh JWT
  - `GET /api/profile` — Get user profile
  - `PATCH /api/profile` — Update user profile (if implemented)
- **Squats/Pushups:**  
  - `POST /api/squat-session` — Save squat session
  - `POST /api/pushup-session` — Save pushup session
  - `GET /api/stats` — Get squat stats
  - `GET /api/pushup-stats` — Get pushup stats
  - `GET /api/sessions` — All squat sessions
  - `GET /api/pushup-sessions` — All pushup sessions
  - `DELETE /api/sessions/<id>` — Delete squat session
  - `DELETE /api/pushup-sessions/<id>` — Delete pushup session
  - `POST /api/reset-stats` — Reset all squat stats
  - `POST /api/reset-pushup-stats` — Reset all pushup stats
- **AI Exercise Info:**  
  - `GET /api/exercise-ai?query=...` — AI summary from Gemini
- **Leaderboard:**  
  - `GET /api/leaderboard/squats` — Top 5 users (all time, squats)
  - `GET /api/leaderboard/squats/daily` — Top 5 users (today, squats)
  - `GET /api/leaderboard/pushups` — Top 5 users (all time, pushups)
  - `GET /api/leaderboard/pushups/daily` — Top 5 users (today, pushups)

---

## Frontend (React) Overview

### Main Components
- **App.js**: Handles routing and authentication state.
- **NavBar.js**: Navigation bar with Home, AI Article, Dashboard, Leaderboard, Logout.
- **login.js / signup.js**: Auth forms.
- **home.js**: Landing page after login.
- **squat.js / pushup.js**: AI-powered exercise counters (TensorFlow.js, pose detection).
- **dashboard.js**: User stats, profile editing.
- **leaderboard.js**: Toggle between all-time and daily leaderboards for squats/pushups.
- **article.js**: AI exercise info search (Gemini, Markdown rendering).

---

## Environment Variables (.env example)

```
DATABASE_URL=postgresql://username:password@localhost:5432/yourdbname
JWT_SECRET_KEY=your_jwt_secret
SECRET_KEY=your_flask_secret
GEMINI_API_KEY=your_gemini_api_key
REDIS_URL=redis://localhost:6379/0
```

---

## Setup Instructions

### Backend
1. **Install dependencies:**
   ```sh
   pip install -r requirements.txt
   ```
2. **Set up PostgreSQL and Redis.**
3. **Set environment variables** (see above).
4. **Create tables:**
   ```python
   with app.app_context():
       db.create_all()
   ```
5. **Run the Flask app:**
   ```sh
   python app.py
   ```

### Frontend
1. **Install dependencies:**
   ```sh
   cd frontend
   npm install
   ```
2. **Start the React app:**
   ```sh
   npm start
   ```

---

## Features

- AI-powered exercise info (Gemini)
- Real-time squat/pushup counting (TensorFlow.js)
- User authentication (JWT)
- Stats and session history
- Leaderboards (all-time & daily, squats & pushups)
- Profile editing
- Caching (Redis) for AI results

---

## Contributing

- Fork the repo, create a feature branch, make changes, test, and submit a pull request.

---

## License

MIT License 
