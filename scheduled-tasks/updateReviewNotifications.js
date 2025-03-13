const fetch = require('node-fetch');

// Constants
const KNACK_APP_ID = process.env.REACT_APP_KNACK_APP_ID || "64fc50bc3cd0ac00254bb62b";
const KNACK_API_KEY = process.env.REACT_APP_KNACK_API_KEY || "knack-api-key";
const KNACK_OBJECT = 'object_102';

/**
 * Fetches all user records from Knack
 */
async function fetchAllUsers() {
  try {
    const response = await fetch(`https://api.knack.com/v1/objects/${KNACK_OBJECT}/records`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Knack-Application-ID': KNACK_APP_ID,
        'X-Knack-REST-API-Key': KNACK_API_KEY
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch users: ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`Found ${data.records.length} users`);
    return data.records;
  } catch (error) {
    console.error('Error fetching users:', error);
    return [];
  }
}

/**
 * Check if a card is due for review based on its next review date
 */
function isCardDueForReview(item) {
  // For string IDs (old format), assume they're ready
  if (typeof item === 'string') return true;
  
  // For object format with nextReviewDate
  if (item && item.nextReviewDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to midnight for consistent day comparison
    
    const nextReviewDate = new Date(item.nextReviewDate);
    return nextReviewDate <= today;
  }
  
  return false;
}

/**
 * Check a user's boxes and update notification fields if needed
 */
async function updateUserNotifications(user) {
  try {
    const userId = user.id;
    console.log(`Processing user: ${userId}`);

    // Create box status object
    const boxStatus = {};
    let needsUpdate = false;

    // Check each box (1-5) for cards due for review
    for (let i = 1; i <= 5; i++) {
      const boxFieldKey = `field_298${i+5}`; // Maps to box1Data through box5Data
      const notificationFieldKey = `field_299${i}`; // Maps to notification fields
      
      // Get box data
      let boxData = [];
      try {
        if (user[boxFieldKey]) {
          boxData = JSON.parse(user[boxFieldKey]);
        }
      } catch (error) {
        console.warn(`Could not parse box data for user ${userId}, box ${i}`);
        boxData = [];
      }
      
      // Check if any card is due for review
      const hasDueCards = Array.isArray(boxData) && boxData.some(isCardDueForReview);
      boxStatus[notificationFieldKey] = hasDueCards;
      
      // Check if we need to update this field
      if (user[notificationFieldKey] !== hasDueCards) {
        needsUpdate = true;
      }
      
      console.log(`Box ${i} has due cards: ${hasDueCards}`);
    }

    // Only update if changes are needed
    if (needsUpdate) {
      console.log(`Updating notification fields for user ${userId}`);
      const updateUrl = `https://api.knack.com/v1/objects/${KNACK_OBJECT}/records/${userId}`;
      
      const response = await fetch(updateUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Knack-Application-ID': KNACK_APP_ID,
          'X-Knack-REST-API-Key': KNACK_API_KEY
        },
        body: JSON.stringify(boxStatus)
      });
      
      if (!response.ok) {
        throw new Error(`Failed to update user ${userId}: ${response.statusText}`);
      }
      
      console.log(`Successfully updated user ${userId}`);
      return true;
    } else {
      console.log(`No updates needed for user ${userId}`);
      return false;
    }
  } catch (error) {
    console.error(`Error updating user ${user.id}:`, error);
    return false;
  }
}

/**
 * Main function to process all users
 */
async function main() {
  console.log('Starting scheduled job to update review notifications');
  
  try {
    // Fetch all users
    const users = await fetchAllUsers();
    if (users.length === 0) {
      console.log('No users found');
      return;
    }
    
    // Process each user
    let updatedCount = 0;
    for (const user of users) {
      const updated = await updateUserNotifications(user);
      if (updated) updatedCount++;
      
      // Add a small delay between users to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log(`Completed processing. Updated ${updatedCount} out of ${users.length} users.`);
  } catch (error) {
    console.error('Error in main process:', error);
  }
}

// Execute the main function
main().then(() => {
  console.log('Job completed');
  // Exit process when done
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
}); 