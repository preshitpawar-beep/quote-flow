import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import {
  FileText, Download, Clock, Users, Copy, CheckCircle, AlertTriangle,
} from 'lucide-react';

export default function RFQDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [rfq, setRfq] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [files, setFiles] = useState<any[]>([]);
  const [rfqSuppliers, setRfqSuppliers] = useState<any[]>([]);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [quoteItems, setQuoteItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

    // Load quote items
    if (quotesRes.data && quotesRes.data.length > 0) {
      const qIds = quotesRes.data.map((q: any) => q.id);
      const { data: qItems } = await supabase.from('quote_items').select('*').in('quote_id', qIds);
      setQuoteItems(qItems || []);
    }

    setLoading(false);
  }

  function getSupplierLink(rfqSupplierId: string, accessToken: string) {
    return `${window.location.origin}/supplier/quote/${rfqSupplierId}?token=${accessToken}`;
  }

  async function copyLink(rfqSupplierId: string, accessToken: string) {
    const link = getSupplierLink(rfqSupplierId, accessToken);
    await navigator.clipboard.writeText(link);
    toast.success('Supplier quote link copied!');
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

  if (loading) {
    return (
      <AppLayout>
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  if (!rfq) {
    return (
      <AppLayout>
        <p className="text-muted-foreground">RFQ not found.</p>
      </AppLayout>
    );
  }

  const submittedQuotes = quotes.filter((q: any) => q.status === 'submitted');

  return (
    <AppLayout>
      <div className="space-y-6 max-w-5xl">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold tracking-tight">{rfq.title}</h1>
              <Badge variant={rfq.urgency === 'critical' ? 'urgent' : rfq.urgency === 'urgent' ? 'warning' : 'secondary'}>
                {rfq.urgency}
              </Badge>
              <Badge variant={rfq.status === 'awarded' ? 'success' : rfq.status === 'sent' ? 'accent' : 'secondary'}>
                {rfq.status}
              </Badge>
            </div>
            {rfq.description && <p className="text-sm text-muted-foreground">{rfq.description}</p>}
            {rfq.deadline && (
              <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Deadline: {new Date(rfq.deadline).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>

        {/* Items */}
        <Card className="border-border/50">
          <CardHeader><CardTitle className="text-base">Parts / Items ({items.length})</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Part Number</TableHead>
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
          </CardContent>
        </Card>

        {/* Files */}
        {files.length > 0 && (
          <Card className="border-border/50">
            <CardHeader><CardTitle className="text-base">Drawings & Files ({files.length})</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {files.map(f => (
                  <div key={f.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">{f.file_name}</p>
                        <p className="text-xs text-muted-foreground">{f.file_type} · {(f.file_size / 1024).toFixed(0)} KB</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => downloadFile(f.file_path, f.file_name)} className="gap-1">
                      <Download className="w-4 h-4" /> Download
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Suppliers & Links */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4" /> Invited Suppliers ({rfqSuppliers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {rfqSuppliers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No suppliers invited yet.</p>
            ) : (
              <div className="space-y-2">
                {rfqSuppliers.map((rs: any) => {
                  const quote = quotes.find((q: any) => q.rfq_supplier_id === rs.id);
                  return (
                    <div key={rs.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div>
                        <p className="text-sm font-medium">{rs.suppliers?.company_name}</p>
                        <p className="text-xs text-muted-foreground">{rs.suppliers?.email}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {quote?.status === 'submitted' ? (
                          <Badge variant="success" className="gap-1"><CheckCircle className="w-3 h-3" /> Quoted</Badge>
                        ) : (
                          <Badge variant="secondary">Pending</Badge>
                        )}
                        <Button variant="outline" size="sm" onClick={() => copyLink(rs.id, rs.access_token)} className="gap-1">
                          <Copy className="w-3 h-3" /> Copy Link
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quote Comparison */}
        {submittedQuotes.length > 0 && (
          <Card className="border-border/50 border-accent/20">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-accent" /> Quote Comparison
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Supplier</TableHead>
                    <TableHead className="text-right">Total Price</TableHead>
                    <TableHead className="text-right">Lead Time</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {submittedQuotes.map((q: any) => {
                    const rs = rfqSuppliers.find((s: any) => s.id === q.rfq_supplier_id);
                    return (
                      <TableRow key={q.id}>
                        <TableCell className="font-medium">{rs?.suppliers?.company_name || '—'}</TableCell>
                        <TableCell className="text-right font-semibold">
                          {q.total_price ? `$${Number(q.total_price).toLocaleString()}` : '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          {q.lead_time_days ? `${q.lead_time_days} days` : '—'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{q.notes || '—'}</TableCell>
                        <TableCell>
                          <Badge variant={q.status === 'accepted' ? 'success' : 'secondary'}>{q.status}</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
