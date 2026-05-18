const fs = require('fs');
const path = require('path');

const baseDir = 'C:/Users/win/dsmo_app';
const forms = ['entreprise', 'cooperative', 'ctd', 'ong'];

console.log('🚀 Starting conversion...\n');

forms.forEach(form => {
  const htmlPath = path.join(baseDir, 'src', 'pdf', 'templates', `${form}.html`);
  const hbsPath = path.join(baseDir, 'src', 'pdf', 'templates', 'dynamic', `${form}.hbs`);
  
  if (!fs.existsSync(htmlPath)) {
    console.log(`⚠️ Warning: ${form}.html not found`);
    return;
  }
  
  try {
    let content = fs.readFileSync(htmlPath, 'utf-8');
    let changes = 0;
    
    content = content.replace(/_{10,}/g, () => { changes++; return '{{value}}'; });
    content = content.replace(/\|__\|/g, () => { changes++; return '{{number}}'; });
    content = content.replace(/_{5,}/g, () => { changes++; return '{{text}}'; });
    content = content.replace(/______/g, () => { changes++; return '{{value}}'; });
    content = content.replace(/___________/g, () => { changes++; return '{{value}}'; });
    
    content = `{{! Template for ${form.toUpperCase()} }}\n{{#with this}}\n${content}\n{{/with}}`;
    
    const hbsDir = path.dirname(hbsPath);
    if (!fs.existsSync(hbsDir)) {
      fs.mkdirSync(hbsDir, { recursive: true });
    }
    
    fs.writeFileSync(hbsPath, content);
    console.log(`✅ ${form}.html → ${form}.hbs (${changes} placeholders added)`);
  } catch (error) {
    console.log(`❌ Error converting ${form}:`, error.message);
  }
});

console.log('\n✨ Conversion complete!');
