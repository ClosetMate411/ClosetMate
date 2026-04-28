# ClosetMate

ClosetMate is an AI-powered wardrobe and outfit assistant that helps users manage clothing items, generate outfit combinations, and share looks with the community.

Repository: https://github.com/ClosetMate411/ClosetMate

## Features

- AI-assisted outfit generation from wardrobe items
- Wardrobe management (add, edit, delete, categorize clothing)
- Community feed with:
- Reactions
- Star ratings
- Favorites
- Comments and replies
- User profiles and shared outfit history
- Notifications for community interactions

## Project Structure

- `mobile/` React Native (Expo) mobile app
- `frontend/` Web application
- `backend/` API/backend services

## Tech Stack

- React Native + Expo (mobile)
- React (web)
- JavaScript
- Zustand for state management
- REST API integration

## Getting Started

### Prerequisites

- Node.js (LTS recommended)
- npm or yarn
- Expo CLI (via `npx expo`)

### Mobile App

```bash
cd mobile
npm install
npx expo start --lan --clear
```

### Web App

```bash
cd frontend
npm install
npm run dev
```

### Backend

```bash
cd backend
npm install
npm run dev
```

## Community Module

Community includes four main tabs:

- Feed
- Top Rated
- Favorites
- Notifications

Users can react, rate, favorite, comment, and manage shared outfits.

## Contributing

1. Create a feature branch
2. Commit your changes with clear messages
3. Open a pull request

## License

This project is currently private/internal unless otherwise specified by the repository owner.
