import { createContext, useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from './AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';

export const CartContext = createContext();

export const CartProvider = ({ children }) => {
  const [carts, setCarts] = useState([]);
  const [toast, setToast] = useState({ show: false, message: '' });
  const { user } = useContext(AuthContext);

  const fetchCarts = async () => {
    if (!user) return;
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/cart`, {
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
      await axios.post(`${import.meta.env.VITE_API_URL}/cart/add`,
        { id_Restaurant, id_Food, quantity, note },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchCarts();
      
      // Hiển thị thông báo
      setToast({ show: true, message: 'Đã thêm món ăn vào giỏ hàng thành công!' });
      setTimeout(() => {
        setToast({ show: false, message: '' });
      }, 3000);

      return true;
    } catch (error) {
      console.error('Error adding to cart', error);
      throw error;
    }
  };

  return (
    <CartContext.Provider value={{ carts, fetchCarts, addToCart }}>
      {children}
      <AnimatePresence>
        {toast.show && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-white/95 backdrop-blur-md px-6 py-4 rounded-2xl border border-emerald-100 shadow-2xl max-w-sm w-[90%] sm:w-auto"
          >
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div className="flex-grow">
              <p className="text-sm font-bold text-slate-800">Thành công</p>
              <p className="text-xs text-slate-500 mt-0.5">{toast.message}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </CartContext.Provider>
  );
};

