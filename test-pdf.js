const { OnefopPuppeteerService } = require('./dist/pdf/onefop-puppeteer.service');
const fs = require('fs');

const testData = {
  formType: 'ctd',
  surveyYear: 2025,
  respondentName: 'Jean Dupont',
  respondentFunction: 'Secretaire General',
  respondentPhone1: '699887766',
  respondentEmail: 'j.dupont@ctd.gov.cm',
  ctdType: 2,
  yearOfCreation: 2010,
  region: 'Centre',
  department: 'Mfoundi',
  permanentWorkers: 25,
  
  skillsNeeds: [
    { description: 'Gestion des ressources humaines', male: 5, female: 3, total: 8 },
    { description: 'Planification urbaine', male: 4, female: 2, total: 6 }
  ],
  
  trainingNeeds: [
    { domain: 'Cybersecurite', male: 10, female: 5, total: 15 }
  ],
  
  dismissalReasons: [
    { reason: 'Faute professionnelle', male: 2, female: 1, total: 3 }
  ]
};

async function test() {
  console.log('🚀 Generating PDF...');
  console.log('Form type:', testData.formType);
  console.log('Skills:', testData.skillsNeeds.length);
  console.log('Training:', testData.trainingNeeds.length);
  console.log('Dismissals:', testData.dismissalReasons.length);
  
  const service = new OnefopPuppeteerService();
  
  try {
    const pdf = await service.generate(testData);
    fs.writeFileSync('test-output.pdf', pdf);
    console.log('✅ PDF created: test-output.pdf');
    console.log('File size:', (pdf.length / 1024).toFixed(2), 'KB');
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

test();
