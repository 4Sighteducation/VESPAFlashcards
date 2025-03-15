import React, { useState, useEffect } from "react";
import "./Header.css";

const Header = ({ userInfo, currentView, onViewChange, onSave, isSaving, onPrintAll, onCreateCard }) => {
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

  return (
    <header className="header">
      <div className="app-title">
        <img
          src="https://www.vespa.academy/assets/images/full-trimmed-transparent-customcolor-1-832x947.png"
          alt="Vespa Academy Logo"
          className="logo"
        />
        <h1>VESPA Flashcards</h1>
      </div>

      <div className={`header-nav ${mobileMenuOpen ? 'open' : ''}`}>
        <button
          className={`nav-button ${currentView === "cardBank" ? "active" : ""}`}
          onClick={() => handleNavClick(() => onViewChange("cardBank"))}
        >
          Card Bank
        </button>
        
        <button
          className="nav-button create-card-btn"
          onClick={() => handleNavClick(onCreateCard)}
        >
          Create Card
        </button>
        
        <button
          className="nav-button spaced-rep-btn"
          onClick={() => handleNavClick(() => onViewChange("spacedRepetition"))}
        >
          Spaced Repetition
        </button>
        
        <button
          className="print-button"
          onClick={() => handleNavClick(onPrintAll)}
        >
          Print All
        </button>
        
        <button
          className="logout-button"
          onClick={() => handleNavClick(handleLogout)}
        >
          Logout
        </button>
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
