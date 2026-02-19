const path = require('path');
const fs = require('fs');
const chain = {
  cssOutput : undefined,
  catcher: {},

  // Backgrounds
  bg(bg){ this.catcher.background = bg; return this; },
  bgColor(bgc){ this.catcher.backgroundColor = bgc; return this; },
  bgImage(bgi){ this.catcher.backgroundImage = bgi; return this; },
  bgRepeat(bgr){ this.catcher.backgroundRepeat = bgr; return this; },
  bgAttachment(bga){ this.catcher.backgroundAttachment = bga; return this; },
  bgPosition(bgp){ this.catcher.backgroundPosition = bgp; return this; },

  // Text 
  color(c){ this.catcher.color = c; return this; },
  direction(d){ this.catcher.direction = d; return this; },
  unicodeBidi(ub){ this.catcher.unicodeBidi = ub; return this; },
  verticalAlign(va){ this.catcher.verticalAlign = va; return this; },
  textTransform(t){ this.catcher.textTransform = t; return this; },
  textShadow(s){ this.catcher.textShadow = s; return this; },
  textAlign(ta){ this.catcher.textAlign = ta; return this; },
  textAlignLast(tal){ this.catcher.textAlignLast = tal; return this; },
  textDecoration(value, style){
    if (style === undefined) {
      this.catcher.textDecoration = value;
    } else {
      this.catcher.textDecorationStyle = value;
    }
    return this;
  },

  // Text-spacing 
  textIndent(ti){ this.catcher.textIndent = ti; return this; },
  letterSpacing(ls){ this.catcher.letterSpacing = ls; return this; },
  lineHeight(lh){ this.catcher.lineHeight = lh; return this; },
  wordSpacing(ws){ this.catcher.wordSpacing = ws; return this; },
  whiteSpace(sws){ this.catcher.whiteSpace = sws; return this; },

  // Border
  border(b){ this.catcher.border = b; return this; },
  borderStyle(bs){ this.catcher.borderStyle = bs; return this; },
  borderWidth(bw){ this.catcher.borderWidth = bw; return this; },
  borderColor(bc){ this.catcher.borderColor = bc; return this; },
  borderRadius(br){ this.catcher.borderRadius = br; return this; },
  borderSideStyle(side, value){
    if (side === 'top') {
      this.catcher.borderTopStyle = value;
    } else if (side === 'right') {
      this.catcher.borderRightStyle = value;
    } else if (side === 'bottom') {
      this.catcher.borderBottomStyle = value;
    } else if (side === 'left') {
      this.catcher.borderLeftStyle = value;
    }
    return this;
  },

  // Font 
  fontFamily(f){ this.catcher.fontFamily = f; return this; },
  fontStyle(s){ this.catcher.fontStyle = s; return this; },
  fontWeight(w){ this.catcher.fontWeight = w; return this; },
  fontVariant(v){ this.catcher.fontVariant = v; return this; },
  fontSize(si){ this.catcher.fontSize = si; return this; },

  // Display 
  display(d){ this.catcher.display = d; return this; },
  flex(f){ this.catcher.flex = f; return this; },
  alignContent(ac){ this.catcher.alignContent = ac; return this; }, 
  alignSelf(as){ this.catcher.alignSelf = as; return this; },
  alignItems(ai){ this.catcher.alignItems = ai; return this; },
  justifyContent(jc){ this.catcher.justifyContent = jc; return this; },
  flexWrap(fw){ this.catcher.flexWrap = fw; return this; },
  flexGrow(fg){ this.catcher.flexGrow = fg; return this; },
  flexDirection(fd){ this.catcher.flexDirection = fd; return this; },
  order(o){ this.catcher.order = o; return this; },
  visibility(v){ this.catcher.visibility = v; return this; },

  // Height, Width and Max-width
  width(w){ this.catcher.width = w; return this; },
  minWidth(mnw){ this.catcher.minWidth = mnw; return this; },
  maxWidth(mxw){ this.catcher.maxWidth = mxw; return this; },
  height(h){ this.catcher.height = h; return this; },
  minHeight(mnh){ this.catcher.minHeight = mnh; return this; },
  maxHeight(mxh){ this.catcher.maxHeight = mxh; return this; },

  // Padding
  padding(p){ this.catcher.padding = p; return this; },
  paddingTop(pt){ this.catcher.paddingTop = pt; return this; },
  paddingRight(pr){ this.catcher.paddingRight = pr; return this; },
  paddingBottom(pb){ this.catcher.paddingBottom = pb; return this; },
  paddingLeft(pl){ this.catcher.paddingLeft = pl; return this; },

  // Margin
  margin(m){ this.catcher.margin = m; return this; },
  marginTop(mt){ this.catcher.marginTop = mt; return this; },
  marginRight(mr){ this.catcher.marginRight = mr; return this; },
  marginBottom(mb){ this.catcher.marginBottom = mb; return this; },
  marginLeft(ml){ this.catcher.marginLeft = ml; return this; },

  // Overflow
  overflow(o){ this.catcher.overflow = o; return this; },
  overflowX(ox){ this.catcher.overflowX = ox; return this; },
  overflowY(oy){ this.catcher.overflowY = oy; return this; },
  overflowWrap(ow){ this.catcher.overflowWrap = ow; return this; },

  // List Style
  listStyle(ls){ this.catcher.listStyle = ls; return this; },
  listStyleType(lst){ this.catcher.listStyleType = lst; return this; },
  listStyleImage(lsi){ this.catcher.listStyleImage = lsi; return this; },
  listStylePosition(lsp){ this.catcher.listStylePosition = lsp; return this; },
  
  // Outline
  outline(o){ this.catcher.outline = o; return this; },
  outlineColor(oc){ this.catcher.outlineColor = oc; return this; },
  outlineStyle(os){ this.catcher.outlineStyle = os; return this; },
  outlineWidth(ow){ this.catcher.outlineWidth = ow; return this; },
  outlineOffset(oo){ this.catcher.outlineOffset = oo; return this; },

  // Float
  float(f){ this.catcher.float = f; return this; },
  clear(c){ this.catcher.clear = c; return this; },

  // Position
  position(p){ this.catcher.position = p; return this; },
  top(t){ this.catcher.top = t; return this; },
  left(l){ this.catcher.left = l; return this; },
  bottom(b){ this.catcher.bottom = b; return this; },
  
  // Z-index
  zIndex(zi){ this.catcher.zIndex = zi; return this; },

  // Box-sizing
  boxSizing(bs){ this.catcher.boxSizing = bs; return this; },

  // Opacity
  opacity(o){ this.catcher.opacity = o; return this; },
  
  // Transition
  transition(t){ this.catcher.transition = t; return this; },

  // Cursor
  cursor(c){ this.catcher.cursor = c; return this; },

  content(c){ this.catcher.content = c; return this; },

  accentColor(ac){ this.catcher.accentColor = ac; return this; },

  all(a){ this.catcher.all = a; return this; },

  // Block
  block(...args) {
    let objectCss = args.length === 0 ? {} : {selectors: args};
    Object.assign(objectCss, this.catcher);
    this.catcher = {};
    return objectCss;
  },

  // Navbar
  navBar(...args) {
    if (arguments.length === 0 && args.length === 0) {
      throw new Error('navBar() requires selector argument.');
    }
    let objectResult = {};
    objectResult.navUl = this.display('flex').listStyle('none').margin('0').padding('0').block(`${args[0]} ${args[1]}`);
    objectResult.navLi = this.margin('0 10px').block(`${args[0]} ${args[1]} ${args[2]}`);
    objectResult.navA = this.color('#fff').textDecoration('none').fontWeight('bold').borderRadius('3px').block(`${args[0]} ${args[1]} ${args[2]} ${args[3]}`);
    objectResult.navAhover = this.textDecoration('underline').bgColor('#555').block(`${args[0]} ${args[1]} ${args[2]} ${args[3]}:hover`);
    return objectResult;
  }
};


