import React, { useState, useEffect } from "react";
import "./Header.css";

const Header = ({ userInfo, currentView, onViewChange, onSave, isSaving, onPrintAll, onCreateCard }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
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
          onClick={() => onViewChange("cardBank")}
        >
          Card Bank
        </button>
        
        <button
          className="nav-button create-card-btn"
          onClick={onCreateCard}
        >
          Create Card
        </button>
        
        <button
          className="nav-button spaced-rep-btn"
          onClick={() => onViewChange("spacedRepetition")}
        >
          Spaced Repetition
        </button>
        
        <button
          className="print-button"
          onClick={onPrintAll}
        >
          Print All
        </button>
      </div>

      <div className="header-actions">
        <button className="save-button" onClick={onSave} disabled={isSaving}>
          {isSaving ? "Saving..." : "Save Cards"}
        </button>

        {userInfo.email && (
          <div className="user-info">
            <span className="user-email">{userInfo.email}</span>
          </div>
        )}
        
        {window.innerWidth <= 768 && (
          <button 
            className="mobile-menu-toggle" 
            onClick={toggleMobileMenu}
            aria-label="Toggle menu"
          >
            ☰
          </button>
        )}
      </div>
    </header>
  );
};

export default Header;
