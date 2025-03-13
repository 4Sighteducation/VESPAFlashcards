# VESPA Academy Flashcard App

This is a React application that integrates with Knack to provide a flashcard study tool with spaced repetition learning. The app allows users to create, organize, and study flashcards using proven spaced repetition techniques.

## Features

- Create and manage flashcards organized by subjects and topics
- Multiple card types: short answer, multiple choice, essay, acronym
- Color coding for easy categorization
- Spaced repetition system with 5 boxes for optimized learning
- Seamless integration with Knack database
- Responsive design for mobile and desktop

## Project Structure

- `src/App.js` - Main application component
- `src/components/` - React components for various app features
- `knack-flashcard-integration.js` - Custom JavaScript for Knack integration

## Local Development

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Start the development server:
   ```
   npm start
   ```
4. Open [http://localhost:3000](http://localhost:3000) to view the app in development mode

## Deployment

### Heroku Deployment

1. Create a Heroku account if you don't have one
2. Install the Heroku CLI
3. Login to Heroku:
   ```
   heroku login
   ```
4. Create a new Heroku app:
   ```
   heroku create vespa-flashcards
   ```
5. Deploy to Heroku:
   ```
   git push heroku main
   ```
6. Open the deployed app:
   ```
   heroku open
   ```

### Knack Integration

1. Log in to your Knack Builder account
2. Go to Settings > API & Code
3. Add the contents of `knack-flashcard-integration.js` to the JavaScript section
4. Make sure to update the scene and view IDs in the configuration if necessary
5. Create a new Scene and View in Knack for hosting the app
6. Add a Rich Text field to the View where the app will be embedded
7. Update the configuration in the JavaScript to match your Scene and View IDs

## Data Structure

The app uses the following Knack object fields:

- `field_2954` - User ID
- `field_2958` - User email
- `field_2956` - Account Connection
- `field_3008` - VESPA Customer Connection
- `field_3009` - Tutor Connection
- `field_2979` - Flashcard Bank JSON Store
- `field_2957` - Date Last Saved
- `field_2986` - Box 1 JSON
- `field_2987` - Box 2 JSON
- `field_2988` - Box 3 JSON
- `field_2989` - Box 4 JSON
- `field_2990` - Box 5 JSON
- `field_3000` - Color Mapping

## GitHub Repository Setup

1. Create a new GitHub repository
2. Initialize git in your local project:
   ```
   git init
   ```
3. Add the GitHub repository as remote:
   ```
   git remote add origin https://github.com/yourusername/vespa-flashcards.git
   ```
4. Push the code to GitHub:
   ```
   git add .
   git commit -m "Initial commit"
   git push -u origin main
   ```

## Recommended Workflow

1. Develop and test locally
2. Push changes to GitHub
3. Deploy from GitHub to Heroku using GitHub integration or manual `git push heroku main`
4. Update the Knack JavaScript if integration logic changes
