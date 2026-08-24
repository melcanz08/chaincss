import { EditorView, basicSetup } from 'codemirror';
import { EditorState } from '@codemirror/state';
import { css } from '@codemirror/lang-css';
import { oneDark } from '@codemirror/theme-one-dark';
import { compileString } from 'chaincss';

// Get DOM elements
const compileBtn = document.getElementById('compile-btn') as HTMLButtonElement;
const outputCss = document.getElementById('output-css') as HTMLPreElement;
const outputAst = document.getElementById('output-ast') as HTMLPreElement;
const astTableContainer = document.getElementById('ast-table-container') as HTMLElement;
const diagnosticsPane = document.getElementById('diagnostics-pane') as HTMLElement;
const diagnosticsList = document.getElementById('diagnostics-list') as HTMLElement;
const diagCounter = document.getElementById('diag-counter') as HTMLElement;
const tableViewBtn = document.getElementById('table-view-btn') as HTMLButtonElement;
const jsonViewBtn = document.getElementById('json-view-btn') as HTMLButtonElement;
const copyCssBtn = document.getElementById('copy-css-btn') as HTMLButtonElement;
const copyJsonBtn = document.getElementById('copy-json-btn') as HTMLButtonElement;

// Default sample code
const defaultCode = `chain()
  .flex({ direction: "row", gap: 16 })
  .background({ color: "primary" })
  .hover(c => c
    .box({ padding: 8 })
  )
  .$el(".card")`;

// Initialize CodeMirror Editor
const view = new EditorView({
  state: EditorState.create({
    doc: defaultCode,
    extensions: [basicSetup, css(), oneDark],
  }),
  parent: document.getElementById('editor') as HTMLElement,
});

// View mode state
let tableViewMode = true;

// Function to toggle AST view
function setAstView(mode: 'table' | 'json') {
  tableViewMode = mode === 'table';
  if (tableViewMode) {
    astTableContainer.style.display = 'block';
    outputAst.style.display = 'none';
    tableViewBtn.classList.add('active');
    jsonViewBtn.classList.remove('active');
    copyJsonBtn.style.display = 'none'; // Hide copy button in table view
  } else {
    astTableContainer.style.display = 'none';
    outputAst.style.display = 'block';
    tableViewBtn.classList.remove('active');
    jsonViewBtn.classList.add('active');
    copyJsonBtn.style.display = 'inline-block'; // Show copy button in JSON view
  }
}

// Function to copy text to clipboard
function copyToClipboard(text: string, button: HTMLButtonElement) {
  navigator.clipboard.writeText(text).then(() => {
    const originalText = button.textContent;
    button.textContent = '✅ Copied!';
    button.classList.add('copied');
    setTimeout(() => {
      button.textContent = originalText;
      button.classList.remove('copied');
    }, 1500);
  });
}

// Function to render diagnostics
function renderDiagnostics(diagnostics: any[]) {
  if (!diagnostics || diagnostics.length === 0) {
    diagnosticsPane.style.display = 'none';
    return;
  }

  diagnosticsPane.style.display = 'flex';
  
  const errors = diagnostics.filter((d: any) => d.severity === 'error').length;
  const warnings = diagnostics.filter((d: any) => d.severity === 'warning').length;
  const info = diagnostics.filter((d: any) => d.severity === 'info').length;
  const hints = diagnostics.filter((d: any) => d.severity === 'hint').length;
  
  diagCounter.textContent = `(${errors} errors, ${warnings} warnings, ${info} info, ${hints} hints)`;

  let html = '';
  for (const d of diagnostics) {
    html += `
      <div class="diagnostic-item ${d.severity}">
        <span class="diagnostic-severity severity-${d.severity}">[${d.severity.toUpperCase()}]</span>
        <span class="diagnostic-message">${d.message}</span>
        ${d.suggestion ? `<span class="diagnostic-suggestion">${d.suggestion}</span>` : ''}
        <span class="diagnostic-pass">${d.pass || ''}</span>
      </div>
    `;
  }
  diagnosticsList.innerHTML = html;
}

