# Chef-Mate

Full-stack recipe discovery and management platform with AI-powered ingredient recognition from images. Built with **Express.js + MySQL** backend and **Flutter** frontend.

## Features

### Core Recipe Management
- **CRUD recipes** — Create, read, update, delete recipes with ingredients (JSON array), instructions, cuisine, difficulty, prep/cook time, servings
- **Search & filter** — Search by title, description, cuisine, or ingredients; filter by cuisine and difficulty
- **Personalized feed** — Recommendation engine scores recipes based on user's liked/rated recipes (cuisine 35%, ingredients 30%, difficulty 10%, time 15%, favorite creators 10%)
- **Favorites** — Save and manage favorite recipes

### Social & Interaction
- **Ratings (1-5)** with optional "tried it" flag and review comments
- **Likes/dislikes** on recipes and comments
- **Threaded comments** on recipes (max 750 chars)
- **Follow/unfollow** users; view follower/following lists
- **Notifications** — Three types: new recipe from followed user, comment on recipe, reply to comment

### AI-Powered Smart Search
- **Ingredient recognition from images** — Upload a food photo, Groq vision API (Llama 4 Scout 17B) identifies visible ingredients
- **Recipe matching by ingredients** — Paste or type ingredients, server scores all recipes via word-bag matching, returns results sorted by match quality with missing-ingredient details

### Auth & Roles
- **JWT-based authentication** (HS256, 7-day expiry)
- **Three roles**: `user`, `moderator`, `admin`
- Registration with email/password/username, profile management, password change, avatar URL
- Dietary preferences (restrictions, allergies, preferred cuisines) stored as JSON

### Admin & Moderation
- **Dashboard** — System analytics: user counts, recipe counts, activity volume, top contributors
- **Activity timeline** — Paginated feed of registrations, recipes, comments, ratings
- **User management** — Search, filter by role, sort, paginate; suspend/ban users
- **Content moderation** — Report content (recipes/comments/users), review and resolve reports
- **Moderation log** — Audit trail of moderator/admin actions

## Architecture

```
project/
├── server/                    # Express.js backend (Node.js + MySQL)
│   ├── index.js               # App entry: security, rate limiting, routes, DB init
│   ├── config/
│   │   ├── database.js        # MySQL pool connection + auto-migration
│   │   └── validation.js      # validateId helper
│   ├── middleware/
│   │   └── auth.js            # JWT middleware (authenticateToken, optionalAuth, role guards)
│   ├── routes/
│   │   ├── auth.js            # Register, login, profile, preferences, role management
│   │   ├── recipes.js         # CRUD, search, favorites, likes, ratings, comments, scan, by-ingredients
│   │   ├── users.js           # Public profile, follow/unfollow, followers/following
│   │   ├── notifications.js   # List, mark read, unread count
│   │   └── admin.js           # Stats, activity, reports, moderation, user/recipe/comment management
│   ├── services/
│   │   ├── vision.js          # Groq API integration for ingredient recognition
│   │   └── recommendation.js  # Personalized recipe scoring engine
│   └── migrations/            # SQL migration files
├── chef_mate_app/             # Flutter frontend (cross-platform)
│   └── lib/
│       ├── main.dart          # App entry with routing
│       ├── config/            # Theme, API config
│       ├── models/            # Recipe, User, Comment, Notification, Rating data classes
│       ├── providers/         # AuthProvider, RecipeProvider, UserProvider, NotificationProvider
│       ├── screens/           # 14 screens (splash, login, register, home, recipe detail,
│       │                      #   add recipe, my recipes, favorites, profile, user profile,
│       │                      #   notifications, admin, admin users, smart search)
│       ├── services/          # API service layer (auth, recipe, user, notification)
│       └── widgets/           # Reusable widgets (recipe card, rating, comment tile, etc.)
├── .env.example               # Environment variable template
└── package.json               # Backend dependencies
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js, Express.js, MySQL (mysql2/promise) |
| Frontend | Flutter, Provider (state management) |
| Auth | JWT (HS256), bcrypt (12 rounds) |
| Security | Helmet, CORS, express-rate-limit |
| AI Vision | Groq API — meta-llama/llama-4-scout-17b-16e-instruct |
| Uploads | Multer (in-memory, 5 MB limit) |

## API Endpoints

### Auth (`/api/auth`)
- `POST /register`, `POST /login`, `POST /logout`
- `GET /me`, `GET /profile`, `PUT /profile`
- `POST /change-password`, `PUT /preferences`, `POST /avatar`
- `GET /statistics`
- `POST /admin/assign-moderator/:userId` (admin), `POST /admin/remove-moderator/:userId` (admin), `GET /admin/users` (admin)

### Recipes (`/api/recipes`)
- `GET /` (list + search/filter), `GET /:id`, `GET /user/:userId`
- `POST /` (create), `PUT /:id`, `DELETE /:id`
- `POST /scan-ingredients` (image → Groq → ingredient list)
- `POST /by-ingredients` (ingredients → matched recipes)
- `POST /favorites/:recipeId`, `DELETE /favorites/:recipeId`, `GET /favorites/:userId`
- `GET /:recipeId/likes`, `POST /:recipeId/likes`, `DELETE /:recipeId/likes`
- `GET /:recipeId/ratings`, `POST /:recipeId/ratings`, `DELETE /:recipeId/ratings`
- `GET /:recipeId/comments`, `POST /:recipeId/comments`
- `POST /comments/:commentId/likes`, `DELETE /comments/:commentId/likes`, `DELETE /comments/:commentId`

### Users (`/api/users`)
- `GET /:id`, `GET /:id/recipes`
- `POST /:id/follow`, `DELETE /:id/follow`
- `GET /:id/followers`, `GET /:id/following`

### Notifications (`/api/notifications`)
- `GET /` (list, paginated, unread_only filter)
- `GET /unread-count`
- `PUT /:id/read`, `PUT /read-all`

### Admin (`/api/admin`) — moderator or admin
- `GET /stats`, `GET /activity`, `GET /top-users`
- `GET /users`, `GET /users/:userId`, `PATCH /users/:userId/status`, `DELETE /users/:userId` (admin)
- `GET /reported-content`, `POST /report`, `PATCH /reports/:reportId`
- `GET /recipes`, `DELETE /recipes/:recipeId`
- `GET /comments`, `DELETE /comments/:commentId`
- `GET /moderation-log` (admin)

## Setup

1. **Clone and configure**
   ```
   cp .env.example .env
   ```
   Edit `.env` with your MySQL credentials and Groq API key.

2. **Backend**
   ```
   npm install
   node server/index.js
   ```
   Tables auto-create on startup.

3. **Flutter app**
   ```
   cd chef_mate_app
   flutter pub get
   flutter run -d chrome
   ```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DB_HOST` | MySQL host |
| `DB_PORT` | MySQL port |
| `DB_USER` | MySQL user |
| `DB_PASSWORD` | MySQL password |
| `DB_NAME` | Database name (chef_mate) |
| `JWT_SECRET` | Secret key for JWT signing |
| `JWT_EXPIRES_IN` | Token expiry (e.g. 7d) |
| `PORT` | Server port (default 3001) |
| `NODE_ENV` | development / production |
| `GROQ_API_KEY` | API key for Groq vision service |

## Security

- Passwords hashed with bcrypt (12 rounds)
- JWT with HS256, validated against DB on every request
- Rate limiting: 20 req/15min on auth, 100 req/15min on general routes
- Helmet security headers, strict CORS configuration
- Input validation (email format, password length, ID validation)
- Parameterized SQL queries (no injection)
- `.env` gitignored — secrets never committed
