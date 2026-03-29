import { computed, inject, provide, ref, watch } from 'vue';

// Symbol for providing the global ChainCSS instance
const CHAIN_CSS_KEY = Symbol('chaincss');

/**
 * Core function to process styles and generate class names
 */
function processStyles(styles, atomic = true) {
  const result = {};
  
  for (const [key, styleFn] of Object.entries(styles)) {
    if (typeof styleFn === 'function') {
      result[key] = styleFn();
    } else if (styleFn && typeof styleFn === 'object') {
      // If it's already processed, use it
      result[key] = styleFn;
    } else {
      result[key] = styleFn;
    }
  }
  
  return result;
}

/**
 * Main composable for using ChainCSS in Vue components
 * @param {Object|Ref|ComputedRef} styles - Style definitions
 * @param {Object} options - Configuration options
 * @returns {Object} - Classes object
 */
export function useAtomicClasses(styles, options = {}) {
  const { atomic = true, global = false } = options;
  
  // Get global ChainCSS instance if available
  const chainCSS = inject(CHAIN_CSS_KEY, null);
  
  // Create reactive classes
  const classes = computed(() => {
    // Resolve styles if it's a ref or computed
    const resolvedStyles = typeof styles === 'function' 
      ? styles() 
      : styles?.value || styles;
    
    // Process the styles
    const processed = processStyles(resolvedStyles, atomic);
    
    // If we have a global ChainCSS instance, register styles
    if (chainCSS && typeof chainCSS.register === 'function') {
      chainCSS.register(processed, { atomic, global });
    }
    
    return processed;
  });
  
  return {
    classes,
    // Helper to get specific class
    cx: (name) => classes.value[name],
    // Helper to combine multiple classes
    cn: (...names) => names.map(name => classes.value[name]).filter(Boolean).join(' ')
  };
}

/**
 * Component for injecting global styles
 */
export const ChainCSSGlobal = {
  name: 'ChainCSSGlobal',
  props: {
    styles: {
      type: Object,
      required: true
    },
    atomic: {
      type: Boolean,
      default: true
    }
  },
  setup(props) {
    // Create a computed ref for styles
    const globalStyles = computed(() => props.styles);
    
    // Process and inject styles
    const processedStyles = computed(() => {
      return processStyles(globalStyles.value, props.atomic);
    });
    
    // Provide ChainCSS instance to children
    const chainCSSInstance = {
      register: (styles, options) => {
        // This would integrate with your actual ChainCSS runtime
        console.log('Registering styles:', styles, options);
        // TODO: Connect to actual ChainCSS runtime
      }
    };
    
    provide(CHAIN_CSS_KEY, chainCSSInstance);
    
    // In development, log the styles
    if (process.env.NODE_ENV === 'development') {
      watch(processedStyles, (styles) => {
        console.log('[ChainCSS] Global styles registered:', styles);
      }, { immediate: true });
    }
    
    // This component doesn't render anything
    return () => null;
  }
};

/**
 * Create a themed component with ChainCSS styles
 * @param {Object|Function} styles - Style definitions
 * @param {Object} options - Component options
 * @returns {Object} - Vue component
 */
export function createStyledComponent(styles, options = {}) {
  const { name = 'StyledComponent', atomic = true } = options;
  
  return {
    name,
    props: {
      as: {
        type: String,
        default: 'div'
      },
      className: {
        type: String,
        default: ''
      },
      ...options.props
    },
    setup(props, { slots, attrs }) {
      // Resolve styles (can be a function that receives props)
      const resolvedStyles = computed(() => {
        if (typeof styles === 'function') {
          return styles(props);
        }
        return styles;
      });
      
      const { classes, cn } = useAtomicClasses(resolvedStyles, { atomic });
      
      // Combine classes
      const combinedClasses = computed(() => {
        return cn('root', props.className);
      });
      
      return () => {
        const tag = props.as;
        const componentProps = {
          ...attrs,
          class: combinedClasses.value
        };
        
        // Remove props that shouldn't be passed to DOM elements
        delete componentProps.as;
        
        return h(tag, componentProps, slots.default?.());
      };
    }
  };
}

/**
 * Create a reactive theme system
 * @param {Object} themes - Theme definitions
 * @returns {Object} - Theme utilities
 */
export function createTheme(themes) {
  const currentTheme = ref(Object.keys(themes)[0] || 'light');
  
  const themeStyles = computed(() => {
    return themes[currentTheme.value] || {};
  });
  
  const setTheme = (themeName) => {
    if (themes[themeName]) {
      currentTheme.value = themeName;
    }
  };
  
  const toggleTheme = () => {
    const keys = Object.keys(themes);
    const currentIndex = keys.indexOf(currentTheme.value);
    const nextIndex = (currentIndex + 1) % keys.length;
    currentTheme.value = keys[nextIndex];
  };
  
  return {
    currentTheme: readonly(currentTheme),
    themeStyles,
    setTheme,
    toggleTheme
  };
}

// Import Vue's h function for createStyledComponent
import { h, readonly } from 'vue';