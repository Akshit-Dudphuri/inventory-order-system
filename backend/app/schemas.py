from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class ProductBase(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    sku: str = Field(min_length=1, max_length=80)
    price: Decimal = Field(ge=0, max_digits=10, decimal_places=2)
    quantity_in_stock: int = Field(ge=0)

    @field_validator("name", "sku")
    @classmethod
    def strip_required_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Field cannot be empty")
        return value


class ProductCreate(ProductBase):
    pass


class ProductUpdate(ProductBase):
    pass


class ProductRead(ProductBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CustomerBase(BaseModel):
    full_name: str = Field(min_length=1, max_length=140)
    email: EmailStr
    phone_number: str = Field(min_length=5, max_length=40)

    @field_validator("full_name", "phone_number")
    @classmethod
    def strip_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Field cannot be empty")
        return value

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.lower()


class CustomerCreate(CustomerBase):
    pass


class CustomerRead(CustomerBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class OrderItemCreate(BaseModel):
    product_id: int = Field(gt=0)
    quantity: int = Field(gt=0)


class OrderCreate(BaseModel):
    customer_id: int = Field(gt=0)
    items: list[OrderItemCreate] = Field(min_length=1)

    @field_validator("items")
    @classmethod
    def reject_duplicate_products(cls, items: list[OrderItemCreate]) -> list[OrderItemCreate]:
        product_ids = [item.product_id for item in items]
        if len(product_ids) != len(set(product_ids)):
            raise ValueError("Each product can appear only once per order")
        return items


class OrderItemRead(BaseModel):
    id: int
    product_id: int
    product_name: str
    sku: str
    quantity: int
    unit_price: Decimal
    line_total: Decimal


class OrderRead(BaseModel):
    id: int
    customer_id: int
    customer_name: str
    customer_email: str
    total_amount: Decimal
    created_at: datetime
    items: list[OrderItemRead]


class DashboardSummary(BaseModel):
    total_products: int
    total_customers: int
    total_orders: int
    low_stock_products: int
