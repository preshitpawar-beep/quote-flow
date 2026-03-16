import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/AppLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { FileText, Download, Copy, CheckCircle, Clock, Mail } from 'lucide-react';

const STATUS_VARIANT: Record<string, any> = {
  draft: 'secondary', sent: 'accent', quoting: 'warning', closed: 'default', awarded: 'success',
};
const QUOTE_VARIANT: Record<string, any> = {
  pending: 'secondary', submitted: 'success', accepted: 'success', rejected: 'destructive',
};

function getFunctionErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default function RFQDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [rfq, setRfq] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [files, setFiles] = useState<any[]>([]);
  const [rfqSuppliers, setRfqSuppliers] = useState<any[]>([]);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState<string | null>(null);

  useEffect(() => {
    if (id && user) loadAll();
  }, [id, user]);

  async function loadAll() {
    const [rfqRes, itemsRes, filesRes, suppRes, quotesRes] = await Promise.all([
      supabase.from('rfqs').select('*').eq('id', id).single(),
      supabase.from('rfq_items').select('*').eq('rfq_id', id),
      supabase.from('rfq_files').select('*').eq('rfq_id', id),
      supabase.from('rfq_suppliers').select('*, suppliers(*)').eq('rfq_id', id),
      supabase.from('quotes').select('*').eq('rfq_id', id),
    ]);
    setRfq(rfqRes.data);
    setItems(itemsRes.data || []);
    setFiles(filesRes.data || []);
    setRfqSuppliers(suppRes.data || []);
    setQuotes(quotesRes.data || []);
    setLoading(false);
  }

  function quoteLink(rfqSupplierId: string, accessToken: string) {
    return `${window.location.origin}/supplier/quote/${rfqSupplierId}?token=${accessToken}`;
  }

  async function copyLink(rfqSupplierId: string, accessToken: string) {
    await navigator.clipboard.writeText(quoteLink(rfqSupplierId, accessToken));
    toast.success('Link copied');
  }

  async function resendEmail(rs: any) {
    setSending(rs.id);
    try {
      const { data: profile } = await supabase.from('profiles').select('full_name').eq('user_id', user!.id).single();
      const { data, error } = await supabase.functions.invoke('send-rfq-email', {
        body: {
          supplierEmail: rs.suppliers.email,
          supplierName: rs.suppliers.contact_name || rs.suppliers.company_name,
          rfqTitle: rfq.title,
          rfqDescription: rfq.description,
          deadline: rfq.deadline,
          urgency: rfq.urgency,
          quoteLink: quoteLink(rs.id, rs.access_token),
          senderName: profile?.full_name || 'Stenner Ltd',
        },
      });

      if (error) {
        throw error;
      }

      if (data && typeof data === 'object' && 'success' in data && !data.success) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Failed to send email');
      }

      toast.success(`Email sent to ${rs.suppliers.company_name}`);
    } catch (error: unknown) {
      toast.error(getFunctionErrorMessage(error, 'Failed to send email'));
    } finally {
      setSending(null);
    }
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

  if (loading) return (
    <AppLayout>
      <div className="flex justify-center py-16">
        <div className="w-7 h-7 border-4 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    </AppLayout>
  );

  if (!rfq) return <AppLayout><p className="text-muted-foreground">RFQ not found.</p></AppLayout>;

  const submittedQuotes = quotes.filter(q => q.status === 'submitted');

  return (
    <AppLayout>
      <div className="max-w-4xl space-y-6">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h1 className="text-2xl font-bold tracking-tight">{rfq.title}</h1>
            <Badge variant={rfq.urgency === 'critical' ? 'urgent' : rfq.urgency === 'urgent' ? 'warning' : 'secondary'}>
              {rfq.urgency}
            </Badge>
            <Badge variant={STATUS_VARIANT[rfq.status]}>{rfq.status}</Badge>
          </div>
          {rfq.description && <p className="text-sm text-muted-foreground">{rfq.description}</p>}
          {rfq.deadline && (
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <Clock className="w-3 h-3" /> Deadline {new Date(rfq.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          )}
        </div>

        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Items ({items.length})</h2>
          <div className="border border-border/50 rounded-xl overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>Part number</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead>Unit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item, idx) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">{idx + 1}</TableCell>
                    <TableCell className="font-mono text-sm">{item.part_number || '—'}</TableCell>
                    <TableCell>{item.description}</TableCell>
                    <TableCell className="text-right font-semibold">{item.quantity}</TableCell>
                    <TableCell className="text-muted-foreground">{item.unit}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>

        {files.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Files ({files.length})</h2>
            <div className="space-y-2">
              {files.map(f => (
                <div key={f.id} className="flex items-center justify-between p-3 bg-card border border-border/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{f.file_name}</p>
                      <p className="text-xs text-muted-foreground">{(f.file_size / 1024).toFixed(0)} KB</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => downloadFile(f.file_path, f.file_name)} className="gap-1 text-xs">
                    <Download className="w-3.5 h-3.5" /> Download
                  </Button>
                </div>
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Suppliers ({rfqSuppliers.length})
          </h2>
          {rfqSuppliers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No suppliers invited.</p>
          ) : (
            <div className="divide-y divide-border border border-border/50 rounded-xl overflow-hidden">
              {rfqSuppliers.map((rs: any) => {
                const q = quotes.find(q => q.rfq_supplier_id === rs.id);
                const isQuoted = q?.status === 'submitted';
                return (
                  <div key={rs.id} className="flex items-center justify-between px-4 py-3 bg-card">
                    <div>
                      <p className="text-sm font-medium">{rs.suppliers?.company_name}</p>
                      <p className="text-xs text-muted-foreground">{rs.suppliers?.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={QUOTE_VARIANT[q?.status || 'pending']}>
                        {isQuoted ? (
                          <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Quoted</span>
                        ) : q?.status || 'Pending'}
                      </Badge>
                      <Button variant="ghost" size="sm" onClick={() => copyLink(rs.id, rs.access_token)} className="gap-1 text-xs h-7">
                        <Copy className="w-3 h-3" /> Copy link
                      </Button>
                      {!isQuoted && (
                        <Button variant="outline" size="sm" onClick={() => resendEmail(rs)} disabled={sending === rs.id} className="gap-1 text-xs h-7">
                          <Mail className="w-3 h-3" />
                          {sending === rs.id ? 'Sending…' : 'Email'}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {submittedQuotes.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Quote comparison ({submittedQuotes.length})
            </h2>
            <div className="border border-border/50 rounded-xl overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Supplier</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Lead time</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {submittedQuotes
                    .sort((a, b) => (a.total_price || 0) - (b.total_price || 0))
                    .map((q: any, idx: number) => {
                      const rs = rfqSuppliers.find(s => s.id === q.rfq_supplier_id);
                      return (
                        <TableRow key={q.id} className={idx === 0 ? 'bg-success/5' : ''}>
                          <TableCell className="font-medium">
                            {idx === 0 && <span className="text-success text-xs mr-1">★</span>}
                            {rs?.suppliers?.company_name || '—'}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {q.total_price ? `£${Number(q.total_price).toLocaleString()}` : '—'}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {q.lead_time_days ? `${q.lead_time_days}d` : '—'}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                            {q.notes || '—'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </div>
          </section>
        )}
      </div>
    </AppLayout>
  );
}
