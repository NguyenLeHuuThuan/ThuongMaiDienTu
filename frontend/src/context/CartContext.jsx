import { createContext, useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from './AuthContext';

export const CartContext = createContext();

export const CartProvider = ({ children }) => {
  const [carts, setCarts] = useState([]);
  const { user } = useContext(AuthContext);

  const fetchCarts = async () => {
    if (!user) return;
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('http://localhost:5000/api/cart', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCarts(res.data);
    } catch (error) {
      console.error('Error fetching carts', error);
    }
  };

  useEffect(() => {
    if (user) {
      fetchCarts();
    } else {
      setCarts([]);
    }
  }, [user]);

  const addToCart = async (id_Restaurant, id_Food, quantity = 1, note = '') => {
    try {
      const token = localStorage.getItem('token');
      await axios.post('http://localhost:5000/api/cart/add', 
        { id_Restaurant, id_Food, quantity, note },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchCarts();
    } catch (error) {
      console.error('Error adding to cart', error);
      throw error;
    }
  };

  return (
    <CartContext.Provider value={{ carts, fetchCarts, addToCart }}>
      {children}
    </CartContext.Provider>
  );
};
