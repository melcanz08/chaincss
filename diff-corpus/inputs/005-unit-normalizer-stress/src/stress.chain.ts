export const stress = {
  selectors: ['.stress'],

  // NumInt with non-unitless properties -> become 'Npx'
  padding: 24,
  margin: 8,
  width: 100,
  height: 200,

  // NumFloat with non-unitless properties -> become 'Npx'
  letterSpacing: 1.5,
  borderWidth: 0.5,

  // Unitless properties -> stay as numbers
  opacity: 0.5,
  lineHeight: 1.5,
  zIndex: 10,
  flexGrow: 1,
  flexShrink: 0,
  fontWeight: 600,

  // Zero -> stays 0 (not 0px)
  borderRadius: 0,

  // Numeric string (no unit) -> becomes 'Npx'
  fontSize: '14',

  // String with unit -> unchanged
  color: 'red',

  // Custom property -> unchanged (starts with --)
  '--my-var': 42,

  // Nested rule -> recursion through pseudoClasses
  '&:hover': {
    padding: 32,
    opacity: 0.8
  }
};
