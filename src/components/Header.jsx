import React, { useState, useEffect } from "react";
import "./Header.css";
import { dlog, dwarn, derr } from '../utils/logger'; 

const Header = ({ 
  userInfo, 
  currentView, 
  onViewChange, 
  onSave, 
  isSaving, 
  onPrintAll, 
  onCreateCard,
  // New props for spaced repetition
  currentBox = 1,
  onSelectBox = () => {},
  spacedRepetitionData = {},
  cardCounts = { subjects: 0, topics: 0, flashcards: 0 },
  onOpenVideoModal = () => {},
  onOpenCreateTopicModal = () => {}
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  // Close mobile menu when clicking elsewhere on the page
  useEffect(() => {
    const handleDocumentClick = (e) => {
      // If clicking outside of the header, close the mobile menu
      if (mobileMenuOpen && !e.target.closest('.header')) {
        setMobileMenuOpen(false);
      }
    };

    document.addEventListener('click', handleDocumentClick);
    return () => {
      document.removeEventListener('click', handleDocumentClick);
    };
  }, [mobileMenuOpen]);

  const handleNavClick = (action) => {
    // Close mobile menu when any navigation option is clicked
    setMobileMenuOpen(false);
    // Perform the action
    action();
  };

  const handleLogout = () => {
    // Redirect to Knack login page
    window.location.href = "https://vespaacademy.knack.com/vespa-academy#flashcards/";
  };

  // Determine what view toggle to show based on current view
  const isInCardBank = currentView === "cardBank";
  const isInSpacedRep = currentView === "spacedRepetition";
  const alternateViewName = isInCardBank ? "Study" : "Card Bank";
  const alternateViewIcon = isInCardBank ? "🔄" : "📚";
  const alternateViewAction = isInCardBank 
    ? () => onViewChange("spacedRepetition") 
    : () => onViewChange("cardBank");

  // Card Bank Actions part - This will be refactored.
  // const cardBankCoreActions = (
  //   <>
  //     <button
  //       className={`nav-button toggle-view-btn`} // This is the "Study" button for Card Bank
  //       onClick={() => handleNavClick(alternateViewAction)}
  //     >
  //       <span className="button-icon">{alternateViewIcon}</span>
  //       {alternateViewName}
  //     </button>
  //     <button
  //       className="nav-button print-button"
  //       onClick={() => handleNavClick(onPrintAll)}
  //     >
  //       <span className="button-icon">🖨️</span>
  //       Print
  //     </button>
  //   </>
  // );

  // Render the box selectors for spaced repetition
  const renderBoxSelectors = () => {
    return (
      <div className="header-box-selectors-container">
        <div className="box-selectors-label">Study Boxes</div>
        <div className="header-box-selectors">
          {[1, 2, 3, 4, 5].map((box) => (
            <button
              key={box}
              className={`box-selector ${currentBox === box ? "active" : ""} ${
                (spacedRepetitionData[`box${box}`]?.some(card => 
                  !card.nextReviewDate || new Date(card.nextReviewDate) <= new Date()
                )) ? "has-reviewable" : ""
              }`}
              onClick={() => handleNavClick(() => onSelectBox(box))}
            >
              {box}
              <span className="box-count">
                {spacedRepetitionData[`box${box}`]?.length || 0}
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <header className="header">
      <div className="app-title">
        {/* LOGO REMOVED 
        <img
          src="https://www.vespa.academy/assets/images/full-trimmed-transparent-customcolor-1-832x947.png"
          alt="Vespa Academy Logo"
          className="logo"
        />
        */}
        <div className="app-info">
          <h1>VESPA Flashcards</h1>
          <div className="card-stats">
            <span className="stat-item">Subjects: {cardCounts.subjects}</span>
            <span className="stat-item">Topics: {cardCounts.topics}</span>
            <span className="stat-item">Flashcards: {cardCounts.flashcards}</span>
          </div>
        </div>
      </div>

      {/* Hamburger toggle - MOVED UP to be a direct child for top-line layout */}
      <div className="header-mobile-menu-toggle-container">
        <button 
          className="mobile-menu-toggle" 
          onClick={toggleMobileMenu}
          aria-label="Toggle menu"
          aria-expanded={mobileMenuOpen}
        >
          {mobileMenuOpen ? '✕' : '☰'} 
        </button>
      </div>

      {/* Container for always-visible mobile buttons - This will now be on a new line below title/hamburger */}
      <div className="header-mobile-persistent-actions">
        {isInCardBank && (
          <button
            className="nav-button create-topics-header-button mobile-persistent-button"
            onClick={() => handleNavClick(onOpenCreateTopicModal)}
            title="Create New Topics"
          >
            <span className="button-icon">⚡</span> Create Topics
          </button>
        )}
        <button
          className={`nav-button toggle-view-btn mobile-persistent-button`}
          onClick={() => handleNavClick(alternateViewAction)}
        >
          <span className="button-icon">{alternateViewIcon}</span> {alternateViewName}
        </button>
      </div>

      {/* Navigation items - for desktop and inside mobile dropdown */}
      <div className={`header-nav ${mobileMenuOpen ? 'open' : ''}`}>
        {/* "Create Topics" Button - for desktop and inside open mobile menu */}
        {isInCardBank && (
          <button
            className="nav-button create-topics-header-button desktop-menu-button"
            onClick={() => handleNavClick(onOpenCreateTopicModal)}
            title="Create New Topics"
          >
            <span className="button-icon">⚡</span> Create Topics
          </button>
        )}

        {/* View Toggle Button - for desktop and inside open mobile menu */}
        <button
          className={`nav-button toggle-view-btn desktop-menu-button`}
          onClick={() => handleNavClick(alternateViewAction)}
        >
          <span className="button-icon">{alternateViewIcon}</span> {alternateViewName}
        </button>

        {/* Video Tutorial Button */}
        <button
          className="nav-button video-tutorial-button"
          onClick={() => handleNavClick(onOpenVideoModal)}
          title="Watch Tutorial"
        >
          <span className="button-icon">📹</span>
          Tutorial
        </button>

        {/* Print button - only for Card Bank */}
        {isInCardBank && (
          <button
            className="nav-button print-button"
            onClick={() => handleNavClick(onPrintAll)}
          >
            <span className="button-icon">🖨️</span>
            Print
          </button>
        )}
        
        {/* New Save All button, based on nav-button styling */}
        {onSave && (
          <button 
            className="nav-button"
            onClick={() => handleNavClick(onSave)} 
            disabled={isSaving}
            title="Save All Changes"
          >
            {isSaving ? (
              <>
                <span className="button-icon">⏳</span> Saving...
              </>
            ) : (
              <>
                <span className="button-icon">💾</span> Save All
              </>
            )}
          </button>
        )}

        {/* Spaced Repetition Box Selectors - also moved into nav for mobile */}
        {isInSpacedRep && renderBoxSelectors()}
      </div>
      
      {/* Wrapper for always-visible actions - THIS WILL BE HIDDEN ON MOBILE and its contents moved to header-nav */}
      {/* 
      <div className="header-visible-actions">
       // ... content previously here is now in header-nav ...
      </div>
      */}
    </header>
  );
};

export default Header;
