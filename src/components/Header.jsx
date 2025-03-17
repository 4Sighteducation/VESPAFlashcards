import React from "react";
import "./Header.css";

const Header = ({ userInfo, currentView, onViewChange, onSave, isSaving }) => {
  return (
    <header className="app-header">
      <div className="header-logo">
        <img
          src="https://www.vespa.academy/assets/images/full-trimmed-transparent-customcolor-1-832x947.png"
          alt="Vespa Academy Logo"
          className="logo"
        />
        <h1>Flashcard App</h1>
      </div>

      <div className="header-nav">
        <button
          className={`nav-button ${currentView === "cardBank" ? "active" : ""}`}
          onClick={() => onViewChange("cardBank")}
        >
          Card Bank
        </button>
        <button
          className={`nav-button ${
            currentView === "createCard" ? "active" : ""
          }`}
          onClick={() => onViewChange("createCard")}
        >
          Create Card
        </button>
        <button
          className={`nav-button ${
            currentView === "spacedRepetition" ? "active" : ""
          }`}
          onClick={() => onViewChange("spacedRepetition")}
        >
          Spaced Repetition
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
