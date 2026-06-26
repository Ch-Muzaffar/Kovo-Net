import React from 'react';

export default function Icon({ icon, className = '', style = {} }) {
  if (!icon) return null;
  // Since we loaded iconify.min.js in index.html, we can use the web component
  // or a standard span with data-icon. React preserves data- attributes.
  return (
    <iconify-icon 
      icon={icon} 
      class={className} 
      style={{ display: 'inline-block', verticalAlign: 'middle', ...style }}
    />
  );
}
