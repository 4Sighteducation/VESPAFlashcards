# Knack Integration Script for VESPA Flashcards

This script provides seamless integration between Knack databases and the VESPA Flashcards application. It handles user authentication, data synchronization, and enables real-time communication between the two platforms.

## Overview

The Knack Integration Script is a JavaScript file that runs within a Knack application to connect with the VESPA Flashcards app. It handles:

- User authentication and authorization
- Loading flashcard data from Knack
- Saving flashcard data back to Knack
- Managing spaced repetition scheduling
- Error handling and data recovery

## Setup Instructions

### 1. Create a Configuration Object

First, add a configuration object to your Knack application's JavaScript settings:

```javascript
window.VESPA_CONFIG = {
  knackAppId: "YOUR_KNACK_APP_ID",
  knackApiKey: "YOUR_KNACK_API_KEY",
  appUrl: "https://your-flashcards-app-url.herokuapp.com/",
  appConfig: {
    'scene_1206': {
      'view_3005': {
        appType: 'flashcard-app',
        elementSelector: '.kn-rich-text',
      }
    }
  }
};
```

Replace:
- `YOUR_KNACK_APP_ID` with your Knack application ID
- `YOUR_KNACK_API_KEY` with your Knack API key
- `appUrl` with the URL to your deployed VESPA Flashcards app
- Adjust scene and view IDs to match your Knack application structure

### 2. Add the Script to Knack

1. In your Knack builder, go to Settings → API & Code
2. Under "JavaScript", add the content of `KnackIntegrationScript.js`
3. Make sure the script is loaded after jQuery and after your VESPA_CONFIG object

## Required Knack Structure

The script expects these objects in your Knack application:

1. **User Object (Object_3)** - Standard Knack user accounts
2. **Flashcard Storage Object (Object_102)** with these fields:
   - User ID (field_2954)
   - User Email (field_2958)
   - Account Connection (field_2956)
   - VESPA Customer Connection (field_3008)
   - Tutor Connection (field_3009)
   - Flashcard Bank JSON (field_2979)
   - Last Saved Date (field_2957)
   - Spaced Repetition Boxes (field_2986 through field_2990)
   - Color Mapping (field_3000)
   - Topic Lists JSON (field_3011)
   - Topic Metadata JSON (field_3030)
   - User Name (field_3010)
   - Tutor Group (field_565)
   - Year Group (field_548)
   - User Role (field_73)

## How It Works

1. The script initializes when the specified Knack scene is rendered
2. It creates an iframe to load the VESPA Flashcards application
3. It passes the current user's authentication and data to the flashcards app
4. It listens for messages from the flashcards app to save data back to Knack
5. It handles data serialization and error recovery

## Security Considerations

- This script does not store API keys in the client code (they should be in server environment variables)
- User authentication uses Knack's built-in token system
- All communication happens through the parent-child iframe relationship
- HTML content is sanitized to prevent XSS attacks

## Troubleshooting

### Common Issues

1. **App Not Loading**: Check that the scene and view IDs match your Knack application.
2. **Authentication Errors**: Ensure the user is logged in to Knack before accessing the page.
3. **Data Not Saving**: Verify the Object_102 fields match the expected field IDs.
4. **Too Many Requests (429)**: The script now includes rate limiting protection.

### Debug Mode

To enable detailed logging to help identify issues:

```javascript
window.VESPA_CONFIG.debug = true;
```

## Updating the Script

When you need to update the script:

1. Make your changes to `KnackIntegrationScript.js`
2. Test thoroughly in a development environment
3. Copy the updated script into your Knack application's JavaScript settings

## Version History

- **1.0.0**: Initial release 
- **1.1.0**: Added support for spaced repetition scheduling
- **2.0.0**: Fixed communication loop issues and added data standardization

## License

MIT License - See LICENSE file for details.

## Support

For support, please contact the VESPA Flashcards development team.