// Function to render AST as a table
function renderASTTable(ast: any) {
  if (!ast || !ast.rules) {
    astTableContainer.innerHTML = '<p style="color: #f38ba8; padding: 20px;">No AST data available.</p>';
    return;
  }

  let html = `
    <table class="ast-table">
      <thead>
        <tr>
          <th>Type</th>
          <th>Selector / Property</th>
          <th>Value / Details</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
  `;

  for (const rule of ast.rules) {
    const isDead = rule.isDead || false;
    const deadClass = isDead ? 'dead-rule' : '';
    
    html += `
      <tr class="rule-row ${deadClass}">
        <td>Rule</td>
        <td><strong>${rule.selector}</strong></td>
        <td>ID: ${rule.id}${rule.specificity ? ` | Specificity: ${rule.specificity}` : ''}</td>
        <td>${isDead ? '💀 Dead' : '✅ Alive'}</td>
      </tr>
    `;

    for (const decl of rule.declarations || []) {
      const parsedKind = decl.meta?.parsed?.kind || '';
      const parsedInfo = parsedKind ? ` (${parsedKind})` : '';
      html += `
        <tr class="declaration-row">
          <td>Declaration</td>
          <td style="padding-left: 30px;">${decl.property}</td>
          <td>${decl.value}${parsedInfo}</td>
          <td>—</td>
        </tr>
      `;
    }

    for (const pc of rule.pseudoClasses || []) {
      html += `
        <tr class="rule-row">
          <td>Pseudo</td>
          <td><strong>${rule.selector}:${pc.name}</strong></td>
          <td>Declarations: ${pc.declarations?.length || 0}</td>
          <td>—</td>
        </tr>
      `;
      for (const decl of pc.declarations || []) {
        html += `
          <tr class="declaration-row">
            <td>Declaration</td>
            <td style="padding-left: 30px;">${decl.property}</td>
            <td>${decl.value}</td>
            <td>—</td>
          </tr>
        `;
      }
    }

    for (const atRule of rule.atRules || []) {
      const queryInfo = atRule.query ? ` | Query: ${atRule.query}` : '';
      const nameInfo = atRule.name ? ` | Name: ${atRule.name}` : '';
      html += `
        <tr class="atrule-row">
          <td>@${atRule.type}</td>
          <td><strong>@${atRule.type}${queryInfo}${nameInfo}</strong></td>
          <td>Declarations: ${atRule.declarations?.length || 0} | Nested: ${atRule.nestedRules?.length || 0}</td>
          <td>—</td>
        </tr>
      `;
      for (const decl of atRule.declarations || []) {
        html += `
          <tr class="declaration-row">
            <td>Declaration</td>
            <td style="padding-left: 30px;">${decl.property}</td>
            <td>${decl.value}</td>
            <td>—</td>
          </tr>
        `;
      }
    }

    for (const nested of rule.nestedRules || []) {
      html += `
        <tr class="rule-row">
          <td>Nested</td>
          <td><strong>${nested.selector}</strong></td>
          <td>Declarations: ${nested.declarations?.length || 0}</td>
          <td>—</td>
        </tr>
      `;
      for (const decl of nested.declarations || []) {
        html += `
          <tr class="declaration-row">
            <td>Declaration</td>
            <td style="padding-left: 30px;">${decl.property}</td>
            <td>${decl.value}</td>
            <td>—</td>
          </tr>
        `;
      }
    }
  }

  for (const diag of ast.diagnostics || []) {
    html += `
      <tr class="diagnostic-row">
        <td>Diagnostic</td>
        <td><span class="severity-${diag.severity}">[${diag.severity.toUpperCase()}]</span> ${diag.message}</td>
        <td>${diag.suggestion || '—'}</td>
        <td>${diag.pass || '—'}</td>
      </tr>
    `;
  }

  html += '</tbody></table>';
  astTableContainer.innerHTML = html;
}

// Function to run the compiler
function runCompiler() {
  const code = view.state.doc.toString();
  const result = compileString(code);

  // Display CSS
  outputCss.textContent = result.css;

  // Display diagnostics
  const diagnostics = result.diagnostics || [];
  renderDiagnostics(diagnostics);

  // Display AST
  outputAst.textContent = JSON.stringify(result.ast, null, 2);

  // Render AST table
  renderASTTable(result.ast);

  // Show the active view
  setAstView(tableViewMode ? 'table' : 'json');
}

// Event Listeners
compileBtn.addEventListener('click', runCompiler);
tableViewBtn.addEventListener('click', () => setAstView('table'));
jsonViewBtn.addEventListener('click', () => setAstView('json'));

// Copy buttons
copyCssBtn.addEventListener('click', () => {
  copyToClipboard(outputCss.textContent || '', copyCssBtn);
});

copyJsonBtn.addEventListener('click', () => {
  copyToClipboard(outputAst.textContent || '', copyJsonBtn);
});

document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key === 'Enter') {
    e.preventDefault();
    runCompiler();
  }
});

// Run once on load
runCompiler();