# TQOrders

A simple Expo React Native cafeteria app for Android and iOS with local SQLite storage.

## Features
- Table list screen
- Table-specific order view
- Add menu items to a table order
- Update quantity or remove items
- Local SQLite persistence using `expo-sqlite`

## Setup

1. Open a terminal in `c:\Users\Robert's PC\Desktop\TQOrders`
2. Install dependencies:
   - `npm install`
3. Start the Expo development server:
   - `npm start`

## Run
- `npm run android`
- `npm run ios`
- `npm run web`

## Files
- `App.js` — main app view and table/order UI
- `db.js` — SQLite initialization and CRUD helpers
- `data/menu.js` — sample cafeteria menu items

## Notes
- The app initializes default tables and menu items on first launch.
- Orders are stored locally and restored when the app restarts.
