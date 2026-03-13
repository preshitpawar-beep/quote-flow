import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, CheckCircle, FileText, ArrowRight, Truck } from 'lucide-react';

export default function SupplierDashboard() {
  const { user } = useAuth();
  const [invitations, setInvitations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadInvitations();
  }, [user]);

  async function loadInvitations() {
    // Get rfq_suppliers linked to this user
    const { data: rsList } = await supabase
      .from('rfq_suppliers')
      .select('*, suppliers(*), rfqs(*)')
      .eq('supplier_user_id', user!.id);

    if (!rsList || rsList.length === 0) {
      // Also try matching by supplier email
      const { data: profile } = await supabase
        .from('profiles')
        .select('email')
        .eq('user_id', user!.id)
        .single();

      if (profile?.email) {
        const { data: supplierRecords } = await supabase
          .from('suppliers')
          .select('id')
          .eq('email', profile.email);

        if (supplierRecords && supplierRecords.length > 0) {
          const supplierIds = supplierRecords.map(s => s.id);
          const { data: rsLinked } = await supabase
            .from('rfq_suppliers')
            .select('*, suppliers(*), rfqs(*)')
            .in('supplier_id', supplierIds);

          // Link supplier_user_id for future lookups
          if (rsLinked) {
            for (const rs of rsLinked) {
              if (!rs.supplier_user_id) {
                await supabase.from('rfq_suppliers')
                  .update({ supplier_user_id: user!.id })
                  .eq('id', rs.id);
              }
            }
            setInvitations(rsLinked);
          }
        }
      }
    } else {
      setInvitations(rsList);
    }

    // Also load quotes to check status
    setLoading(false);
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Quote Requests</h1>
          <p className="text-muted-foreground text-sm mt-1">View and respond to RFQs from buyers</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : invitations.length === 0 ? (
          <Card className="border-dashed border-2 border-border">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mb-4">
                <Truck className="w-8 h-8 text-accent" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No quote requests yet</h3>
              <p className="text-muted-foreground text-sm max-w-sm">
                When a buyer sends you an RFQ, it will appear here. You can also use the unique quote link sent to your email.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {invitations.map((inv: any) => {
              const rfq = inv.rfqs;
              if (!rfq) return null;
              return (
                <a
                  key={inv.id}
                  href={`/supplier/quote/${inv.id}?token=${inv.access_token}`}
                >
                  <Card className="border-border/50 hover:border-accent/30 hover:shadow-md transition-all cursor-pointer">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                          <FileText className="w-5 h-5 text-muted-foreground" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-sm">{rfq.title}</h3>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {rfq.urgency !== 'normal' && <span className="text-warning font-medium">{rfq.urgency} · </span>}
                            {rfq.deadline ? `Due ${new Date(rfq.deadline).toLocaleDateString()}` : 'No deadline'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant={rfq.status === 'quoting' ? 'warning' : rfq.status === 'awarded' ? 'success' : 'accent'}>
                          {rfq.status}
                        </Badge>
                        <ArrowRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </CardContent>
                  </Card>
                </a>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
