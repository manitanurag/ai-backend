# Backend - AI Interview Prep

Backend API for the AI-Powered Interview Prep application.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables in `.env`:
```env
PORT=5000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
OPENAI_API_KEY=your_openai_api_key
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
FRONTEND_URL=http://localhost:5173
```

3. Run development server:
```bash
npm run dev
```

## API Documentation

### Auth Routes
- `POST /api/auth/signup` - Register user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user

### Document Routes
- `POST /api/documents/upload` - Upload PDF
- `GET /api/documents/list` - List documents
- `DELETE /api/documents/:id` - Delete document

### Chat Routes
- `POST /api/chat/start` - Start interview
- `POST /api/chat/query` - Query chat
- `GET /api/chat/:chatId` - Get chat history
- `GET /api/chat/sessions` - Get all sessions

## Technologies

- Express.js
- MongoDB + Mongoose
- OpenAI API
- JWT Authentication
- Cloudinary
- pdf-parse
