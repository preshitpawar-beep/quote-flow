import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Trash2, Upload, FileText, Send, Save } from 'lucide-react';

interface LineItem {
  id: string;
  part_number: string;
  description: string;
  quantity: number;
  unit: string;
  notes: string;
}

interface FileUpload {
  file: File;
  uploading: boolean;
  uploaded: boolean;
}

export default function CreateRFQ() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [urgency, setUrgency] = useState('normal');
  const [deadline, setDeadline] = useState('');
  const [items, setItems] = useState<LineItem[]>([
    { id: crypto.randomUUID(), part_number: '', description: '', quantity: 1, unit: 'pcs', notes: '' },
  ]);
  const [files, setFiles] = useState<FileUpload[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      supabase.from('suppliers').select('*').eq('created_by', user.id).then(({ data }) => {
        if (data) setSuppliers(data);
      });
    }
  }, [user]);

  function addItem() {
    setItems([...items, { id: crypto.randomUUID(), part_number: '', description: '', quantity: 1, unit: 'pcs', notes: '' }]);
  }

  function removeItem(id: string) {
    if (items.length > 1) setItems(items.filter(i => i.id !== id));
  }

  function updateItem(id: string, field: keyof LineItem, value: string | number) {
    setItems(items.map(i => i.id === id ? { ...i, [field]: value } : i));
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files).map(file => ({ file, uploading: false, uploaded: false }));
      setFiles([...files, ...newFiles]);
    }
  }

  function toggleSupplier(id: string) {
    setSelectedSuppliers(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  }

  async function handleSubmit(asDraft: boolean) {
    if (!title.trim()) {
      toast.error('Please enter an RFQ title');
      return;
    }
    if (items.some(i => !i.description.trim())) {
      toast.error('All items need a description');
      return;
    }

    setSaving(true);
    try {
      // Create RFQ
      const { data: rfq, error: rfqError } = await supabase.from('rfqs').insert({
        created_by: user!.id,
        title,
        description,
        urgency,
        deadline: deadline || null,
        status: asDraft ? 'draft' : 'sent',
      }).select().single();

      if (rfqError) throw rfqError;

      // Insert items
      const itemInserts = items.map(i => ({
        rfq_id: rfq.id,
        part_number: i.part_number || null,
        description: i.description,
        quantity: i.quantity,
        unit: i.unit,
        notes: i.notes || null,
      }));
      await supabase.from('rfq_items').insert(itemInserts);

      // Upload files
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

      // Link suppliers
      for (const supplierId of selectedSuppliers) {
        await supabase.from('rfq_suppliers').insert({
          rfq_id: rfq.id,
          supplier_id: supplierId,
        });
        // Create pending quote for each supplier
        const { data: rfqSupplier } = await supabase.from('rfq_suppliers')
          .select('id')
          .eq('rfq_id', rfq.id)
          .eq('supplier_id', supplierId)
          .single();

        if (rfqSupplier) {
          await supabase.from('quotes').insert({
            rfq_id: rfq.id,
            rfq_supplier_id: rfqSupplier.id,
            status: 'pending',
          });
        }
      }

      toast.success(asDraft ? 'RFQ saved as draft' : 'RFQ sent to suppliers!');
      navigate(`/rfq/${rfq.id}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to create RFQ');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Create New RFQ</h1>
          <p className="text-muted-foreground text-sm mt-1">Request for Quote — fill in the details below</p>
        </div>

        {/* Basic Info */}
        <Card className="border-border/50">
          <CardHeader><CardTitle className="text-base">RFQ Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input id="title" placeholder="e.g., CNC Machined Housing Components" value={title} onChange={e => setTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="desc">Description</Label>
              <Textarea id="desc" placeholder="Additional details about this request..." value={description} onChange={e => setDescription(e.target.value)} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Urgency</Label>
                <Select value={urgency} onValueChange={setUrgency}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="deadline">Quote Deadline</Label>
                <Input id="deadline" type="date" value={deadline} onChange={e => setDeadline(e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Line Items */}
        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Parts / Line Items</CardTitle>
            <Button variant="outline" size="sm" onClick={addItem} className="gap-1">
              <Plus className="w-3 h-3" /> Add Item
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {items.map((item, idx) => (
              <div key={item.id} className="flex gap-3 items-start p-3 rounded-lg bg-muted/50 animate-fade-in">
                <span className="text-xs font-mono text-muted-foreground pt-2 w-6">{idx + 1}</span>
                <div className="flex-1 grid grid-cols-12 gap-3">
                  <div className="col-span-3">
                    <Input placeholder="Part #" value={item.part_number} onChange={e => updateItem(item.id, 'part_number', e.target.value)} className="text-sm" />
                  </div>
                  <div className="col-span-4">
                    <Input placeholder="Description *" value={item.description} onChange={e => updateItem(item.id, 'description', e.target.value)} className="text-sm" />
                  </div>
                  <div className="col-span-2">
                    <Input type="number" placeholder="Qty" value={item.quantity} onChange={e => updateItem(item.id, 'quantity', parseInt(e.target.value) || 1)} className="text-sm" min={1} />
                  </div>
                  <div className="col-span-2">
                    <Select value={item.unit} onValueChange={v => updateItem(item.id, 'unit', v)}>
                      <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pcs">pcs</SelectItem>
                        <SelectItem value="kg">kg</SelectItem>
                        <SelectItem value="m">m</SelectItem>
                        <SelectItem value="set">set</SelectItem>
                        <SelectItem value="lot">lot</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <Button variant="ghost" size="icon" onClick={() => removeItem(item.id)} className="text-muted-foreground hover:text-destructive h-9 w-9">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* File Uploads */}
        <Card className="border-border/50">
          <CardHeader><CardTitle className="text-base">Drawings & Attachments</CardTitle></CardHeader>
          <CardContent>
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-accent/50 transition-colors bg-muted/30">
              <Upload className="w-8 h-8 text-muted-foreground mb-2" />
              <span className="text-sm text-muted-foreground">Click to upload drawings (any format)</span>
              <input type="file" multiple className="hidden" onChange={handleFileSelect} />
            </label>
            {files.length > 0 && (
              <div className="mt-3 space-y-2">
                {files.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 px-3 py-2 rounded-md">
                    <FileText className="w-4 h-4" />
                    <span className="flex-1 truncate">{f.file.name}</span>
                    <span className="text-xs">{(f.file.size / 1024).toFixed(0)} KB</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setFiles(files.filter((_, j) => j !== i))}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Select Suppliers */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-base">Select Suppliers</CardTitle>
          </CardHeader>
          <CardContent>
            {suppliers.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No suppliers added yet.{' '}
                <a href="/suppliers" className="text-accent hover:underline">Add suppliers first →</a>
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {suppliers.map(s => (
                  <button
                    key={s.id}
                    onClick={() => toggleSupplier(s.id)}
                    className={`text-left p-3 rounded-lg border transition-all text-sm ${
                      selectedSuppliers.includes(s.id)
                        ? 'border-accent bg-accent/5 ring-1 ring-accent/30'
                        : 'border-border hover:border-accent/30'
                    }`}
                  >
                    <div className="font-medium">{s.company_name}</div>
                    <div className="text-xs text-muted-foreground">{s.email}</div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-3 justify-end pb-8">
          <Button variant="outline" onClick={() => handleSubmit(true)} disabled={saving} className="gap-2">
            <Save className="w-4 h-4" /> Save Draft
          </Button>
          <Button onClick={() => handleSubmit(false)} disabled={saving} className="gradient-accent text-accent-foreground gap-2">
            <Send className="w-4 h-4" /> Send to Suppliers
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
