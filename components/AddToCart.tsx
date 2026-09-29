'use client';
import { useCart } from './Cart';

export default function AddToCart({ name }: { name: string }) {
  const { add } = useCart();
  return (
    <button className="btn btn-ink" onClick={() => add(name)}>Añadir a la cesta</button>
  );
}
