const fs = require('fs');
const rules = fs.readFileSync('firestore.rules', 'utf8');
console.log(rules.includes('let '));
