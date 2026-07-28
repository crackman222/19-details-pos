-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.treatments (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  treatment_code text NOT NULL UNIQUE,
  customer_name text,
  plate_number text NOT NULL,
  treatment_type text,
  pic text,
  status text NOT NULL DEFAULT 'created'::text,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT treatments_pkey PRIMARY KEY (id)
);
CREATE TABLE public.payments (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  treatment_id bigint,
  amount numeric NOT NULL,
  payment_method text NOT NULL,
  proof_url text,
  paid_at timestamp with time zone DEFAULT now(),
  CONSTRAINT payments_pkey PRIMARY KEY (id),
  CONSTRAINT payments_treatment_id_fkey FOREIGN KEY (treatment_id) REFERENCES public.treatments(id)
);
CREATE TABLE public.photos (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  treatment_id bigint,
  image_url text NOT NULL,
  photo_type text NOT NULL,
  uploaded_at timestamp with time zone DEFAULT now(),
  CONSTRAINT photos_pkey PRIMARY KEY (id),
  CONSTRAINT photos_treatment_id_fkey FOREIGN KEY (treatment_id) REFERENCES public.treatments(id)
);
CREATE TABLE public.treatment_logs (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  treatment_id bigint,
  action text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT treatment_logs_pkey PRIMARY KEY (id),
  CONSTRAINT treatment_logs_treatment_id_fkey FOREIGN KEY (treatment_id) REFERENCES public.treatments(id)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  full_name text,
  role text NOT NULL DEFAULT 'staff'::text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.services (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  name text NOT NULL,
  price numeric NOT NULL,
  CONSTRAINT services_pkey PRIMARY KEY (id)
);