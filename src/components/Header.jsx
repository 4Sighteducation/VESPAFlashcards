import React, { useState, useEffect } from "react";
import "./Header.css";

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
  cardCounts = { subjects: 0, topics: 0, flashcards: 0 }
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
  const alternateViewName = isInCardBank ? "Study" : "Cards";
  const alternateViewIcon = isInCardBank ? "🔄" : "📚";
  const alternateViewAction = isInCardBank 
    ? () => onViewChange("spacedRepetition") 
    : () => onViewChange("cardBank");

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
        <img
          src="https://www.vespa.academy/assets/images/full-trimmed-transparent-customcolor-1-832x947.png"
          alt="Vespa Academy Logo"
          className="logo"
        />
        <div className="app-info">
          <h1>VESPA Flashcards</h1>
          <div className="card-stats">
            <span className="stat-item">Subjects: {cardCounts.subjects}</span>
            <span className="stat-item">Topics: {cardCounts.topics}</span>
            <span className="stat-item">Flashcards: {cardCounts.flashcards}</span>
          </div>
        </div>
      </div>

      <div className={`header-nav ${mobileMenuOpen ? 'open' : ''}`}>
        {/* Toggle button for switching between Card Bank and Spaced Repetition */}
        <button
          className={`nav-button toggle-view-btn`}
          onClick={() => handleNavClick(alternateViewAction)}
        >
          <span className="button-icon">{alternateViewIcon}</span>
          {alternateViewName}
        </button>
        
        {/* Only show Create Card, Print, and Logout buttons in Card Bank view */}
        {isInCardBank && (
          <>
            <button
              className="nav-button create-card-btn"
              onClick={() => handleNavClick(onCreateCard)}
            >
              <span className="button-icon">➕</span>
              Create
            </button>
            
            <button
              className="nav-button print-button"
              onClick={() => handleNavClick(onPrintAll)}
            >
              <span className="button-icon">🖨️</span>
              Print
            </button>
            
            <button
              className="nav-button logout-button"
              onClick={() => handleNavClick(handleLogout)}
            >
              <span className="button-icon">↪️</span>
              Logout
            </button>
          </>
        )}
        
        {/* Only show box selectors in Spaced Repetition view */}
        {isInSpacedRep && renderBoxSelectors()}
      </div>

      <div className="header-actions">
        <button 
          className="mobile-menu-toggle" 
          onClick={toggleMobileMenu}
          aria-label="Toggle menu"
        >
          ☰
        </button>
      </div>
    </header>
  );
};

export default Header;
