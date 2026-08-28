import { useState } from 'react';

export default function ClippedAreaChart() {
  const [data, setData] = useState([
    { month: 'Jan', value: 3000 },
    { month: 'Fev', value: 4000 },
    { month: 'Mar', value: 3500 },
    { month: 'Abr', value: 5000 },
    { month: 'Mai', value: 4800 },
    { month: 'Jun', value: 6000 },
  ]);

  return (
    <div className="h-32 w-full">
      <svg className="h-full w-full" viewBox="0 0 100 60">
        <path
          d="M0 50 Q20 40 40 30 T80 30"
          stroke="var(--color-pale-gold)"
          strokeWidth="2"
          fill="none"
        />
      </svg>
    </div>
  );
}