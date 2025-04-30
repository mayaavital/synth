// Test the game code generator
const { generateSimpleGameCode } = require('./server');

// Generate 10 sample codes
console.log('Testing game code generator:');
console.log('--------------------------');

for (let i = 0; i < 10; i++) {
  const code = generateSimpleGameCode();
  console.log(`Sample ${i+1}: ${code}`);
}

console.log('--------------------------');
console.log('Verify these codes are short and easy to type on mobile devices.'); 