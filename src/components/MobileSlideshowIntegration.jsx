/**
 * MobileSlideshowIntegration.jsx
 * 
 * This file provides a guide for how to integrate the MobileSlideshow component
 * into the existing FlashcardList component.
 * 
 * INTEGRATION INSTRUCTIONS:
 * 
 * 1. Import the MobileSlideshow component at the top of FlashcardList.jsx:
 *    import MobileSlideshow from "./MobileSlideshow";
 * 
 * 2. Add these new state variables to the FlashcardList component:
 *    const [showMobileSlideshow, setShowMobileSlideshow] = useState(false);
 *    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
 * 
 * 3. Add a useEffect to detect mobile devices:
 *    useEffect(() => {
 *      const handleResize = () => {
 *        setIsMobile(window.innerWidth <= 768);
 *      };
 *      
 *      window.addEventListener('resize', handleResize);
 *      return () => window.removeEventListener('resize', handleResize);
 *    }, []);
 * 
 * 4. Modify the handleSetShowModalAndSelectedCard function to use the appropriate slideshow:
 *    const handleSetShowModalAndSelectedCard = (card) => {
 *      setSelectedCard(card);
 *      
 *      if (window.innerWidth <= 768) {
 *        // Use mobile slideshow on mobile devices
 *        setShowMobileSlideshow(true);
 *      } else {
 *        // Use traditional modal on desktop
 *        setShowModalAndSelectedCard(true);
 *      }
 *    };
 * 
 * 5. Add these helper functions to get cards for the slideshow:
 *    // Helper function to get all cards for the modal based on the selected card
 *    function getAllCardsForModal() {
 *      if (!selectedCard) return [];
 *      
 *      const currentSubject = selectedCard.metadata?.subject || selectedCard.subject || "Unknown Subject";
 *      
 *      if (currentSubject && groupedCards[currentSubject]) {
 *        // Subject-level slideshow
 *        if (Object.keys(groupedCards[currentSubject]).length > 0) {
 *          // Get all cards from all topics in this subject
 *          const allCards = Object.keys(groupedCards[currentSubject]).flatMap(
 *            topic => groupedCards[currentSubject][topic]
 *          );
 *          
 *          // If we have cards and the selected card isn't in the array, add it
 *          if (allCards.length > 0 && !allCards.some(c => c.id === selectedCard.id)) {
 *            allCards.push(selectedCard);
 *          }
 *          
 *          return allCards;
 *        }
 *      }
 *      
 *      // Fallback to just the selected card
 *      return [selectedCard];
 *    }
 *    
 *    // Helper function to get the current card index in the modal cards array
 *    function getCurrentCardIndex() {
 *      const allCards = getAllCardsForModal();
 *      return allCards.findIndex(c => c.id === selectedCard.id);
 *    }
 * 
 * 6. Add the MobileSlideshow component to the render method:
 *    {showMobileSlideshow && selectedCard && (
 *      <MobileSlideshow
 *        cards={getAllCardsForModal()}
 *        initialCardIndex={getCurrentCardIndex()}
 *        onClose={() => setShowMobileSlideshow(false)}
 *        onDeleteCard={onDeleteCard}
 *        onUpdateCard={onUpdateCard}
 *      />
 *    )}
 * 
 * 7. Conditionally render the traditional CardModal only on desktop:
 *    {showModalAndSelectedCard && !isMobile && selectedCard && <CardModal />}
 * 
 * These changes will ensure that your FlashcardList component uses the mobile-responsive
 * slideshow on mobile devices while still using the traditional modal on desktop.
 */

// This is a placeholder component - don't actually import this file
export default function MobileSlideshowIntegration() {
  return (
    <div>
      <h1>Mobile Slideshow Integration Guide</h1>
      <p>Please see the comments above for integration instructions.</p>
    </div>
  );
} 