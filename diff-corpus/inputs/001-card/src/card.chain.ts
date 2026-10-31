export const card = {
  selectors: ['.card'],
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
  padding: '24px',
  background: 'white',
  borderRadius: '12px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  '&:hover': {
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
    transform: 'translateY(-2px)'
  }
};