const run = (...args) => {
  let str1 = '';
  args.forEach(
    (value)=>{
      let str2 = `${value.selectors.toString()} {\n`;
      for (let key in value) {
        if(key !== 'selectors'){
          const kebabKey = key.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
          str2 += `\t${kebabKey}: ${value[key]};\n`;
        }
      }
      str2 += `}\n\n`;
      str1 += str2;
    }
  );
  chain.cssOutput = str1.trim();
};

const compile = (obj) => {
  let cssString = '';

  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const element = obj[key];
      let selectors = element.selectors || []; // Provide default empty array if selectors is undefined
      let elementCSS = '';
      console.log('Problematic element:', element);
        console.log('Type of element:', typeof element);
        console.log('Is element null?', element === null);
      for (let prop in element) {

        if (element.hasOwnProperty(prop) && prop !== 'selectors') {
          // Convert camelCase to kebab-case
          const kebabKey = prop.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
          elementCSS += `  ${kebabKey}: ${element[prop]};\n`;
        }
      }
      selectors = selectors.join();
      cssString += `${selectors} {\n${elementCSS}}\n`;
      
    }
  }

  chain.cssOutput = cssString;
};

const get = (filename) => {
  console.log('get() called with:', filename);
  console.log('Current working directory:', process.cwd());

  const fileExt = path.extname(filename).toLowerCase();
  if (fileExt !== '.jcss') {
    throw new Error(`Import error: ${filename} must have .jcss extension`);
  }
  
  // Try to resolve the path
  const resolvedPath = path.resolve(process.cwd(), filename);
  console.log('Resolved path:', resolvedPath);
  
  // Check if file exists
  const exists = fs.existsSync(resolvedPath);
  console.log('File exists?', exists);
  
  if (!exists) {
    throw new Error(`File not found: ${filename} (resolved to: ${resolvedPath})`);
  }
  
  return require(resolvedPath);
};

if (typeof global !== 'undefined') {
  global.chain = chain;
}


module.exports = {
  chain,
  run,
  compile,
  get
};