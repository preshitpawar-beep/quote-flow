import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Factory, FileText, Download, Send, Clock, CheckCircle } from 'lucide-react';

export default function SupplierQuotePage() {
  const { rfqSupplierId } = useParams<{ rfqSupplierId: string }>();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [rfq, setRfq] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [files, setFiles] = useState<any[]>([]);
  const [rfqSupplier, setRfqSupplier] = useState<any>(null);
  const [quote, setQuote] = useState<any>(null);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [leadTimes, setLeadTimes] = useState<Record<string, string>>({});
  const [totalNotes, setTotalNotes] = useState('');
  const [overallLeadTime, setOverallLeadTime] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    loadData();
  }, [rfqSupplierId, token]);

  async function loadData() {
    // Verify access token
    const { data: rs } = await supabase
      .from('rfq_suppliers')
      .select('*, suppliers(*)')
      .eq('id', rfqSupplierId)
      .eq('access_token', token)
      .single();

    if (!rs) {
      setLoading(false);
      return;
    }

    setRfqSupplier(rs);

    const [rfqRes, itemsRes, filesRes, quoteRes] = await Promise.all([
      supabase.from('rfqs').select('*').eq('id', rs.rfq_id).single(),
      supabase.from('rfq_items').select('*').eq('rfq_id', rs.rfq_id),
      supabase.from('rfq_files').select('*').eq('rfq_id', rs.rfq_id),
      supabase.from('quotes').select('*').eq('rfq_supplier_id', rs.id).single(),
    ]);

    setRfq(rfqRes.data);
    setItems(itemsRes.data || []);
    setFiles(filesRes.data || []);
    setQuote(quoteRes.data);

    if (quoteRes.data?.status === 'submitted') {
      setSubmitted(true);
    }

    setLoading(false);
  }

  async function downloadFile(filePath: string, fileName: string) {
    const { data } = await supabase.storage.from('rfq-files').download(filePath);
    if (data) {
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  async function submitQuote() {
    const hasAnyPrice = Object.values(prices).some(v => v && parseFloat(v) > 0);
    if (!hasAnyPrice) {
      toast.error('Please enter at least one item price');
      return;
    }

    setSubmitting(true);
    try {
      const totalPrice = Object.values(prices).reduce((sum, v) => {
        const item = items.find(i => prices[i.id] === v);
        const qty = item?.quantity || 1;
        return sum + (parseFloat(v) || 0) * qty;
      }, 0);

      // Update quote
      await supabase.from('quotes').update({
        status: 'submitted',
        total_price: totalPrice,
        lead_time_days: parseInt(overallLeadTime) || null,
        notes: totalNotes || null,
        submitted_at: new Date().toISOString(),
      }).eq('id', quote.id);

      // Insert quote items
      const quoteItemInserts = items
        .filter(item => prices[item.id] && parseFloat(prices[item.id]) > 0)
        .map(item => ({
          quote_id: quote.id,
          rfq_item_id: item.id,
          unit_price: parseFloat(prices[item.id]),
          lead_time_days: parseInt(leadTimes[item.id]) || null,
        }));

      if (quoteItemInserts.length > 0) {
        await supabase.from('quote_items').insert(quoteItemInserts);
      }

      // Update RFQ status to quoting
      await supabase.from('rfqs').update({ status: 'quoting' }).eq('id', rfq.id);

      setSubmitted(true);
      toast.success('Quote submitted successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit quote');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!rfqSupplier || !rfq) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <h2 className="text-xl font-bold mb-2">Invalid or Expired Link</h2>
            <p className="text-muted-foreground text-sm">This quote request link is no longer valid.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="gradient-navy">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg gradient-accent flex items-center justify-center">
              <Factory className="w-6 h-6 text-accent-foreground" />
            </div>
            <span className="text-primary-foreground font-bold text-lg">QuoteForge</span>
          </div>
          <h1 className="text-2xl font-bold text-primary-foreground">{rfq.title}</h1>
          <div className="flex items-center gap-4 mt-2">
            <Badge variant={rfq.urgency === 'critical' ? 'urgent' : rfq.urgency === 'urgent' ? 'warning' : 'secondary'}>
              {rfq.urgency}
            </Badge>
            {rfq.deadline && (
              <span className="text-sm text-primary-foreground/70 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Deadline: {new Date(rfq.deadline).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {submitted ? (
          <Card className="border-success/30">
            <CardContent className="flex flex-col items-center py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mb-4">
                <CheckCircle className="w-8 h-8 text-success" />
              </div>
              <h2 className="text-xl font-bold mb-2">Quote Submitted!</h2>
              <p className="text-muted-foreground text-sm">Thank you. The buyer has been notified of your response.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {rfq.description && (
              <Card className="border-border/50">
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">{rfq.description}</p>
                </CardContent>
              </Card>
            )}

            {/* Files */}
            {files.length > 0 && (
              <Card className="border-border/50">
                <CardHeader><CardTitle className="text-base">Drawings & Files</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {files.map(f => (
                    <div key={f.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-muted-foreground" />
                        <span className="text-sm">{f.file_name}</span>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => downloadFile(f.file_path, f.file_name)} className="gap-1">
                        <Download className="w-4 h-4" /> Download
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Pricing Table */}
            <Card className="border-border/50">
              <CardHeader><CardTitle className="text-base">Enter Your Pricing</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Part #</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Unit Price ($)</TableHead>
                      <TableHead className="text-right">Lead Time (days)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item, idx) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono text-xs text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell className="font-mono text-sm">{item.part_number || '—'}</TableCell>
                        <TableCell>{item.description}</TableCell>
                        <TableCell className="text-right font-semibold">{item.quantity} {item.unit}</TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            className="w-24 ml-auto text-right text-sm"
                            value={prices[item.id] || ''}
                            onChange={e => setPrices({ ...prices, [item.id]: e.target.value })}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            min="0"
                            placeholder="—"
                            className="w-20 ml-auto text-right text-sm"
                            value={leadTimes[item.id] || ''}
                            onChange={e => setLeadTimes({ ...leadTimes, [item.id]: e.target.value })}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Overall */}
            <Card className="border-border/50">
              <CardContent className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Overall Lead Time (days)</Label>
                    <Input
                      type="number"
                      min="0"
                      value={overallLeadTime}
                      onChange={e => setOverallLeadTime(e.target.value)}
                      placeholder="Total lead time"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Estimated Total</Label>
                    <div className="h-9 px-3 py-2 rounded-md bg-muted text-sm font-semibold flex items-center">
                      ${items.reduce((sum, item) => {
                        const price = parseFloat(prices[item.id]) || 0;
                        return sum + price * item.quantity;
                      }, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Notes / Terms</Label>
                  <Textarea
                    rows={3}
                    value={totalNotes}
                    onChange={e => setTotalNotes(e.target.value)}
                    placeholder="Any additional notes, terms, or conditions..."
                  />
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end pb-8">
              <Button onClick={submitQuote} disabled={submitting} className="gradient-accent text-accent-foreground gap-2 px-8">
                <Send className="w-4 h-4" /> {submitting ? 'Submitting...' : 'Submit Quote'}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
