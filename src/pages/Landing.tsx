import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Factory, ArrowRight, FileText, Users, BarChart3, Bell } from 'lucide-react';

export default function LandingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="border-b border-border/50 bg-card/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg gradient-accent flex items-center justify-center">
              <Factory className="w-5 h-5 text-accent-foreground" />
            </div>
            <span className="font-bold text-lg tracking-tight">QuoteForge</span>
          </div>
          <Button
            onClick={() => navigate(user ? '/dashboard' : '/auth')}
            className="gradient-accent text-accent-foreground gap-2"
          >
            {user ? 'Dashboard' : 'Get Started'} <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 gradient-navy opacity-95" />
        <div className="relative max-w-6xl mx-auto px-6 py-24 lg:py-32 text-center">
          <h1 className="text-4xl lg:text-6xl font-extrabold tracking-tight text-primary-foreground leading-tight animate-fade-in">
            Manufacturing Quotes,
            <br />
            <span className="text-accent">Simplified.</span>
          </h1>
          <p className="mt-6 text-lg text-primary-foreground/70 max-w-2xl mx-auto animate-fade-in">
            Upload drawings, set quantities, invite suppliers — get competitive quotes with automated tracking and side-by-side comparison.
          </p>
          <div className="mt-10 flex justify-center gap-4 animate-fade-in">
            <Button
              size="lg"
              onClick={() => navigate(user ? '/dashboard' : '/auth')}
              className="gradient-accent text-accent-foreground gap-2 px-8 text-base"
            >
              Start Quoting <ArrowRight className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold tracking-tight">How It Works</h2>
          <p className="text-muted-foreground mt-2">From upload to awarded — in three simple steps.</p>
        </div>
        <div className="grid md:grid-cols-4 gap-8">
          {[
            { icon: FileText, title: 'Create RFQ', desc: 'Upload drawings, add part numbers and quantities in seconds.' },
            { icon: Users, title: 'Invite Suppliers', desc: 'Send unique links to your supplier list — no accounts needed for them.' },
            { icon: BarChart3, title: 'Compare Quotes', desc: 'Side-by-side comparison of pricing, lead times, and terms.' },
            { icon: Bell, title: 'Auto Reminders', desc: 'Automated deadline reminders keep your quote process on track.' },
          ].map((f, i) => (
            <div key={i} className="text-center p-6 rounded-xl border border-border/50 bg-card hover:shadow-lg hover:border-accent/20 transition-all">
              <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center mx-auto mb-4">
                <f.icon className="w-6 h-6 text-accent" />
              </div>
              <h3 className="font-semibold mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8">
        <div className="max-w-6xl mx-auto px-6 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} QuoteForge. Built for manufacturers.
        </div>
      </footer>
    </div>
  );
}
