import { useEffect, useState } from 'react';

export default function TimelineAnimation({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(true);
  }, []);

  return (
    <div className={visible ? 'opacity-100' : 'opacity-0 transition-opacity duration-500'}>
      {children}
    </div>
  );
}