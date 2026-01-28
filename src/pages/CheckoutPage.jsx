import { useEffect } from 'react';
import { useCart } from '../context/CartContext';
import LoadingSpinner from '../components/LoadingSpinner';

const CheckoutPage = () => {
  const { state, dispatch } = useCart();
  const { items, loading, error } = state;

  useEffect(() => {
    dispatch({ type: 'SET_LOADING', payload: true });
    // Simulate data fetching
    setTimeout(() => {
      dispatch({ type: 'SET_LOADING', payload: false });
    }, 1000);
  }, [dispatch]);

  const handleAddItem = (item) => {
    dispatch({ type: 'ADD_ITEM', payload: item });
  };

  const handleRemoveItem = (itemId) => {
    dispatch({ type: 'REMOVE_ITEM', payload: itemId });
  };

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <LoadingSpinner label="Loading checkout..." />
      </div>
    );
  }
  if (error) return <div>Error: {error}</div>;
  if (items.length === 0) return <div>Your cart is empty.</div>;

  return (
    <div>
      <h1>Checkout</h1>
      <ul>
        {items.map(item => (
          <li key={item.id}>
            {item.name} - ${item.price}
            <button onClick={() => handleRemoveItem(item.id)}>Remove</button>
          </li>
        ))}
      </ul>
      <button onClick={() => handleAddItem({ id: 1, name: 'Sample Item', price: 10 })}>
        Add Sample Item
      </button>
    </div>
  );
};

export default CheckoutPage;

