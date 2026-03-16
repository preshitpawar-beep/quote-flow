import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/AppLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FilePlus, ArrowRight, Clock, AlertTriangle, CheckCircle, FileText } from 'lucide-react';

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft', sent: 'Sent', quoting: 'Quotes in', closed: 'Closed', awarded: 'Awarded',
};
const STATUS_VARIANT: Record<string, any> = {
  draft: 'secondary', sent: 'accent', quoting: 'warning', closed: 'default', awarded: 'success',
};

export default function Dashboard() {
  const { user } = useAuth();
  const [rfqs, setRfqs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('rfqs')
      .select('*, rfq_items(count), quotes(count)')
      .eq('created_by', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setRfqs(data || []);
        setLoading(false);
      });
  }, [user]);

  const stats = [
    { label: 'Total RFQs', value: rfqs.length },
    { label: 'Awaiting quotes', value: rfqs.filter(r => r.status === 'sent').length },
    { label: 'Quotes received', value: rfqs.filter(r => r.status === 'quoting').length },
    { label: 'Awarded', value: rfqs.filter(r => r.status === 'awarded').length },
  ];

  return (
    <AppLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground text-sm mt-1">Your active quote requests</p>
          </div>
          <Link to="/rfq/new">
            <Button className="gradient-accent text-accent-foreground gap-2">
              <FilePlus className="w-4 h-4" /> New RFQ
            </Button>
          </Link>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {stats.map(s => (
            <div key={s.label} className="bg-card border border-border/50 rounded-lg p-4">
              <p className="text-2xl font-bold">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* RFQ list */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-7 h-7 border-4 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : rfqs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center border-2 border-dashed border-border rounded-xl">
            <FileText className="w-10 h-10 text-muted-foreground mb-3" />
            <p className="font-semibold mb-1">No RFQs yet</p>
            <p className="text-sm text-muted-foreground mb-5 max-w-xs">
              Create a request for quote and send it to your suppliers in minutes.
            </p>
            <Link to="/rfq/new">
              <Button className="gradient-accent text-accent-foreground gap-2">
                <FilePlus className="w-4 h-4" /> Create first RFQ
              </Button>
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-border border border-border/50 rounded-xl overflow-hidden">
            {rfqs.map(rfq => (
              <Link key={rfq.id} to={`/rfq/${rfq.id}`} className="flex items-center justify-between px-5 py-4 bg-card hover:bg-muted/40 transition-colors">
                <div className="flex items-center gap-4 min-w-0">
                  <div className={`shrink-0 w-2 h-2 rounded-full ${
                    rfq.urgency === 'critical' ? 'bg-destructive' : rfq.urgency === 'urgent' ? 'bg-warning' : 'bg-muted-foreground/30'
                  }`} />
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{rfq.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {rfq.rfq_items?.[0]?.count ?? 0} items
                      {rfq.deadline && ` · due ${new Date(rfq.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <Badge variant={STATUS_VARIANT[rfq.status]}>{STATUS_LABEL[rfq.status]}</Badge>
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
