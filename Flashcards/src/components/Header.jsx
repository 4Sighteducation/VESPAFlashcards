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
          <i className="fas fa-layer-group"></i>
          Card Bank
        </button>
        <button
          className={`nav-button ${
            currentView === "createCard" ? "active" : ""
          }`}
          onClick={() => onViewChange("createCard")}
        >
          <i className="fas fa-plus-circle"></i>
          Create Card
        </button>
        <button
          className={`nav-button ${
            currentView === "spacedRepetition" ? "active" : ""
          }`}
          onClick={() => onViewChange("spacedRepetition")}
        >
          <i className="fas fa-brain"></i>
          Spaced Repetition
        </button>
        <button
          className={`nav-button ${
            currentView === "aiGenerator" ? "active" : ""
          }`}
          onClick={() => onViewChange("aiGenerator")}
        >
          <i className="fas fa-robot"></i>
          AI Generator
        </button>
      </div>

      <div className="header-actions">
        <button className="save-button" onClick={onSave} disabled={isSaving}>
          {isSaving ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-save"></i>}
          {isSaving ? "Saving..." : "Save Cards"}
        </button>

        {userInfo.email && (
          <div className="user-info">
            <i className="fas fa-user-circle"></i>
            <span className="user-email">{userInfo.email}</span>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
