# Scheduled Tasks for Flashcard App

This directory contains scripts for automated tasks that run on a schedule to maintain the application's functionality even when users are not actively using the app.

## Current Tasks

### Update Review Notifications

The `updateReviewNotifications.js` script checks all users' cards to determine if any are due for review, and updates the notification Boolean fields in Knack accordingly. These fields can then trigger notifications or UI indicators for users.

## Setting Up Heroku Scheduler

To run these tasks automatically, you'll need to set up the Heroku Scheduler add-on:

1. **Install the Heroku Scheduler add-on**:
   ```
   heroku addons:create scheduler:standard
   ```

2. **Open the Scheduler dashboard**:
   ```
   heroku addons:open scheduler
   ```

3. **Create a new job with the following settings**:
   - **Command**: `npm run update-notifications`
   - **Frequency**: Daily (recommended to run during off-peak hours)
   - **Time**: Choose a time when usage is low (e.g., 3:00 AM)

## Environment Variables

Make sure your Heroku application has the following environment variables set:

- `REACT_APP_KNACK_APP_ID`: Your Knack application ID
- `REACT_APP_KNACK_API_KEY`: Your Knack API key

You can set these variables using the Heroku CLI:

```
heroku config:set REACT_APP_KNACK_APP_ID=your_app_id
heroku config:set REACT_APP_KNACK_API_KEY=your_api_key
```

## Testing the Task Locally

You can test the scheduled task locally by running:

```
npm run update-notifications
```

This will execute the task once and report the results to the console. 