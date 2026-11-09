// Tipos de dominio (compartidos por servidor y cliente). Precios en CÉNTIMOS (enteros).

export type Category = { slug: string; name: string; image: string };

export type Product = {
  id: string;
  hidden?: boolean;   // oculto a mano en la tienda (botón Ocultar del panel)
  aliases?: string[]; // otros nombres con los que aparece en el Excel de la clienta (para no duplicar)
  slug: string;
  name: string;
  price: number;      // céntimos
  image: string;      // id de foto (placeholder Pexels) -> catálogo real
  stock: number;
  category: string;   // slug de categoría
  badge?: string;
  sku?: string;       // referencia FacturaScripts (llave de sincronización)
  updatedAt?: string; // última modificación del catálogo (web)
  sizes?: string[];   // tallas disponibles (vacío = talla única)
  colors?: string[];  // colores disponibles (vacío = sin elección de color)
  description?: string;                 // descripción comercial (ficha de producto)
  details?: string;                     // composición y cuidados
  images?: string[];                    // galería adicional (la principal es `image`)
  colorImages?: Record<string, string>; // foto por color: { "Rojo": "/media/xxx.webp" }
  colorGallery?: Record<string, string[]>; // fotos extra por color (encuadre, detalle…)
  variants?: Variant[];                 // stock por talla × color (si hay, `stock` = suma)
};

// Combinación talla × color con su propio stock y referencia (PEK-0973-01).
export type Variant = { size?: string; color?: string; stock: number; sku?: string };

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

export type OrderItem = { productId: string; name: string; price: number; qty: number; size?: string; color?: string; variantSku?: string };

export type Order = {
  id: string;
  ref: string;
  customerId?: string;
  customerName?: string;
  items: OrderItem[];
  total: number;      // céntimos
  status: 'pendiente' | 'pagado' | 'enviado' | 'entregado' | 'cancelado';
  createdAt: string;
  customerEmail?: string;  // para volcar el pedido a FacturaScripts
  facturaRef?: string;     // referencia del documento creado en FacturaScripts
  syncedAt?: string;       // cuándo se volcó a FacturaScripts (null = pendiente)
  stripeSessionId?: string; // id de la sesión de pago de Stripe (checkout online)
  history?: { status: Order['status']; at: string }[]; // historial de estados (para el seguimiento)
};

// Item de cesta en el cliente
export type CartItem = { id: string; name: string; price: number; image: string; qty: number; size?: string; color?: string };

export type DB = {
  categories: Category[];
  products: Product[];
  customers: Customer[];
  orders: Order[];
  lastOrderNumber: number;
  lastSkuNumber?: number;  // contador para SKU automáticos (EUR-0001…)
  catalogVersion?: number; // versión del catálogo cargado (lib/store.ts → migrateCatalog)
};
