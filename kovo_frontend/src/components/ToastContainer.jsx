import React from 'react';
import { useApp } from '../context/AppContext';
import Icon from './Icon';

export default function ToastContainer() {
  const { toasts } = useApp();

  const icons = {
    success: 'lucide:check-circle',
    error: 'lucide:x-circle',
    warning: 'lucide:alert-triangle',
    info: 'lucide:info',
  };

  const colors = {
    success: 'var(--success)',
    error: 'var(--error)',
    warning: 'var(--warning)',
    info: 'var(--info)',
  };

  return (
    <div className="toast-container" role="status" aria-live="polite">
      {toasts.map(t => (
        <div 
          key={t.id} 
          className={`toast ${t.type} ${t.exiting ? 'exiting' : ''}`}
          role="alert"
        >
          <Icon 
            icon={icons[t.type]} 
            style={{ color: colors[t.type], fontSize: '1.125rem', flexShrink: 0 }} 
          />
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}
