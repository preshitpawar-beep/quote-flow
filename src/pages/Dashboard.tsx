import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  FilePlus,
  FileText,
  Clock,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';

interface RFQSummary {
  id: string;
  title: string;
  status: string;
  urgency: string;
  deadline: string | null;
  created_at: string;
  item_count: number;
  quote_count: number;
}

const statusColors: Record<string, 'default' | 'secondary' | 'accent' | 'success' | 'warning'> = {
  draft: 'secondary',
  sent: 'accent',
  quoting: 'warning',
  closed: 'default',
  awarded: 'success',
};

const urgencyIcons: Record<string, typeof Clock> = {
  normal: Clock,
  urgent: AlertTriangle,
  critical: AlertTriangle,
};

export default function Dashboard() {
  const { user } = useAuth();
  const [rfqs, setRfqs] = useState<RFQSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, active: 0, quoted: 0, awarded: 0 });

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  async function loadData() {
    const { data: rfqData } = await supabase
      .from('rfqs')
      .select('*')
      .eq('created_by', user!.id)
      .order('created_at', { ascending: false });

    if (rfqData) {
      const summaries: RFQSummary[] = [];
      for (const rfq of rfqData) {
        const { count: itemCount } = await supabase.from('rfq_items').select('*', { count: 'exact', head: true }).eq('rfq_id', rfq.id);
        const { count: quoteCount } = await supabase.from('quotes').select('*', { count: 'exact', head: true }).eq('rfq_id', rfq.id).eq('status', 'submitted');
        summaries.push({
          ...rfq,
          item_count: itemCount || 0,
          quote_count: quoteCount || 0,
        });
      }
      setRfqs(summaries);
      setStats({
        total: rfqData.length,
        active: rfqData.filter(r => ['sent', 'quoting'].includes(r.status)).length,
        quoted: rfqData.filter(r => r.status === 'quoting').length,
        awarded: rfqData.filter(r => r.status === 'awarded').length,
      });
    }
    setLoading(false);
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground text-sm mt-1">Manage your quote requests</p>
          </div>
          <Link to="/rfq/new">
            <Button className="gradient-accent text-accent-foreground gap-2">
              <FilePlus className="w-4 h-4" /> New RFQ
            </Button>
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total RFQs', value: stats.total, icon: FileText },
            { label: 'Active', value: stats.active, icon: Clock },
            { label: 'Quotes In', value: stats.quoted, icon: CheckCircle },
            { label: 'Awarded', value: stats.awarded, icon: CheckCircle },
          ].map(stat => (
            <Card key={stat.label} className="border-border/50">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                  <stat.icon className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* RFQ List */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : rfqs.length === 0 ? (
          <Card className="border-dashed border-2 border-border">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mb-4">
                <FileText className="w-8 h-8 text-accent" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No RFQs yet</h3>
              <p className="text-muted-foreground text-sm mb-6 max-w-sm">
                Create your first Request for Quote to start collecting pricing from suppliers.
              </p>
              <Link to="/rfq/new">
                <Button className="gradient-accent text-accent-foreground gap-2">
                  <FilePlus className="w-4 h-4" /> Create First RFQ
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {rfqs.map(rfq => {
              const UrgencyIcon = urgencyIcons[rfq.urgency] || Clock;
              return (
                <Link key={rfq.id} to={`/rfq/${rfq.id}`}>
                  <Card className="border-border/50 hover:border-accent/30 hover:shadow-md transition-all cursor-pointer">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-10 h-10 rounded-lg flex items-center justify-center",
                          rfq.urgency === 'critical' ? 'bg-urgent/10' : rfq.urgency === 'urgent' ? 'bg-warning/10' : 'bg-muted'
                        )}>
                          <UrgencyIcon className={cn(
                            "w-5 h-5",
                            rfq.urgency === 'critical' ? 'text-urgent' : rfq.urgency === 'urgent' ? 'text-warning' : 'text-muted-foreground'
                          )} />
                        </div>
                        <div>
                          <h3 className="font-semibold text-sm">{rfq.title}</h3>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {rfq.item_count} items · {rfq.quote_count} quotes received
                            {rfq.deadline && ` · Due ${new Date(rfq.deadline).toLocaleDateString()}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant={statusColors[rfq.status] || 'default'}>
                          {rfq.status}
                        </Badge>
                        <ArrowRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}
