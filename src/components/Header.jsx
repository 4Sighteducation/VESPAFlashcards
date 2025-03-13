import React, { useState } from "react";
import "./Header.css";

const Header = ({ userInfo, currentView, onViewChange, onSave, isSaving, onPrintAll, onCreateCard }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  return (
    <header className="app-header">
      <div className="header-logo">
        <img
          src="https://www.vespa.academy/assets/images/full-trimmed-transparent-customcolor-1-832x947.png"
          alt="Vespa Academy Logo"
          className="logo"
        />
        <h1>Flashcard App</h1>
        <button 
          className="mobile-menu-toggle" 
          onClick={toggleMobileMenu}
          style={{ display: window.innerWidth <= 768 ? 'block' : 'none' }}
          aria-label="Toggle menu"
        >
          ☰
        </button>
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
          <span className="button-icon">✏️</span> Create Card
        </button>
        
        <button
          className="nav-button spaced-rep-btn"
          onClick={() => onViewChange("spacedRepetition")}
        >
          <span className="button-icon">🧠</span> Spaced Repetition
        </button>
        
        <button
          className="nav-button print-btn"
          onClick={onPrintAll}
        >
          <span className="button-icon">🖨️</span> Print All
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
      </div>
    </header>
  );
};

export default Header;
