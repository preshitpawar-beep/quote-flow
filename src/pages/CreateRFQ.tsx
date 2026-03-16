import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Trash2, Upload, FileText, Send, Save, Check } from 'lucide-react';

interface LineItem {
  id: string;
  part_number: string;
  description: string;
  quantity: number;
  unit: string;
}

export default function CreateRFQ() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [urgency, setUrgency] = useState<'normal' | 'urgent' | 'critical'>('normal');
  const [deadline, setDeadline] = useState('');
  const [items, setItems] = useState<LineItem[]>([
    { id: crypto.randomUUID(), part_number: '', description: '', quantity: 1, unit: 'pcs' },
  ]);
  const [files, setFiles] = useState<{ file: File }[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([]);
  const [senderName, setSenderName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from('suppliers').select('*').eq('created_by', user.id).then(({ data }) => {
      if (data) setSuppliers(data);
    });
    supabase.from('profiles').select('full_name').eq('user_id', user.id).single().then(({ data }) => {
      if (data?.full_name) setSenderName(data.full_name);
    });
  }, [user]);

  const addItem = () =>
    setItems([...items, { id: crypto.randomUUID(), part_number: '', description: '', quantity: 1, unit: 'pcs' }]);

  const removeItem = (id: string) => items.length > 1 && setItems(items.filter(i => i.id !== id));

  const updateItem = (id: string, field: keyof LineItem, value: string | number) =>
    setItems(items.map(i => (i.id === id ? { ...i, [field]: value } : i)));

  const toggleSupplier = (id: string) =>
    setSelectedSuppliers(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);

  async function sendEmailToSupplier(
    supplierEmail: string,
    supplierName: string,
    rfqTitle: string,
    rfqDescription: string,
    quoteLink: string
  ) {
    await supabase.functions.invoke('send-rfq-email', {
      body: {
        supplierEmail,
        supplierName,
        rfqTitle,
        rfqDescription,
        deadline: deadline || undefined,
        urgency,
        quoteLink,
        senderName: senderName || 'Stenner Ltd',
      },
    });
  }

  async function handleSubmit(asDraft: boolean) {
    if (!title.trim()) { toast.error('Enter an RFQ title'); return; }
    if (items.some(i => !i.description.trim())) { toast.error('All items need a description'); return; }

    setSaving(true);
    try {
      const { data: rfq, error } = await supabase.from('rfqs').insert([{
        created_by: user!.id,
        title,
        description,
        urgency,
        deadline: deadline || null,
        status: asDraft ? 'draft' : 'sent',
      }]).select().single();

      if (error) throw error;

      await supabase.from('rfq_items').insert(
        items.map(i => ({
          rfq_id: rfq.id,
          part_number: i.part_number || null,
          description: i.description,
          quantity: i.quantity,
          unit: i.unit,
        }))
      );

      for (const f of files) {
        const path = `${rfq.id}/${Date.now()}_${f.file.name}`;
        const { error: uploadError } = await supabase.storage.from('rfq-files').upload(path, f.file);
        if (!uploadError) {
          await supabase.from('rfq_files').insert({
            rfq_id: rfq.id,
            file_name: f.file.name,
            file_path: path,
            file_size: f.file.size,
            file_type: f.file.type,
          });
        }
      }

      let emailsSent = 0;
      for (const supplierId of selectedSuppliers) {
        const { error: rsError } = await supabase.from('rfq_suppliers').insert({
          rfq_id: rfq.id,
          supplier_id: supplierId,
        });
        if (rsError) continue;

        const { data: rs } = await supabase
          .from('rfq_suppliers')
          .select('id, access_token')
          .eq('rfq_id', rfq.id)
          .eq('supplier_id', supplierId)
          .single();

        if (rs) {
          await supabase.from('quotes').insert({
            rfq_id: rfq.id,
            rfq_supplier_id: rs.id,
            status: 'pending',
          });

          if (!asDraft) {
            const supplier = suppliers.find(s => s.id === supplierId);
            if (supplier) {
              const quoteLink = `${window.location.origin}/supplier/quote/${rs.id}?token=${rs.access_token}`;
              try {
                await sendEmailToSupplier(
                  supplier.email,
                  supplier.contact_name || supplier.company_name,
                  title,
                  description,
                  quoteLink
                );
                emailsSent++;
              } catch {
                // Email failed — supplier link still works
              }
            }
          }
        }
      }

      if (asDraft) {
        toast.success('Saved as draft');
      } else if (emailsSent > 0) {
        toast.success(`RFQ sent — ${emailsSent} supplier${emailsSent > 1 ? 's' : ''} emailed`);
      } else if (selectedSuppliers.length > 0) {
        toast.success('RFQ sent — copy links from the RFQ page to share with suppliers');
      } else {
        toast.success('RFQ created');
      }

      navigate(`/rfq/${rfq.id}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to create RFQ');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppLayout>
      <div className="max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">New RFQ</h1>
          <p className="text-muted-foreground text-sm mt-1">Request for quote</p>
        </div>

        {/* Details */}
        <section className="space-y-4 p-5 bg-card border border-border/50 rounded-xl">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Details</h2>
          <div className="space-y-3">
            <div>
              <Label htmlFor="title">Title</Label>
              <Input id="title" className="mt-1" placeholder="e.g. CNC machined housing Q3" value={title} onChange={e => setTitle(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="desc">Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Textarea id="desc" className="mt-1" rows={2} placeholder="Any extra context for suppliers..." value={description} onChange={e => setDescription(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Urgency</Label>
                <Select value={urgency} onValueChange={v => setUrgency(v as any)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Quote deadline</Label>
                <Input type="date" className="mt-1" value={deadline} onChange={e => setDeadline(e.target.value)} />
              </div>
            </div>
          </div>
        </section>

        {/* Items */}
        <section className="space-y-3 p-5 bg-card border border-border/50 rounded-xl">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Parts & Items</h2>
            <Button variant="outline" size="sm" onClick={addItem} className="gap-1 text-xs h-7">
              <Plus className="w-3 h-3" /> Add
            </Button>
          </div>
          <div className="space-y-2">
            {items.map((item, idx) => (
              <div key={item.id} className="grid grid-cols-12 gap-2 items-center bg-muted/40 rounded-lg p-3">
                <span className="col-span-1 text-xs font-mono text-muted-foreground text-center">{idx + 1}</span>
                <Input className="col-span-2 h-8 text-sm" placeholder="Part #" value={item.part_number} onChange={e => updateItem(item.id, 'part_number', e.target.value)} />
                <Input className="col-span-5 h-8 text-sm" placeholder="Description *" value={item.description} onChange={e => updateItem(item.id, 'description', e.target.value)} />
                <Input className="col-span-2 h-8 text-sm text-right" type="number" min={1} value={item.quantity} onChange={e => updateItem(item.id, 'quantity', parseInt(e.target.value) || 1)} />
                <Select value={item.unit} onValueChange={v => updateItem(item.id, 'unit', v)}>
                  <SelectTrigger className="col-span-1 h-8 text-sm px-2"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['pcs','kg','m','set','lot'].map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
                <button onClick={() => removeItem(item.id)} className="col-span-1 flex justify-center text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Files */}
        <section className="p-5 bg-card border border-border/50 rounded-xl space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Drawings & Files</h2>
          <label className="flex items-center justify-center gap-2 w-full h-24 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-accent/40 transition-colors text-sm text-muted-foreground">
            <Upload className="w-4 h-4" /> Click to attach drawings
            <input type="file" multiple className="hidden" onChange={e => {
              if (e.target.files) setFiles([...files, ...Array.from(e.target.files).map(f => ({ file: f }))]);
            }} />
          </label>
          {files.map((f, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
              <FileText className="w-3.5 h-3.5 shrink-0" />
              <span className="flex-1 truncate">{f.file.name}</span>
              <button onClick={() => setFiles(files.filter((_, j) => j !== i))} className="hover:text-destructive">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </section>

        {/* Suppliers */}
        <section className="p-5 bg-card border border-border/50 rounded-xl space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Suppliers to invite</h2>
          {suppliers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No suppliers yet. <a href="/suppliers" className="text-accent hover:underline">Add suppliers →</a>
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {suppliers.map(s => {
                const selected = selectedSuppliers.includes(s.id);
                return (
                  <button key={s.id} onClick={() => toggleSupplier(s.id)}
                    className={`flex items-center justify-between p-3 rounded-lg border text-left transition-all text-sm ${
                      selected ? 'border-accent bg-accent/5 ring-1 ring-accent/20' : 'border-border hover:border-accent/30'
                    }`}
                  >
                    <div>
                      <div className="font-medium">{s.company_name}</div>
                      <div className="text-xs text-muted-foreground">{s.email}</div>
                    </div>
                    {selected && <Check className="w-4 h-4 text-accent shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}
          {selectedSuppliers.length > 0 && (
            <div className="pt-2">
              <Label>Your name (for the email)</Label>
              <Input className="mt-1" placeholder="e.g. James Stenner" value={senderName} onChange={e => setSenderName(e.target.value)} />
            </div>
          )}
        </section>

        {/* Actions */}
        <div className="flex gap-3 justify-end pb-8">
          <Button variant="outline" onClick={() => handleSubmit(true)} disabled={saving} className="gap-2">
            <Save className="w-4 h-4" /> Save draft
          </Button>
          <Button onClick={() => handleSubmit(false)} disabled={saving} className="gradient-accent text-accent-foreground gap-2 px-6">
            <Send className="w-4 h-4" />
            {saving ? 'Sending…' : selectedSuppliers.length > 0 ? `Send to ${selectedSuppliers.length} supplier${selectedSuppliers.length > 1 ? 's' : ''}` : 'Send RFQ'}
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
