import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import dotenv from "dotenv";
import cors from "cors";
import multer from "multer";

dotenv.config();  

const app = express();  
const port = process.env.PORT || 3000;  

app.use(cors());
app.use(express.json());
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true })); 

// Image upload configuration
const upload = multer({ storage: multer.memoryStorage() }); 

// Connect to PostgreSQL on Heroku
const myDb = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

myDb.connect()
  .then(() => console.log('Connected to the database'))
  .catch(err => console.error('Connection error', err.stack));

// Add a new product with image to the 'products' table
app.post('/products', upload.single('image'), async (req, res) => {
  const { name, description, price, quantity } = req.body;
  
  //  Get image buffer and mimetype from the uploaded file
  const imageUrl = req.file ? `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}` : null;
  const mimetype = req.file ? req.file.mimetype : null;

  try {
    const result = await myDb.query(
      'INSERT INTO products (name, description, price, quantity, image, mimetype) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [name, description, parseFloat(price), parseInt(quantity), imageUrl, mimetype]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

// Add a new shoe with image to the 'shoes' table
app.post('/shoes', upload.single('image'), async (req, res) => {
  const { name, description, price, quantity } = req.body;
  const imageUrl = req.file ? `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}` : null;
  const mimetype = req.file ? req.file.mimetype : null;

  try {
    const result = await myDb.query(
      'INSERT INTO shoes (name, description, price, quantity, image, mimetype) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [name, description, parseFloat(price), parseInt(quantity), imageUrl, mimetype]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: 'Failed to create shoe' });
  }
});

// Fetching all products with image URLs
// app.get('/products', async (req, res) => {
//   try {
//     const result = await myDb.query('SELECT * FROM products');
    
//     const products = result.rows.map(product => ({
//       ...product,
//       imageUrl: product.image ? `${req.protocol}://${req.get('host')}/products/${product.id}/image` : null
//     }));

//     res.json(products);
//   } catch (err) {
//     console.log(err);
//     res.status(500).json({ error: 'Failed to fetch products' });
//   }
// });
app.get('/products', async (req, res) => {
  try {
    const result = await myDb.query('SELECT * FROM products');
    
    const products = result.rows.map(product => {
      const { image, ...rest } = product;  // Remove the 'image' field
      return {
        ...rest,
        imageUrl: product.image ? `${req.protocol}://${req.get('host')}/products/${product.id}/image` : null
      };
    });

    res.json(products);
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});
app.get('/shoes', async (req, res) => {
  try {
    const result = await myDb.query('SELECT * FROM shoes');
    
    const shoes = result.rows.map(product => {
      const { image, ...rest } = product;  // Remove the 'image' field
      return {
        ...rest,
        imageUrl: product.image ? `${req.protocol}://${req.get('host')}/products/${product.id}/image` : null
      };
    });

    res.json(shoes);
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});


// Fetching all shoes with image URLs
// app.get('/shoes', async (req, res) => {
//   try {
//     const result = await myDb.query('SELECT * FROM shoes');
    
//     const shoes = result.rows.map(shoe => ({
//       ...shoe,
//       imageUrl: shoe.image ? `${req.protocol}://${req.get('host')}/shoes/${shoe.id}/image` : null
//     }));

//     res.json(shoes);
//   } catch (err) {
//     console.log(err);
//     res.status(500).json({ error: 'Failed to fetch shoes' });
//   }
// });

app.get('/products/:id/image', async (req, res) => {
  const id = req.params.id;

  try {
    const result = await myDb.query('SELECT image, mimetype FROM products WHERE id = $1', [id]);

    if (result.rows.length > 0 && result.rows[0].image) {
      res.set('Content-Type', result.rows[0].mimetype); // Use dynamic mimetype
      res.send(result.rows[0].image);
    } else {
      res.status(404).json({ error: 'Image not found' });
    }
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: 'Failed to fetch image' });
  }
});

// Fetch shoe image as binary from the database
app.get('/shoes/:id/image', async (req, res) => {
  const id = req.params.id;

  try {
    const result = await myDb.query('SELECT image, mimetype FROM shoes WHERE id = $1', [id]);

    if (result.rows.length > 0 && result.rows[0].image) {
      res.set('Content-Type', result.rows[0].mimetype); // Use dynamic mimetype
      res.send(result.rows[0].image);
    } else {
      res.status(404).json({ error: 'Image not found' });
    }
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: 'Failed to fetch image' });
  }
});

// PATCH - Partially update a product by ID
app.patch('/products/:id', upload.single('image'), async (req, res) => {
  const id = parseInt(req.params.id);
  let { name, description, price, quantity } = req.body;
  const imageUrl = req.file ? `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}` : null;
  const mimetype = req.file ? req.file.mimetype : null;

  // Convert price and quantity if they exist
  price = price ? parseFloat(price) : null;
  quantity = quantity ? parseInt(quantity) : null;

  try {
    // Only update fields that were provided
    const result = await myDb.query(
      `UPDATE products
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           price = COALESCE($3, price),
           quantity = COALESCE($4, quantity),
           image = COALESCE($5, image),
           mimetype = COALESCE($6, mimetype)
       WHERE id = $7
       RETURNING *`,
      [name, description, price, quantity, imageUrl, mimetype, id]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Product not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// PATCH - Partially update a shoe by ID
app.patch('/shoes/:id', upload.single('image'), async (req, res) => {
  const id = parseInt(req.params.id);
  let { name, description, price, quantity } = req.body;
  const imageUrl = req.file ? `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}` : null;
  const mimetype = req.file ? req.file.mimetype : null;

  price = price ? parseFloat(price) : null;
  quantity = quantity ? parseInt(quantity) : null;

  try {
    const result = await myDb.query(
      `UPDATE shoes
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           price = COALESCE($3, price),
           quantity = COALESCE($4, quantity),
           image = COALESCE($5, image),
           mimetype = COALESCE($6, mimetype)
       WHERE id = $7
       RETURNING *`,
      [name, description, price, quantity, imageUrl, mimetype, id]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Shoe not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update shoe' });
  }
});

// DELETE - Remove a product by ID
app.delete('/products/:id', async (req, res) => {
  const id = parseInt(req.params.id);

  try {
    const result = await myDb.query('DELETE FROM products WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Product not found' });
    res.json({ message: 'Product deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

// DELETE - Remove a shoe by ID
app.delete('/shoes/:id', async (req, res) => {
  const id = parseInt(req.params.id);

  try {
    const result = await myDb.query('DELETE FROM shoes WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Shoe not found' });
    res.json({ message: 'Shoe deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete shoe' });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
