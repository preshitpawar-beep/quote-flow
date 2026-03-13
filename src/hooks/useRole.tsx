import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

export function useRole() {
  const { user } = useAuth();
  const [role, setRole] = useState<'buyer' | 'supplier' | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setRole(null);
      setLoading(false);
      return;
    }

    supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()
      .then(({ data }) => {
        setRole((data?.role as 'buyer' | 'supplier') || null);
        setLoading(false);
      });
  }, [user]);

  return { role, loading };
}
