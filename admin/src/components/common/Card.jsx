import React, { useEffect, useState } from 'react';
import './Card.css';

function Card({ title, value, icon, accent, animateNumber }) {
  const [displayValue, setDisplayValue] = useState(animateNumber ? 0 : value);

  useEffect(() => {
    if (!animateNumber || typeof value !== 'number') {
      setDisplayValue(value);
      return;
    }

    const duration = 700;
    const start = performance.now();
    const from = 0;
    const to = value;

    let frame;
    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setDisplayValue(Math.round(from + (to - from) * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, animateNumber]);

  return (
    <div className="info-card" style={accent ? { '--card-accent': accent } : undefined}>
      {icon && <div className="info-card-icon">{icon}</div>}
      <p className="info-card-title">{title}</p>
      <h3 className="info-card-value">{displayValue}</h3>
    </div>
  );
}

export default Card;