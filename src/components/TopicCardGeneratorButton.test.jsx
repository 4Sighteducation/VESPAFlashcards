import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import TopicCardGeneratorButton from './TopicCardGeneratorButton';

// Mock the MobileResponsiveCardGenerator component
jest.mock('./MobileResponsiveCardGenerator', () => {
  return function MockMobileResponsiveCardGenerator({ onClose }) {
    return (
      <div data-testid="mock-card-generator">
        <button onClick={onClose}>Close</button>
      </div>
    );
  };
});

describe('TopicCardGeneratorButton', () => {
  const mockProps = {
    topic: 'Test Topic',
    subject: 'Biology',
    examBoard: 'AQA',
    examType: 'GCSE',
    onAddCard: jest.fn(),
    onSaveCards: jest.fn(),
    subjectColor: '#ffffff',
    auth: { currentUser: { uid: 'test-user-id' } },
    userId: 'test-user-id'
  };

  test('renders the generate button', () => {
    render(<TopicCardGeneratorButton {...mockProps} />);
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent('⚡');
  });

  test('opens the card generator when button is clicked', () => {
    render(<TopicCardGeneratorButton {...mockProps} />);
    const button = screen.getByRole('button');
    
    // Initially the card generator should not be visible
    expect(screen.queryByTestId('mock-card-generator')).not.toBeInTheDocument();
    
    // Click the button
    fireEvent.click(button);
    
    // Now the card generator should be visible
    expect(screen.getByTestId('mock-card-generator')).toBeInTheDocument();
  });

  test('closes the card generator when onClose is called', () => {
    render(<TopicCardGeneratorButton {...mockProps} />);
    const button = screen.getByRole('button');
    
    // Open the card generator
    fireEvent.click(button);
    expect(screen.getByTestId('mock-card-generator')).toBeInTheDocument();
    
    // Click the close button
    const closeButton = screen.getByText('Close');
    fireEvent.click(closeButton);
    
    // The card generator should be closed
    expect(screen.queryByTestId('mock-card-generator')).not.toBeInTheDocument();
  });
}); 