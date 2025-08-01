// MongoDB initialization script for Flow Platform

// Switch to the flow_platform database
db = db.getSiblingDB('flow_platform');

// Create collections for node-core testing
db.createCollection('users');
db.createCollection('products');
db.createCollection('orders');
db.createCollection('logs');

// Insert sample data for testing
db.users.insertMany([
  {
    _id: ObjectId(),
    name: 'John Doe',
    email: 'john.doe@example.com',
    age: 30,
    status: 'active',
    createdAt: new Date(),
    profile: {
      bio: 'Software developer',
      interests: ['coding', 'reading', 'music']
    }
  },
  {
    _id: ObjectId(),
    name: 'Jane Smith',
    email: 'jane.smith@example.com',
    age: 25,
    status: 'active',
    createdAt: new Date(),
    profile: {
      bio: 'Data scientist',
      interests: ['data', 'machine learning', 'python']
    }
  },
  {
    _id: ObjectId(),
    name: 'Bob Johnson',
    email: 'bob.johnson@example.com',
    age: 35,
    status: 'inactive',
    createdAt: new Date(),
    profile: {
      bio: 'Project manager',
      interests: ['management', 'strategy', 'team building']
    }
  },
  {
    _id: ObjectId(),
    name: 'Alice Brown',
    email: 'alice.brown@example.com',
    age: 28,
    status: 'active',
    createdAt: new Date(),
    profile: {
      bio: 'UX designer',
      interests: ['design', 'user experience', 'creativity']
    }
  },
  {
    _id: ObjectId(),
    name: 'Charlie Wilson',
    email: 'charlie.wilson@example.com',
    age: 42,
    status: 'active',
    createdAt: new Date(),
    profile: {
      bio: 'DevOps engineer',
      interests: ['infrastructure', 'automation', 'monitoring']
    }
  }
]);

db.products.insertMany([
  {
    _id: ObjectId(),
    name: 'Laptop Pro',
    category: 'Electronics',
    price: 1299.99,
    stock: 50,
    status: 'available',
    tags: ['laptop', 'computer', 'professional'],
    createdAt: new Date(),
    specifications: {
      cpu: 'Intel i7',
      memory: '16GB',
      storage: '512GB SSD',
      display: '15.6 inch'
    }
  },
  {
    _id: ObjectId(),
    name: 'Wireless Mouse',
    category: 'Accessories',
    price: 29.99,
    stock: 200,
    status: 'available',
    tags: ['mouse', 'wireless', 'computer'],
    createdAt: new Date(),
    specifications: {
      type: 'Optical',
      connectivity: 'Bluetooth',
      battery: 'AA'
    }
  },
  {
    _id: ObjectId(),
    name: 'Monitor 4K',
    category: 'Electronics',
    price: 399.99,
    stock: 25,
    status: 'available',
    tags: ['monitor', '4k', 'display'],
    createdAt: new Date(),
    specifications: {
      size: '27 inch',
      resolution: '3840x2160',
      refreshRate: '60Hz',
      ports: ['HDMI', 'DisplayPort', 'USB-C']
    }
  },
  {
    _id: ObjectId(),
    name: 'Mechanical Keyboard',
    category: 'Accessories',
    price: 149.99,
    stock: 75,
    status: 'available',
    tags: ['keyboard', 'mechanical', 'gaming'],
    createdAt: new Date(),
    specifications: {
      switches: 'Cherry MX Blue',
      backlight: 'RGB',
      connectivity: 'USB-C'
    }
  }
]);

db.orders.insertMany([
  {
    _id: ObjectId(),
    orderId: 'ORD-001',
    userId: 'john.doe@example.com',
    products: [
      { productName: 'Laptop Pro', quantity: 1, price: 1299.99 },
      { productName: 'Wireless Mouse', quantity: 2, price: 29.99 }
    ],
    totalAmount: 1359.97,
    status: 'completed',
    orderDate: new Date('2024-01-15'),
    shippingAddress: {
      street: '123 Main St',
      city: 'New York',
      state: 'NY',
      zipCode: '10001',
      country: 'USA'
    }
  },
  {
    _id: ObjectId(),
    orderId: 'ORD-002',
    userId: 'jane.smith@example.com',
    products: [
      { productName: 'Monitor 4K', quantity: 1, price: 399.99 },
      { productName: 'Mechanical Keyboard', quantity: 1, price: 149.99 }
    ],
    totalAmount: 549.98,
    status: 'processing',
    orderDate: new Date('2024-01-20'),
    shippingAddress: {
      street: '456 Oak Ave',
      city: 'San Francisco',
      state: 'CA',
      zipCode: '94102',
      country: 'USA'
    }
  },
  {
    _id: ObjectId(),
    orderId: 'ORD-003',
    userId: 'alice.brown@example.com',
    products: [
      { productName: 'Wireless Mouse', quantity: 1, price: 29.99 }
    ],
    totalAmount: 29.99,
    status: 'shipped',
    orderDate: new Date('2024-01-25'),
    shippingAddress: {
      street: '789 Pine St',
      city: 'Seattle',
      state: 'WA',
      zipCode: '98101',
      country: 'USA'
    }
  }
]);

// Create indexes for better performance
db.users.createIndex({ 'email': 1 }, { unique: true });
db.users.createIndex({ 'status': 1 });
db.users.createIndex({ 'createdAt': 1 });

db.products.createIndex({ 'category': 1 });
db.products.createIndex({ 'status': 1 });
db.products.createIndex({ 'tags': 1 });
db.products.createIndex({ 'price': 1 });

db.orders.createIndex({ 'orderId': 1 }, { unique: true });
db.orders.createIndex({ 'userId': 1 });
db.orders.createIndex({ 'status': 1 });
db.orders.createIndex({ 'orderDate': 1 });

// Create a user for the application with read/write permissions
db.createUser({
  user: 'flow_app',
  pwd: 'flow_password',
  roles: [
    {
      role: 'readWrite',
      db: 'flow_platform'
    }
  ]
});

print('MongoDB initialization completed successfully!');
print('Collections created: users, products, orders, logs');
print('Sample data inserted and indexes created');
print('Application user created: flow_app');