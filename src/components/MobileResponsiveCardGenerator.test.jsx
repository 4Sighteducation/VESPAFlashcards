import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import MobileResponsiveCardGenerator from './MobileResponsiveCardGenerator';

// Mock the fetch function
global.fetch = jest.fn();

describe('MobileResponsiveCardGenerator', () => {
  const mockProps = {
    topic: 'Cell Biology',
    subject: 'Biology',
    examBoard: 'AQA',
    examType: 'GCSE',
    onClose: jest.fn(),
    onSaveFlashcards: jest.fn(),
    auth: { currentUser: { uid: 'test-user-id' } },
    userId: 'test-user-id'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock successful API response
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify([
              { front: 'What is a cell?', back: 'The basic unit of life.' },
              { front: 'What is mitosis?', back: 'Cell division process.' }
            ])
          }
        }]
      })
    });
  });

  test('renders with correct topic title', () => {
    render(<MobileResponsiveCardGenerator {...mockProps} />);
    expect(screen.getByText(/Cell Biology/i)).toBeInTheDocument();
  });

  test('displays loading state when generating cards', async () => {
    render(<MobileResponsiveCardGenerator {...mockProps} />);
    
    // Click generate button
    const generateButton = screen.getByText(/Generate Flashcards/i);
    fireEvent.click(generateButton);
    
    // Should show loading spinner
    expect(screen.getByText(/Generating flashcards/i)).toBeInTheDocument();
    
    // Wait for the API call to complete
    await waitFor(() => {
      expect(screen.queryByText(/Generating flashcards/i)).not.toBeInTheDocument();
    });
  });

  test('closes when the close button is clicked', () => {
    render(<MobileResponsiveCardGenerator {...mockProps} />);
    
    const closeButton = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeButton);
    
    expect(mockProps.onClose).toHaveBeenCalledTimes(1);
  });

  test('saves flashcards when save button is clicked', async () => {
    render(<MobileResponsiveCardGenerator {...mockProps} />);
    
    // Generate the cards first
    const generateButton = screen.getByText(/Generate Flashcards/i);
    fireEvent.click(generateButton);
    
    // Wait for cards to be generated
    await waitFor(() => {
      expect(screen.queryByText(/What is a cell?/i)).toBeInTheDocument();
    });
    
    // Click save button
    const saveButton = screen.getByText(/Save Flashcards/i);
    fireEvent.click(saveButton);
    
    // Check if onSaveFlashcards was called with the generated cards
    expect(mockProps.onSaveFlashcards).toHaveBeenCalledTimes(1);
    expect(mockProps.onSaveFlashcards).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ front: 'What is a cell?', back: 'The basic unit of life.' }),
        expect.objectContaining({ front: 'What is mitosis?', back: 'Cell division process.' })
      ])
    );
  });
}); 