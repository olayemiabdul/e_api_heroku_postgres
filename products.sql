CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price NUMERIC(10, 2) NOT NULL,
  quantity INT NOT NULL,
  image BYTEA,  -- For storing binary data like images
  mimetype VARCHAR(255)
);