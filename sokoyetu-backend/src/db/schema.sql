-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.users (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name character varying NOT NULL,
  phone character varying NOT NULL UNIQUE,
  password character varying NOT NULL,
  role character varying NOT NULL CHECK (role::text = ANY (ARRAY['retailer'::character varying, 'manufacturer'::character varying]::text[])),
  location character varying,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT users_pkey PRIMARY KEY (id)
);
CREATE TABLE public.suppliers (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid,
  name character varying NOT NULL,
  category character varying,
  location character varying DEFAULT 'Kigali'::character varying,
  description text,
  emoji character varying DEFAULT '🏭'::character varying,
  verified boolean DEFAULT false,
  rating numeric DEFAULT 0.0,
  reviews_count integer DEFAULT 0,
  established integer,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT suppliers_pkey PRIMARY KEY (id),
  CONSTRAINT suppliers_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.products (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  supplier_id uuid,
  name character varying NOT NULL,
  emoji character varying DEFAULT '📦'::character varying,
  price_rwf integer NOT NULL,
  unit character varying,
  moq integer NOT NULL DEFAULT 1,
  stock integer DEFAULT 0,
  category character varying,
  description text,
  available boolean DEFAULT true,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT products_pkey PRIMARY KEY (id),
  CONSTRAINT products_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id)
);
CREATE TABLE public.orders (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  retailer_id uuid,
  product_id uuid,
  supplier_id uuid,
  quantity integer NOT NULL,
  unit_price integer NOT NULL,
  delivery_fee integer DEFAULT 1500,
  total_rwf integer NOT NULL,
  status character varying DEFAULT 'pending'::character varying CHECK (status::text = ANY (ARRAY['pending'::character varying, 'confirmed'::character varying, 'in_transit'::character varying, 'delivered'::character varying, 'cancelled'::character varying]::text[])),
  payment_status character varying DEFAULT 'unpaid'::character varying CHECK (payment_status::text = ANY (ARRAY['unpaid'::character varying, 'paid'::character varying, 'refunded'::character varying]::text[])),
  delivery_location character varying,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  CONSTRAINT orders_pkey PRIMARY KEY (id),
  CONSTRAINT orders_retailer_id_fkey FOREIGN KEY (retailer_id) REFERENCES public.users(id),
  CONSTRAINT orders_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id),
  CONSTRAINT orders_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id)
);
CREATE TABLE public.payments (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  order_id uuid,
  retailer_id uuid,
  amount integer NOT NULL,
  currency character varying DEFAULT 'RWF'::character varying,
  payment_method character varying NOT NULL,
  phone_number character varying,
  provider_code character varying,
  provider_code character varying,
  status character varying DEFAULT 'pending'::character varying CHECK (status::text = ANY (ARRAY['pending'::character varying, 'processing'::character varying, 'completed'::character varying, 'failed'::character varying, 'cancelled'::character varying]::text[])),
  provider_reference character varying,
  external_id uuid DEFAULT uuid_generate_v4(),
  failure_reason text,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  CONSTRAINT payments_pkey PRIMARY KEY (id),
  CONSTRAINT payments_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id),
  CONSTRAINT payments_retailer_id_fkey FOREIGN KEY (retailer_id) REFERENCES public.users(id)
);
