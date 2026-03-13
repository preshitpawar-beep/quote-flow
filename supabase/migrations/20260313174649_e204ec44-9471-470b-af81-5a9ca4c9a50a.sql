
-- Fix: Allow users to insert their own roles during signup
CREATE POLICY "Users can insert own roles" ON public.user_roles FOR INSERT TO public WITH CHECK (auth.uid() = user_id);

-- Fix: Allow buyers to insert quotes when creating RFQs
CREATE POLICY "Buyers can insert quotes" ON public.quotes FOR INSERT TO public WITH CHECK (
  EXISTS (SELECT 1 FROM public.rfqs WHERE rfqs.id = quotes.rfq_id AND rfqs.created_by = auth.uid())
);

-- Fix: Allow token-based access for supplier quote page (no auth required)
-- rfq_suppliers: allow public select (security via access_token in WHERE clause)
CREATE POLICY "Public token-based select rfq_suppliers" ON public.rfq_suppliers FOR SELECT TO anon USING (true);

-- Allow anon to read rfqs that have supplier invitations
CREATE POLICY "Anon can view rfqs via supplier link" ON public.rfqs FOR SELECT TO anon USING (
  EXISTS (SELECT 1 FROM public.rfq_suppliers WHERE rfq_suppliers.rfq_id = rfqs.id)
);

-- Allow anon to read rfq_items for invited RFQs
CREATE POLICY "Anon can view rfq_items via supplier link" ON public.rfq_items FOR SELECT TO anon USING (
  EXISTS (SELECT 1 FROM public.rfq_suppliers WHERE rfq_suppliers.rfq_id = rfq_items.rfq_id)
);

-- Allow anon to read rfq_files for invited RFQs
CREATE POLICY "Anon can view rfq_files via supplier link" ON public.rfq_files FOR SELECT TO anon USING (
  EXISTS (SELECT 1 FROM public.rfq_suppliers WHERE rfq_suppliers.rfq_id = rfq_files.rfq_id)
);

-- Allow anon to read/update quotes via supplier link
CREATE POLICY "Anon can view quotes via supplier link" ON public.quotes FOR SELECT TO anon USING (
  EXISTS (SELECT 1 FROM public.rfq_suppliers WHERE rfq_suppliers.id = quotes.rfq_supplier_id)
);
CREATE POLICY "Anon can update quotes via supplier link" ON public.quotes FOR UPDATE TO anon USING (
  EXISTS (SELECT 1 FROM public.rfq_suppliers WHERE rfq_suppliers.id = quotes.rfq_supplier_id)
);

-- Allow anon to insert quote_items
CREATE POLICY "Anon can insert quote_items via supplier link" ON public.quote_items FOR INSERT TO anon WITH CHECK (
  EXISTS (SELECT 1 FROM public.quotes q JOIN public.rfq_suppliers rs ON rs.id = q.rfq_supplier_id WHERE q.id = quote_items.quote_id)
);

-- Allow anon to update rfqs status (for setting to 'quoting')
CREATE POLICY "Anon can update rfq status via supplier link" ON public.rfqs FOR UPDATE TO anon USING (
  EXISTS (SELECT 1 FROM public.rfq_suppliers WHERE rfq_suppliers.rfq_id = rfqs.id)
);
