import { useState } from 'react';
import { getStockLogo, isLogoPreloaded } from '@/lib/stockLogos';

interface StockLogoProps {
  ticker: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  lazy?: boolean;
}

const sizeClasses = {
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-12 h-12',
};

const sizePx = { sm: 32, md: 40, lg: 48 };

const StockLogo = ({ ticker, size = 'md', className = '', lazy = false }: StockLogoProps) => {
  const logo = getStockLogo(ticker);
  const alreadyCached = logo ? isLogoPreloaded(ticker) : false;
  const [loaded, setLoaded] = useState(alreadyCached);
  const [error, setError] = useState(false);

  const px = sizePx[size];

  if (!logo || error) {
    return (
      <div className={`${sizeClasses[size]} rounded-lg bg-secondary flex items-center justify-center text-xs font-bold text-primary shrink-0 ${className}`}>
        {ticker.slice(0, 2)}
      </div>
    );
  }

  return (
    <div className={`${sizeClasses[size]} rounded-lg overflow-hidden shrink-0 relative ${className}`}>
      {!loaded && (
        <div className={`${sizeClasses[size]} bg-secondary flex items-center justify-center text-xs font-bold text-primary absolute inset-0`}>
          {ticker.slice(0, 2)}
        </div>
      )}
      <img
        src={logo}
        alt={ticker}
        width={px}
        height={px}
        className={`w-full h-full object-cover ${loaded ? 'opacity-100' : 'opacity-0'}`}
        loading={lazy ? 'lazy' : 'eager'}
        decoding={lazy ? 'async' : 'sync'}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
      />
    </div>
  );
};

export default StockLogo;
