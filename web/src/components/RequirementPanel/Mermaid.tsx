import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  securityLevel: 'loose',
  fontFamily: 'inherit'
});

export const Mermaid: React.FC<{ chart: string }> = ({ chart }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgCode, setSvgCode] = useState<string>('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    let isMounted = true;
    
    const renderChart = async () => {
      try {
        if (!chart) return;
        
        // Generate a unique ID for this chart instance to prevent conflicts
        const id = `mermaid-${Math.random().toString(36).substring(2, 9)}`;
        
        const { svg } = await mermaid.render(id, chart);
        
        if (isMounted) {
          setSvgCode(svg);
          setError('');
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Failed to render mermaid chart');
          console.error('Mermaid render error:', err);
        }
      }
    };

    renderChart();

    return () => {
      isMounted = false;
    };
  }, [chart]);

  if (error) {
    return (
      <div className="bg-red-50 text-red-500 border border-red-200 p-4 rounded-md text-sm font-mono whitespace-pre-wrap overflow-auto">
        Error parsing mermaid chart:
        {'\n'}{error}
      </div>
    );
  }

  if (!svgCode) {
    return <div className="animate-pulse bg-zinc-100 h-32 rounded-md flex items-center justify-center text-zinc-400">Rendering chart...</div>;
  }

  return (
    <div 
      ref={containerRef}
      className="mermaid flex justify-center bg-white p-4 border border-zinc-200 rounded-xl my-4 overflow-x-auto"
      dangerouslySetInnerHTML={{ __html: svgCode }}
    />
  );
};
