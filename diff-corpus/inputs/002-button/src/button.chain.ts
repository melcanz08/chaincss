export const button = {
  selectors: ['.btn'],
  display: 'inline-flex',
  alignItems: 'center',
  gap: '8px',
  padding: '12px 24px',
  background: '#3b82f6',
  color: 'white',
  borderRadius: '8px',
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  '&:active': {
    transform: 'scale(0.95)'
  }
};
