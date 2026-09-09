export function formatKwacha(price: number): string {
  return 'K' + price.toLocaleString('en-ZM', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function getTickFormatter(period: string) {
  return (time: number) => {
    const date = new Date(time * 1000);
    if (period === '1M' || period === '3M') {
      return date.toLocaleDateString('en-ZM', { day: 'numeric', month: 'short' });
    }
    if (period === '6M' || period === '1Y') {
      return date.toLocaleDateString('en-ZM', { month: 'short' });
    }
    if (period === '3Y') {
      const q = Math.floor(date.getMonth() / 3) + 1;
      return 'Q' + q + ' ' + date.getFullYear();
    }
    if (period === '5Y') {
      return date.toLocaleDateString('en-ZM', { month: 'short', year: 'numeric' });
    }
    return date.toLocaleDateString('en-ZM', { month: 'short' });
  };
}
