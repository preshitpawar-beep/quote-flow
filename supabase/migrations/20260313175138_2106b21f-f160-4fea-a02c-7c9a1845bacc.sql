
-- Drop the recursive policies
DROP POLICY IF EXISTS "Anon can view rfqs via supplier link" ON public.rfqs;
DROP POLICY IF EXISTS "Anon can update rfq status via supplier link" ON public.rfqs;
DROP POLICY IF EXISTS "Anon can view rfq_items via supplier link" ON public.rfq_items;
DROP POLICY IF EXISTS "Anon can view rfq_files via supplier link" ON public.rfq_files;
DROP POLICY IF EXISTS "Anon can view quotes via supplier link" ON public.quotes;
DROP POLICY IF EXISTS "Anon can update quotes via supplier link" ON public.quotes;
DROP POLICY IF EXISTS "Anon can insert quote_items via supplier link" ON public.quote_items;
DROP POLICY IF EXISTS "Public token-based select rfq_suppliers" ON public.rfq_suppliers;
DROP POLICY IF EXISTS "Suppliers can view invited RFQs" ON public.rfqs;

-- Create security definer function to check if an rfq has supplier invitations
CREATE OR REPLACE FUNCTION public.rfq_has_suppliers(_rfq_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.rfq_suppliers WHERE rfq_id = _rfq_id
  )
$$;

-- Create security definer function to check if a quote belongs to an invited supplier
CREATE OR REPLACE FUNCTION public.quote_has_supplier_link(_rfq_supplier_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.rfq_suppliers WHERE id = _rfq_supplier_id
  )
$$;

-- Create security definer function to check quote_items link
CREATE OR REPLACE FUNCTION public.quote_item_has_supplier_link(_quote_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.quotes q
    JOIN public.rfq_suppliers rs ON rs.id = q.rfq_supplier_id
    WHERE q.id = _quote_id
  )
$$;

-- Re-create non-recursive policies using security definer functions
-- rfq_suppliers: anon can select (token check in WHERE clause)
CREATE POLICY "Anon select rfq_suppliers" ON public.rfq_suppliers FOR SELECT TO anon USING (true);

-- rfqs: anon can view/update if rfq has suppliers
CREATE POLICY "Anon view rfqs with suppliers" ON public.rfqs FOR SELECT TO anon USING (public.rfq_has_suppliers(id));
CREATE POLICY "Anon update rfqs with suppliers" ON public.rfqs FOR UPDATE TO anon USING (public.rfq_has_suppliers(id));

-- Suppliers can view invited RFQs (fix the original broken policy)
CREATE POLICY "Suppliers view invited rfqs" ON public.rfqs FOR SELECT TO authenticated USING (
  public.rfq_has_suppliers(id) AND EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'supplier'
  )
);

-- rfq_items: anon can view
CREATE POLICY "Anon view rfq_items" ON public.rfq_items FOR SELECT TO anon USING (public.rfq_has_suppliers(rfq_id));

-- rfq_files: anon can view
CREATE POLICY "Anon view rfq_files" ON public.rfq_files FOR SELECT TO anon USING (public.rfq_has_suppliers(rfq_id));

-- quotes: anon can view/update
CREATE POLICY "Anon view quotes" ON public.quotes FOR SELECT TO anon USING (public.quote_has_supplier_link(rfq_supplier_id));
CREATE POLICY "Anon update quotes" ON public.quotes FOR UPDATE TO anon USING (public.quote_has_supplier_link(rfq_supplier_id));

-- quote_items: anon can insert
CREATE POLICY "Anon insert quote_items" ON public.quote_items FOR INSERT TO anon WITH CHECK (public.quote_item_has_supplier_link(quote_id));
