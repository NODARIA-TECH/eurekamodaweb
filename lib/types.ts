// Tipos de dominio (compartidos por servidor y cliente). Precios en CÉNTIMOS (enteros).

export type Category = { slug: string; name: string; image: string };

export type Product = {
  id: string;
  slug: string;
  name: string;
  price: number;      // céntimos
  image: string;      // id de foto (placeholder Pexels) -> catálogo real
  stock: number;
  category: string;   // slug de categoría
  badge?: string;
};

export type BalanceMovement = { id: string; amount: number; reason: string; createdAt: string };

export type Customer = {
  id: string;
  name: string;
  email: string;
  balance: number;    // céntimos. + = saldo a favor, - = debe
  movements: BalanceMovement[];
  createdAt: string;
  passwordHash?: string;  // "scrypt$<salt>$<hash>" — ausente = cuenta invitado (creada por un pedido)
};

export type OrderItem = { productId: string; name: string; price: number; qty: number; size?: string };

export type Order = {
  id: string;
  ref: string;
  customerId?: string;
  customerName?: string;
  items: OrderItem[];
  total: number;      // céntimos
  status: 'pendiente' | 'pagado' | 'enviado' | 'entregado' | 'cancelado';
  createdAt: string;
};

// Item de cesta en el cliente
export type CartItem = { id: string; name: string; price: number; image: string; qty: number; size?: string };

export type DB = {
  categories: Category[];
  products: Product[];
  customers: Customer[];
  orders: Order[];
  lastOrderNumber: number;
};
