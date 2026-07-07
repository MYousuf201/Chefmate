# Chef-Mate

AI-powered recipe discovery and management platform with ingredient recognition from images.

## Dataflow

1. User uploads a food/ingredient image via the Smart Search screen
2. Image is sent to `POST /recipes/scan-ingredients` which forwards it to Groq (Llama 4 Scout 17B) for ingredient recognition
3. Recognized ingredients are returned to the client as a chip-based editable list
4. User can add/edit/remove ingredients, then triggers `POST /recipes/by-ingredients`
5. Server scores all recipes by word-bag matching against the ingredient list, returning results sorted by match quality with missing-ingredient details

## Changes Required

- Add your own API keys in `.env` (see `.env.example`)
- Set up a MySQL database named `chef_mate` and run the schema
- Install backend dependencies: `npm install`
- Install Flutter dependencies: `cd chef_mate_app && flutter pub get`
- Start backend: `node server/index.js`
- Start Flutter app: `cd chef_mate_app && flutter run -d chrome`
