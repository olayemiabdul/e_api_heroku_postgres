import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import dotenv from "dotenv";
import cors from "cors";
import multer from "multer";

dotenv.config();

// Constants defination
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB as mas
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// Express setup
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));

// Multer configuration
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE
  },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and WebP are allowed.'));
    }
  }
});

// Heroku Database 
const db = new pg.Client({
  connectionString: process.env.DATABASE_URL || 'postgres://uba871efd7fmdc:p10b5330773828fdbba94c1149faa1c08c8620ad4995be0326cfdc728095ac085@ccpa7stkruda3o.cluster-czrs8kj4isg7.us-east-1.rds.amazonaws.com:5432/dbr2k67ajhviqk',
  ssl: {
    rejectUnauthorized: false
  }
});

// Connect to database
db.connect()
  .then(() => console.log('Connected to the database'))
  .catch(err => console.error('Database connection error:', err.stack));

// Helper functions
const generateImageUrl = (req, type, id) => {
  const baseUrl = process.env.DATABASE_URL === 'production' 
    ? process.env.APP_URL 
    : `${req.protocol}://${req.get('host')}`;
  return `${baseUrl}/${type}/${id}/image`;
};

const handleDatabaseError = (err, res, operation) => {
  console.error(`Database error during ${operation}:`, err);
  res.status(500).json({ 
    error: `Failed to ${operation}`,
    details: process.env.DATABASE_URL === 'development' ? err.message : undefined
  });
};

// Generic CRUD operations for both products and shoes
const createItem = async (req, res, tableName) => {
  const { name, description, price, quantity } = req.body;
  const image = req.file?.buffer || null;
  const mimetype = req.file?.mimetype || null;

  try {
    const result = await db.query(
      `INSERT INTO ${tableName} (name, description, price, quantity, image, mimetype) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING id, name, description, price, quantity, mimetype`,
      [name, description, parseFloat(price), parseInt(quantity), image, mimetype]
    );
    
    const item = result.rows[0];
    item.imageUrl = item.id ? generateImageUrl(req, tableName, item.id) : null;
    
    res.status(201).json(item);
  } catch (err) {
    handleDatabaseError(err, res, `create ${tableName}`);
  }
};

const getItems = async (req, res, tableName) => {
  try {
    const result = await db.query(`SELECT id, name, description, price, quantity, mimetype FROM ${tableName}`);
    const items = result.rows.map(item => ({
      ...item,
      imageUrl: generateImageUrl(req, tableName, item.id)
    }));
    res.json(items);
  } catch (err) {
    handleDatabaseError(err, res, `fetch ${tableName}`);
  }
};

const getImage = async (req, res, tableName) => {
  const { id } = req.params;

  try {
    const result = await db.query(
      `SELECT image, mimetype FROM ${tableName} WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0 || !result.rows[0].image) {
      return res.status(404).json({ error: 'Image not found' });
    }

    // Cache images in production
    if (process.env.DATABASE_URL === 'production') {
      res.set('Cache-Control', 'public, max-age=31557600'); // Cache for 1 year
      res.set('ETag', `"${id}"`);
    }

    res.set('Content-Type', result.rows[0].mimetype);
    res.send(result.rows[0].image);
  } catch (err) {
    handleDatabaseError(err, res, 'fetch image');
  }
};

const updateItem = async (req, res, tableName) => {
  const id = parseInt(req.params.id);
  let { name, description, price, quantity } = req.body;
  const image = req.file?.buffer || null;
  const mimetype = req.file?.mimetype || null;

  try {
    const result = await db.query(
      `UPDATE ${tableName}
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           price = COALESCE($3, price),
           quantity = COALESCE($4, quantity),
           image = COALESCE($5, image),
           mimetype = COALESCE($6, mimetype)
       WHERE id = $7
       RETURNING id, name, description, price, quantity`,
      [name, description, price ? parseFloat(price) : null, 
       quantity ? parseInt(quantity) : null, image, mimetype, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: `${tableName} not found` });
    }

    const item = result.rows[0];
    item.imageUrl = generateImageUrl(req, tableName, item.id);
    res.json(item);
  } catch (err) {
    handleDatabaseError(err, res, `update ${tableName}`);
  }
};

const deleteItem = async (req, res, tableName) => {
  const id = parseInt(req.params.id);

  try {
    const result = await db.query(`DELETE FROM ${tableName} WHERE id = $1 RETURNING id`, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: `${tableName} not found` });
    }
    res.json({ message: `${tableName} deleted successfully` });
  } catch (err) {
    handleDatabaseError(err, res, `delete ${tableName}`);
  }
};

// Routes
// Products
app.post('/products', upload.single('image'), (req, res) => createItem(req, res, 'products'));
app.get('/products', (req, res) => getItems(req, res, 'products'));
app.get('/products/:id/image', (req, res) => getImage(req, res, 'products'));
app.patch('/products/:id', upload.single('image'), (req, res) => updateItem(req, res, 'products'));
app.delete('/products/:id', (req, res) => deleteItem(req, res, 'products'));

// Shoes
app.post('/shoes', upload.single('image'), (req, res) => createItem(req, res, 'shoes'));
app.get('/shoes', (req, res) => getItems(req, res, 'shoes'));
app.get('/shoes/:id/image', (req, res) => getImage(req, res, 'shoes'));
app.patch('/shoes/:id', upload.single('image'), (req, res) => updateItem(req, res, 'shoes'));
app.delete('/shoes/:id', (req, res) => deleteItem(req, res, 'shoes'));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ 
      error: 'File upload error',
      details: err.message 
    });
  }
  res.status(500).json({ 
    error: 'Internal server error',
    details: process.env.DATABASE_URL === 'development' ? err.message : undefined
  });
});

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  db.end();
  process.exit(0);
});