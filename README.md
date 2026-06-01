# Inventory & Order Management System

Full-stack inventory and order management app built with React, FastAPI, PostgreSQL, Docker, and Docker Compose.

## Features

- Product CRUD with unique SKU validation
- Customer create/list/detail/delete with unique email validation
- Order creation, list, detail, and delete
- Inventory checks before order creation
- Automatic stock reduction after successful orders
- Backend-calculated order totals
- Dashboard totals for products, customers, orders, and low-stock products
- Responsive React UI with form validation and API error messages

## Tech Stack

- Backend: Python, FastAPI, SQLAlchemy
- Frontend: React, Vite
- Database: PostgreSQL
- Containers: Docker and Docker Compose

## Local Setup With Docker Compose

1. Copy the example environment file:

   ```bash
   cp .env.example .env
   ```

2. Update `.env` with a strong `POSTGRES_PASSWORD`.

3. Start the full stack:

   ```bash
   docker compose up --build
   ```

4. Open the app:

   - Frontend: [http://localhost:5173](https://frontend-akshit9582.vercel.app)
   - Backend API docs:[ http://localhost:8000/docs](https://inventory-order-api-ka3a.onrender.com)
   - Health check: http://localhost:8000/health

## API Endpoints

### Products

- `POST /products`
- `GET /products`
- `GET /products/{id}`
- `PUT /products/{id}`
- `DELETE /products/{id}`

### Customers

- `POST /customers`
- `GET /customers`
- `GET /customers/{id}`
- `DELETE /customers/{id}`

### Orders

- `POST /orders`
- `GET /orders`
- `GET /orders/{id}`
- `DELETE /orders/{id}`

### Dashboard

- `GET /dashboard`

## Deployment

### Backend on Render

1. Push this repository to GitHub.
2. Create a Render Blueprint using `render.yaml`, or create a Web Service manually from `backend/Dockerfile`.
3. Create a free PostgreSQL database on Render.
4. Configure environment variables:

   ```text
   DATABASE_URL=<Render PostgreSQL internal connection string>
   FRONTEND_ORIGIN=<your deployed frontend URL>
   ENVIRONMENT=production
   ```

5. Confirm `https://your-backend.onrender.com/health` returns `{"status":"ok"}`.

### Frontend on Vercel or Netlify

1. Set the frontend project root to `frontend`.
2. Build command:

   ```bash
   npm run build
   ```

3. Publish directory:

   ```text
   dist
   ```

4. Configure:

   ```text
   VITE_API_URL=https://your-backend.onrender.com
   ```

5. Redeploy the backend after setting `FRONTEND_ORIGIN` to the final frontend URL.

## Notes

- Credentials are read from environment variables and are not hardcoded.
- PostgreSQL persistence uses the named Docker volume `postgres_data`.
- FastAPI validates request bodies and returns appropriate `4xx` errors for bad input, conflicts, missing resources, and insufficient inventory.
