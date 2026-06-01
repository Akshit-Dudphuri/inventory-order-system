from decimal import Decimal

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.config import get_settings
from app.database import Base, engine, get_db
from app.models import Customer, Order, OrderItem, Product
from app.schemas import (
    CustomerCreate,
    CustomerRead,
    DashboardSummary,
    OrderCreate,
    OrderItemRead,
    OrderRead,
    ProductCreate,
    ProductRead,
    ProductUpdate,
)

settings = get_settings()

app = FastAPI(
    title="Inventory and Order Management API",
    version="1.0.0",
    description="Production-ready FastAPI backend for product, customer, order, and inventory management.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if settings.frontend_origin == "*" else [settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def create_tables() -> None:
    Base.metadata.create_all(bind=engine)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


def product_or_404(db: Session, product_id: int) -> Product:
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    return product


def customer_or_404(db: Session, customer_id: int) -> Customer:
    customer = db.get(Customer, customer_id)
    if not customer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")
    return customer


def serialize_order(order: Order) -> OrderRead:
    return OrderRead(
        id=order.id,
        customer_id=order.customer_id,
        customer_name=order.customer.full_name,
        customer_email=order.customer.email,
        total_amount=order.total_amount,
        created_at=order.created_at,
        items=[
            OrderItemRead(
                id=item.id,
                product_id=item.product_id,
                product_name=item.product.name,
                sku=item.product.sku,
                quantity=item.quantity,
                unit_price=item.unit_price,
                line_total=item.line_total,
            )
            for item in order.items
        ],
    )


@app.post("/products", response_model=ProductRead, status_code=status.HTTP_201_CREATED)
def create_product(payload: ProductCreate, db: Session = Depends(get_db)) -> Product:
    product = Product(**payload.model_dump())
    db.add(product)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Product SKU already exists") from exc
    db.refresh(product)
    return product


@app.get("/products", response_model=list[ProductRead])
def list_products(db: Session = Depends(get_db)) -> list[Product]:
    return db.query(Product).order_by(Product.id.desc()).all()


@app.get("/products/{product_id}", response_model=ProductRead)
def get_product(product_id: int, db: Session = Depends(get_db)) -> Product:
    return product_or_404(db, product_id)


@app.put("/products/{product_id}", response_model=ProductRead)
def update_product(product_id: int, payload: ProductUpdate, db: Session = Depends(get_db)) -> Product:
    product = product_or_404(db, product_id)
    for key, value in payload.model_dump().items():
        setattr(product, key, value)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Product SKU already exists") from exc
    db.refresh(product)
    return product


@app.delete("/products/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(product_id: int, db: Session = Depends(get_db)) -> None:
    product = product_or_404(db, product_id)
    db.delete(product)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot delete a product that is referenced by an order",
        ) from exc


@app.post("/customers", response_model=CustomerRead, status_code=status.HTTP_201_CREATED)
def create_customer(payload: CustomerCreate, db: Session = Depends(get_db)) -> Customer:
    customer = Customer(**payload.model_dump())
    db.add(customer)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Customer email already exists") from exc
    db.refresh(customer)
    return customer


@app.get("/customers", response_model=list[CustomerRead])
def list_customers(db: Session = Depends(get_db)) -> list[Customer]:
    return db.query(Customer).order_by(Customer.id.desc()).all()


@app.get("/customers/{customer_id}", response_model=CustomerRead)
def get_customer(customer_id: int, db: Session = Depends(get_db)) -> Customer:
    return customer_or_404(db, customer_id)


@app.delete("/customers/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_customer(customer_id: int, db: Session = Depends(get_db)) -> None:
    customer = customer_or_404(db, customer_id)
    db.delete(customer)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot delete a customer that is referenced by an order",
        ) from exc


@app.post("/orders", response_model=OrderRead, status_code=status.HTTP_201_CREATED)
def create_order(payload: OrderCreate, db: Session = Depends(get_db)) -> OrderRead:
    customer = customer_or_404(db, payload.customer_id)
    product_ids = [item.product_id for item in payload.items]
    products = db.query(Product).filter(Product.id.in_(product_ids)).with_for_update().all()
    products_by_id = {product.id: product for product in products}

    missing_ids = sorted(set(product_ids) - set(products_by_id))
    if missing_ids:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Products not found: {missing_ids}")

    order = Order(customer=customer, total_amount=Decimal("0.00"))
    total_amount = Decimal("0.00")

    for requested_item in payload.items:
        product = products_by_id[requested_item.product_id]
        if product.quantity_in_stock < requested_item.quantity:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Insufficient inventory for product {product.sku}",
            )

        line_total = product.price * requested_item.quantity
        total_amount += line_total
        product.quantity_in_stock -= requested_item.quantity
        order.items.append(
            OrderItem(
                product=product,
                quantity=requested_item.quantity,
                unit_price=product.price,
                line_total=line_total,
            )
        )

    order.total_amount = total_amount
    db.add(order)
    db.commit()

    saved_order = (
        db.query(Order)
        .options(joinedload(Order.customer), joinedload(Order.items).joinedload(OrderItem.product))
        .filter(Order.id == order.id)
        .one()
    )
    return serialize_order(saved_order)


@app.get("/orders", response_model=list[OrderRead])
def list_orders(db: Session = Depends(get_db)) -> list[OrderRead]:
    orders = (
        db.query(Order)
        .options(joinedload(Order.customer), joinedload(Order.items).joinedload(OrderItem.product))
        .order_by(Order.id.desc())
        .all()
    )
    return [serialize_order(order) for order in orders]


@app.get("/orders/{order_id}", response_model=OrderRead)
def get_order(order_id: int, db: Session = Depends(get_db)) -> OrderRead:
    order = (
        db.query(Order)
        .options(joinedload(Order.customer), joinedload(Order.items).joinedload(OrderItem.product))
        .filter(Order.id == order_id)
        .first()
    )
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    return serialize_order(order)


@app.delete("/orders/{order_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_order(order_id: int, db: Session = Depends(get_db)) -> None:
    order = (
        db.query(Order)
        .options(joinedload(Order.items).joinedload(OrderItem.product))
        .filter(Order.id == order_id)
        .first()
    )
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    for item in order.items:
        item.product.quantity_in_stock += item.quantity
    db.delete(order)
    db.commit()


@app.get("/dashboard", response_model=DashboardSummary)
def dashboard(db: Session = Depends(get_db)) -> DashboardSummary:
    return DashboardSummary(
        total_products=db.query(Product).count(),
        total_customers=db.query(Customer).count(),
        total_orders=db.query(Order).count(),
        low_stock_products=db.query(Product).filter(Product.quantity_in_stock <= 5).count(),
    )
