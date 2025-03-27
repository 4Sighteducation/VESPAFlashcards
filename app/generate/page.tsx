import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

export default function GeneratePage() {
  const [isAdding, setIsAdding] = useState(false);
  const router = useRouter();

  const handleAddCardsToBank = async () => {
    if (!generatedCards || generatedCards.length === 0) {
      toast.error('No cards to add.');
      return;
    }
    setIsAdding(true);
    try {
      const response = await fetch('/api/cards/add-multiple', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ cards: generatedCards }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to add cards');
      }

      const result = await response.json();
      console.log('Cards added successfully:', result);
      setGeneratedCards([]);
      toast.success('Cards successfully added to your bank!');
      router.push('/bank');
    } catch (error: any) {
      console.error('Error adding cards:', error);
      toast.error(`Error adding cards: ${error.message}`);
    } finally {
      setIsAdding(false);
    }
  };

  const handleGenerateCards = async () => {
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topic,
          numCards: parseInt(numCards, 10),
          difficulty,
          examBoard,
          examType,
        }),
      });
    } catch (error: any) {
    } finally {
    }
  };

  return (
    <div className="container mx-auto p-4">
      <Button
        onClick={handleAddCardsToBank}
        disabled={!generatedCards || generatedCards.length === 0 || isAdding}
        className="bg-green-500 hover:bg-green-600 text-white"
      >
        {isAdding ? <LoadingSpinner /> : 'Add to Bank'}
      </Button>
    </div>
  );
} 