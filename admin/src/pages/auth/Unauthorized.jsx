import React from 'react';

function Unauthorized() {
  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ color: 'var(--color-heading)', marginBottom: 8 }}>Unauthorized</h2>
      <p style={{ color: 'var(--color-text)', margin: 0 }}>You do not have access to this page.</p>
    </div>
  );
}

export default Unauthorized;
