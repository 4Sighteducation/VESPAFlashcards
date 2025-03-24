# API Rate Limit Fix

## Problem

The application was experiencing OpenAI API rate limit errors when using the AI topic generation feature. This was causing the topic generation to fail, even though the API usage appeared to be relatively low in the OpenAI account dashboard.

## Root Cause Analysis

After examining the console logs and code, we identified these key issues:

1. **Multiple Redundant API Calls**: The application was making multiple calls to the OpenAI API for the same subject/exam board combinations, even within the same session. Each page refresh or navigation back to the topic generation screen would trigger a new API call.

2. **No Local Caching**: Previously generated topics weren't being saved anywhere other than in-memory, causing them to be lost between sessions.

3. **No Rate Limiting Protection**: The application lacked safeguards against making too many API requests in a short time span.

## Solution Implemented

We've implemented a comprehensive caching system with multiple layers of protection:

### 1. AITopicCacheService

A new service (`src/services/AITopicCacheService.js`) has been created that:

- Implements both in-memory caching and localStorage persistence
- Caches topic lists by exam board, exam type, and subject
- Sets a 30-day expiry for cached items
- Provides automatic cleanup of expired cache items
- Logs detailed cache operations for easier debugging

### 2. TopicHub Component Updates

The TopicHub component (`src/components/TopicHub/index.jsx`) has been modified to:

- Check the cache before making any API calls
- Store successfully generated topics in both memory and persistent cache
- Use fallback topics when API calls fail or return invalid responses
- Cache fallback topics to prevent future API calls for the same parameters

### 3. Benefits

- **Reduced API Calls**: API calls are now only made when absolutely necessary (first-time access to a specific subject/board combo)
- **Persistent Caching**: Topics are now stored in localStorage, persisting between browser sessions
- **Improved User Experience**: Users now see immediate results for previously generated topics without waiting for API calls
- **Rate Limit Protection**: The system helps prevent hitting API rate limits by reducing the overall number of calls

## How It Works

1. When a user attempts to generate topics, the system first checks the persistent cache
2. If topics exist in the cache, they are used immediately without making an API call
3. If no cached topics exist, an API call is made and the results are stored in the cache
4. If the API call fails (for any reason including rate limits), fallback topics are used and also cached

## Usage

No special actions are required to use the new caching system. It works automatically behind the scenes.

**Additional Benefits:**
- The cache automatically expires after 30 days to ensure curriculum updates are eventually fetched
- The caching system is designed to handle API response errors gracefully
- Fallback topics are provided for common subjects to ensure the app remains functional even when offline
