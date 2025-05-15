// Wait for a Knack scene to render before trying to modify elements
$(document).on('knack-scene-render.any', function(event, scene) {
  console.log('Knack scene rendered. Attempting to modify header and info bar...');

  // Target the main Knack application header
  var knackAppHeader = document.getElementById('kn-app-header');
  if (knackAppHeader) {
    console.log('Found kn-app-header');
    // Reduce overall padding to make it smaller
    knackAppHeader.style.padding = '5px 10px'; // Adjust as needed

    // Target the logo container within the header
    var knackLogoContainer = document.getElementById('knack-logo');
    if (knackLogoContainer) {
      console.log('Found knack-logo');
      knackLogoContainer.style.margin = '0'; // Remove extra margins

      // Target the image itself
      var knackLogoImg = knackLogoContainer.querySelector('img');
      if (knackLogoImg) {
        console.log('Found logo img');
        // Reduce logo size - 70% of original would be height/width * 0.3
        // However, directly setting height and letting width auto-adjust is often better.
        // Let's aim for a visually smaller logo, e.g., 30-40px height.
        // Knack's default seems to be larger.
        // Example: If original was 50px, 70% reduction means 15px.
        // A 70% *reduction* in size means it becomes 30% of its original size.
        knackLogoImg.style.maxHeight = '25px'; // Adjust this value as needed
        knackLogoImg.style.width = 'auto';
      }
    }
    // Reduce font size for the title if it's part of knack-logo h1
    if (knackLogoContainer && knackLogoContainer.tagName === 'H1') {
        // Assuming the text "VESPA ACADEMY" is within this h1 or its children.
        // This is a general approach; specific child elements might need targeting.
        knackLogoContainer.style.fontSize = '0.7em'; // Reduce font size by 30%
    }

  } else {
    console.log('kn-app-header not found.');
  }

  // Target the Knack info bar (user login info, account settings, etc.)
  // There might be multiple elements with this class, hide all found.
  var knInfoBars = document.querySelectorAll('.kn-info-bar');
  if (knInfoBars.length > 0) {
    console.log('Found ' + knInfoBars.length + ' kn-info-bar elements. Hiding them.');
    knInfoBars.forEach(function(bar) {
      bar.style.display = 'none';
    });
  } else {
    console.log('kn-info-bar not found.');
  }

  // Target the Google Translate element if you want to hide it as well
  var googleTranslateElement = document.getElementById('google_translate_element');
  if (googleTranslateElement) {
    console.log('Found google_translate_element. Hiding it.');
    googleTranslateElement.style.display = 'none';
  }

});

// Fallback if jQuery/Knack events aren't firing as expected,
// though knack-scene-render is usually reliable.
// document.addEventListener('DOMContentLoaded', function() {
//   // You could put a less reliable version of the code here,
//   // but it's better to rely on Knack's events.
// }); 