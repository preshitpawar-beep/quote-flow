import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Users, Mail, Phone, Trash2, Building2 } from 'lucide-react';

export default function SuppliersPage() {
  const { user } = useAuth();
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ company_name: '', contact_name: '', email: '', phone: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) loadSuppliers();
  }, [user]);

  async function loadSuppliers() {
    const { data } = await supabase.from('suppliers').select('*').eq('created_by', user!.id).order('created_at', { ascending: false });
    setSuppliers(data || []);
    setLoading(false);
  }

  async function addSupplier() {
    if (!form.company_name || !form.email) {
      toast.error('Company name and email are required');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('suppliers').insert({
      created_by: user!.id,
      company_name: form.company_name,
      contact_name: form.contact_name || null,
      email: form.email,
      phone: form.phone || null,
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Supplier added!');
      setForm({ company_name: '', contact_name: '', email: '', phone: '' });
      setDialogOpen(false);
      loadSuppliers();
    }
    setSaving(false);
  }

  async function deleteSupplier(id: string) {
    const { error } = await supabase.from('suppliers').delete().eq('id', id);
    if (error) toast.error(error.message);
    else {
      toast.success('Supplier removed');
      loadSuppliers();
    }
  }

  return (
    <AppLayout>
      <div className="space-y-6 max-w-3xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Suppliers</h1>
            <p className="text-muted-foreground text-sm mt-1">Manage your supplier contacts</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-accent text-accent-foreground gap-2">
                <Plus className="w-4 h-4" /> Add Supplier
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Supplier</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Company Name *</Label>
                  <Input value={form.company_name} onChange={e => setForm({ ...form, company_name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Contact Name</Label>
                  <Input value={form.contact_name} onChange={e => setForm({ ...form, contact_name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Email *</Label>
                  <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
                </div>
                <Button onClick={addSupplier} disabled={saving} className="w-full gradient-accent text-accent-foreground">
                  {saving ? 'Adding...' : 'Add Supplier'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : suppliers.length === 0 ? (
          <Card className="border-dashed border-2 border-border">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mb-4">
                <Users className="w-8 h-8 text-accent" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No suppliers yet</h3>
              <p className="text-muted-foreground text-sm mb-6">Add your first supplier to start sending quote requests.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {suppliers.map(s => (
              <Card key={s.id} className="border-border/50">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm">{s.company_name}</h3>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                        {s.contact_name && <span>{s.contact_name}</span>}
                        <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{s.email}</span>
                        {s.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{s.phone}</span>}
                      </div>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => deleteSupplier(s.id)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
