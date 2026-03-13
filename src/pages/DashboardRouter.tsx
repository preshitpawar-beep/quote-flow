import { useRole } from '@/hooks/useRole';
import BuyerDashboard from './Dashboard';
import SupplierDashboard from './SupplierDashboard';

export default function DashboardRouter() {
  const { role, loading } = useRole();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (role === 'supplier') {
    return <SupplierDashboard />;
  }

  return <BuyerDashboard />;
}
