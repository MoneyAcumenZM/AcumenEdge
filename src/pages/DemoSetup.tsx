import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, User, Globe, Wallet } from 'lucide-react';
import luseLogo from '@/assets/luse-logo.webp';

const currencies: Record<string, { symbol: string; name: string }> = {
  Zambia: { symbol: 'ZMW', name: 'Zambian Kwacha' },
  Zimbabwe: { symbol: 'ZWL', name: 'Zimbabwean Dollar' },
  'South Africa': { symbol: 'ZAR', name: 'South African Rand' },
  Botswana: { symbol: 'BWP', name: 'Botswana Pula' },
  Kenya: { symbol: 'KES', name: 'Kenyan Shilling' },
  Nigeria: { symbol: 'NGN', name: 'Nigerian Naira' },
  'United Kingdom': { symbol: 'GBP', name: 'British Pound' },
  'United States': { symbol: 'USD', name: 'US Dollar' },
};

const countries = [
  'Zambia', 'Zimbabwe', 'South Africa', 'Botswana', 'Malawi', 'Mozambique',
  'Tanzania', 'Kenya', 'Nigeria', 'Ghana', 'Uganda', 'Rwanda', 'DRC',
  'Namibia', 'Angola', 'Ethiopia', 'Egypt', 'Morocco',
  'United Kingdom', 'United States', 'Canada', 'India', 'China',
  'Australia', 'Germany', 'France', 'Brazil', 'Japan', 'UAE', 'Saudi Arabia',
];

const balanceOptions = [
  { label: 'K10,000', value: 10000 },
  { label: 'K50,000', value: 50000 },
  { label: 'K100,000', value: 100000 },
  { label: 'K500,000', value: 500000 },
];

const DemoSetup = () => {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [nationality, setNationality] = useState('Zambia');
  const [balance, setBalance] = useState(50000);
  const [natOpen, setNatOpen] = useState(false);

  const currency = currencies[nationality] || { symbol: 'ZMW', name: 'Zambian Kwacha' };

  const handleStart = () => {
    sessionStorage.setItem('circle_demo', JSON.stringify({ name, email, nationality, balance, currency: currency.symbol }));
    sessionStorage.setItem('circle_is_demo', '1');
    sessionStorage.setItem('circle_wallet_balance', String(balance));
    navigate('/');
  };

  const inputClass = 'w-full bg-secondary rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary';

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 mx-auto relative">
            <img src={luseLogo} alt="LuSE" width={64} height={64} loading="eager" fetchPriority="high" className="w-full h-full object-contain" />
            <div className="absolute inset-0 rounded-full" style={{ boxShadow: '0 0 20px 6px hsl(197, 82%, 52%, 0.25)' }} />
          </div>
          <h1 className="text-xl font-bold text-foreground">Demo Account</h1>
          <p className="text-sm text-muted-foreground">Experience the LuSE market with virtual funds</p>
        </div>

        <div className="bg-card rounded-xl p-5 space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground block mb-1.5">
              <User className="w-3.5 h-3.5 inline mr-1" /> Full Name
            </label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter your name" className={inputClass} />
          </div>

          <div>
            <label className="text-sm font-medium text-foreground block mb-1.5">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className={inputClass} />
          </div>

          <div>
            <label className="text-sm font-medium text-foreground block mb-1.5">
              <Globe className="w-3.5 h-3.5 inline mr-1" /> Nationality
            </label>
            <div className="relative">
              <button onClick={() => setNatOpen(!natOpen)} className="w-full flex items-center justify-between bg-secondary rounded-xl px-4 py-3 text-sm text-foreground">
                <span>{nationality}</span>
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              </button>
              {natOpen && (
                <div className="absolute top-full left-0 right-0 z-30 mt-1 bg-card border border-border rounded-xl shadow-lg max-h-48 overflow-y-auto">
                  {countries.map(c => (
                    <button key={c} onClick={() => { setNationality(c); setNatOpen(false); }}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-secondary transition-colors">
                      {c}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground block mb-1.5">
              <Wallet className="w-3.5 h-3.5 inline mr-1" /> Starting Balance ({currency.symbol})
            </label>
            <div className="grid grid-cols-2 gap-2">
              {balanceOptions.map(opt => (
                <button key={opt.value} onClick={() => setBalance(opt.value)}
                  className={`py-2.5 rounded-xl text-sm font-medium transition-colors ${balance === opt.value ? 'bg-primary/15 text-primary border border-primary/30' : 'bg-secondary text-muted-foreground'}`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button
          onClick={handleStart}
          disabled={!name || !email}
          className="w-full py-3.5 bg-primary text-primary-foreground rounded-xl text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50">
          Start Trading
        </button>

        <p className="text-[10px] text-muted-foreground text-center">
          This is a simulated environment. No real money is involved.
        </p>
      </div>
    </div>
  );
};

export default DemoSetup;
