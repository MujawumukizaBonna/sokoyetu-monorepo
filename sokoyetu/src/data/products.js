export const products = [
  { id: 1, supplierId: 1, name: 'Fresh milk 500ml', emoji: '🥛', price: 450, unit: '500ml', moq: 24, stock: 500, category: 'Dairy' },
  { id: 2, supplierId: 1, name: 'Juice 1L', emoji: '🧃', price: 900, unit: '1L', moq: 12, stock: 300, category: 'Beverages' },
  { id: 3, supplierId: 1, name: 'Butter 250g', emoji: '🧈', price: 1200, unit: '250g', moq: 10, stock: 200, category: 'Dairy' },
  { id: 4, supplierId: 1, name: 'Yogurt 200ml', emoji: '🥤', price: 350, unit: '200ml', moq: 36, stock: 400, category: 'Dairy' },
  { id: 5, supplierId: 2, name: 'Wheat flour 2kg', emoji: '🌾', price: 1800, unit: '2kg', moq: 10, stock: 600, category: 'Flour' },
  { id: 6, supplierId: 2, name: 'Maize flour 1kg', emoji: '🌽', price: 900, unit: '1kg', moq: 20, stock: 800, category: 'Flour' },
  { id: 7, supplierId: 2, name: 'Rice 5kg', emoji: '🍚', price: 4500, unit: '5kg', moq: 5, stock: 300, category: 'Grains' },
  { id: 8, supplierId: 3, name: 'Bar soap 125g', emoji: '🧼', price: 350, unit: '125g', moq: 50, stock: 1000, category: 'Cleaning' },
  { id: 9, supplierId: 3, name: 'Detergent 500g', emoji: '🫧', price: 1100, unit: '500g', moq: 20, stock: 400, category: 'Cleaning' },
  { id: 10, supplierId: 4, name: 'Cotton fabric 1m', emoji: '🧵', price: 2200, unit: 'per metre', moq: 10, stock: 200, category: 'Fabric' },
];

export const orders = [
  { id: 1, productId: 1, productName: 'Fresh milk 500ml', supplierName: 'Inyange Industries', qty: 24, total: 12300, status: 'Confirmed', date: 'Today' },
  { id: 2, productId: 5, productName: 'Wheat flour 2kg', supplierName: 'Minimex Ltd', qty: 10, total: 19500, status: 'In transit', date: '3 days ago' },
  { id: 3, productId: 8, productName: 'Bar soap 125g', supplierName: 'Sulfo Rwanda', qty: 50, total: 18500, status: 'Delivered', date: '1 week ago' },
];
