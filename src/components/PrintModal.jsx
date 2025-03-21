import React from 'react';
import { printDoubleSidedCards, printCardFronts, printCardBacks } from '../utils/PrintUtils';
import './PrintModal.css';

const PrintModal = ({ cards, title, onClose }) => {
  const handlePrintDoubleSided = () => {
    printDoubleSidedCards(cards, title);
    onClose();
  };

  const handlePrintFronts = () => {
    printCardFronts(cards, title);
    onClose();
  };

  const handlePrintBacks = () => {
    printCardBacks(cards, title);
    onClose();
  };

  // Determine if we're printing all cards or just a topic
  const isAllCards = !title || title === "All Cards" || title.toLowerCase().includes("all");
  const printInfoText = isAllCards 
    ? "This will Print your cards from ALL Subjects" 
    : "This will Print your cards from this topic";

  return (
    <div className="print-modal-overlay" onClick={onClose}>
      <div className="print-modal" onClick={(e) => e.stopPropagation()}>
        <div className="print-modal-header">
          <button className="close-modal-btn" onClick={onClose}>✕</button>
          <h3 className="print-scope-info">{printInfoText}</h3>
        </div>
        <div className="print-modal-content">
          <p>Select print format for {cards.length} cards:</p>
          
          <div className="print-options">
            <div className="print-option" onClick={handlePrintDoubleSided}>
              <div className="print-option-icon">📄</div>
              <div className="print-option-label">Print Full Cards</div>
              <div className="print-option-desc">Prints both fronts and backs</div>
            </div>
            
            <div className="print-option" onClick={handlePrintFronts}>
              <div className="print-option-icon">🔍</div>
              <div className="print-option-label">Print Card Fronts</div>
              <div className="print-option-desc">Only prints the questions</div>
            </div>
            
            <div className="print-option" onClick={handlePrintBacks}>
              <div className="print-option-icon">💡</div>
              <div className="print-option-label">Print Card Backs</div>
              <div className="print-option-desc">Only prints the answers</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrintModal; 