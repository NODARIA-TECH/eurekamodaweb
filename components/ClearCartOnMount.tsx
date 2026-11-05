'use client';
import { useEffect } from 'react';
import { useCart } from './Cart';

// Vacía la cesta al montar (se usa en la página de "gracias" tras un pago confirmado).
export default function ClearCartOnMount() {
  const { clear } = useCart();
  useEffect(() => { clear(); }, [clear]);
  return null;
}
