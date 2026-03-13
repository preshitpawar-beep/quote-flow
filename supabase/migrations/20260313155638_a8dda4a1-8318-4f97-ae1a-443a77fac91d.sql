
-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('buyer', 'supplier');

-- Create enum for RFQ status
CREATE TYPE public.rfq_status AS ENUM ('draft', 'sent', 'quoting', 'closed', 'awarded');

-- Create enum for quote status
CREATE TYPE public.quote_status AS ENUM ('pending', 'submitted', 'accepted', 'rejected');

-- Create enum for urgency
CREATE TYPE public.urgency_level AS ENUM ('normal', 'urgent', 'critical');

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL DEFAULT '',
  company_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

-- Suppliers table (managed by buyers)
CREATE TABLE public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  company_name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  specialties TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RFQs table
CREATE TABLE public.rfqs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status rfq_status NOT NULL DEFAULT 'draft',
  urgency urgency_level NOT NULL DEFAULT 'normal',
  deadline TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RFQ line items (parts)
CREATE TABLE public.rfq_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id UUID REFERENCES public.rfqs(id) ON DELETE CASCADE NOT NULL,
  part_number TEXT,
  description TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit TEXT DEFAULT 'pcs',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RFQ file attachments (drawings)
CREATE TABLE public.rfq_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id UUID REFERENCES public.rfqs(id) ON DELETE CASCADE NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  file_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RFQ-Supplier junction (which suppliers are invited)
CREATE TABLE public.rfq_suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id UUID REFERENCES public.rfqs(id) ON DELETE CASCADE NOT NULL,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE CASCADE NOT NULL,
  supplier_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  access_token TEXT NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  invited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reminded_at TIMESTAMPTZ,
  UNIQUE (rfq_id, supplier_id)
);

-- Quotes (supplier responses)
CREATE TABLE public.quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id UUID REFERENCES public.rfqs(id) ON DELETE CASCADE NOT NULL,
  rfq_supplier_id UUID REFERENCES public.rfq_suppliers(id) ON DELETE CASCADE NOT NULL,
  supplier_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status quote_status NOT NULL DEFAULT 'pending',
  total_price DECIMAL(12, 2),
  currency TEXT DEFAULT 'USD',
  lead_time_days INTEGER,
  notes TEXT,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Quote line items
CREATE TABLE public.quote_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID REFERENCES public.quotes(id) ON DELETE CASCADE NOT NULL,
  rfq_item_id UUID REFERENCES public.rfq_items(id) ON DELETE CASCADE NOT NULL,
  unit_price DECIMAL(12, 2) NOT NULL,
  lead_time_days INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Storage bucket for drawings
INSERT INTO storage.buckets (id, name, public) VALUES ('rfq-files', 'rfq-files', false);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rfqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rfq_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rfq_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rfq_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- Updated at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_rfqs_updated_at BEFORE UPDATE ON public.rfqs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_quotes_updated_at BEFORE UPDATE ON public.quotes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS Policies

-- Profiles
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- User roles
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

-- Suppliers (managed by buyers)
CREATE POLICY "Buyers can view own suppliers" ON public.suppliers FOR SELECT USING (auth.uid() = created_by);
CREATE POLICY "Buyers can create suppliers" ON public.suppliers FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Buyers can update own suppliers" ON public.suppliers FOR UPDATE USING (auth.uid() = created_by);
CREATE POLICY "Buyers can delete own suppliers" ON public.suppliers FOR DELETE USING (auth.uid() = created_by);

-- RFQs
CREATE POLICY "Buyers can view own RFQs" ON public.rfqs FOR SELECT USING (auth.uid() = created_by);
CREATE POLICY "Buyers can create RFQs" ON public.rfqs FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Buyers can update own RFQs" ON public.rfqs FOR UPDATE USING (auth.uid() = created_by);
CREATE POLICY "Suppliers can view invited RFQs" ON public.rfqs FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.rfq_suppliers rs WHERE rs.rfq_id = id AND rs.supplier_user_id = auth.uid())
);

-- RFQ Items
CREATE POLICY "Buyers can manage RFQ items" ON public.rfq_items FOR ALL USING (
  EXISTS (SELECT 1 FROM public.rfqs WHERE rfqs.id = rfq_items.rfq_id AND rfqs.created_by = auth.uid())
);
CREATE POLICY "Suppliers can view invited RFQ items" ON public.rfq_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.rfq_suppliers rs JOIN public.rfqs r ON r.id = rs.rfq_id WHERE r.id = rfq_items.rfq_id AND rs.supplier_user_id = auth.uid())
);

-- RFQ Files
CREATE POLICY "Buyers can manage RFQ files" ON public.rfq_files FOR ALL USING (
  EXISTS (SELECT 1 FROM public.rfqs WHERE rfqs.id = rfq_files.rfq_id AND rfqs.created_by = auth.uid())
);
CREATE POLICY "Suppliers can view invited RFQ files" ON public.rfq_files FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.rfq_suppliers rs JOIN public.rfqs r ON r.id = rs.rfq_id WHERE r.id = rfq_files.rfq_id AND rs.supplier_user_id = auth.uid())
);

-- RFQ Suppliers
CREATE POLICY "Buyers can manage RFQ suppliers" ON public.rfq_suppliers FOR ALL USING (
  EXISTS (SELECT 1 FROM public.rfqs WHERE rfqs.id = rfq_suppliers.rfq_id AND rfqs.created_by = auth.uid())
);
CREATE POLICY "Suppliers can view own invitations" ON public.rfq_suppliers FOR SELECT USING (supplier_user_id = auth.uid());

-- Quotes
CREATE POLICY "Buyers can view quotes on own RFQs" ON public.quotes FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.rfqs WHERE rfqs.id = quotes.rfq_id AND rfqs.created_by = auth.uid())
);
CREATE POLICY "Suppliers can manage own quotes" ON public.quotes FOR ALL USING (supplier_user_id = auth.uid());

-- Quote Items
CREATE POLICY "Buyers can view quote items" ON public.quote_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.quotes q JOIN public.rfqs r ON r.id = q.rfq_id WHERE q.id = quote_items.quote_id AND r.created_by = auth.uid())
);
CREATE POLICY "Suppliers can manage own quote items" ON public.quote_items FOR ALL USING (
  EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = quote_items.quote_id AND q.supplier_user_id = auth.uid())
);

-- Storage policies for rfq-files bucket
CREATE POLICY "Buyers can upload RFQ files" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'rfq-files' AND auth.uid() IS NOT NULL);
CREATE POLICY "Buyers can view own RFQ files" ON storage.objects FOR SELECT USING (bucket_id = 'rfq-files' AND auth.uid() IS NOT NULL);
CREATE POLICY "Buyers can delete own RFQ files" ON storage.objects FOR DELETE USING (bucket_id = 'rfq-files' AND auth.uid() IS NOT NULL);
