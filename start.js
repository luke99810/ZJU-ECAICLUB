const { spawn } = require('child_process');
const path = require('path');

const nextPath = path.join(__dirname, 'node_modules', 'next', 'dist', 'bin', 'next');

const child = spawn('node', [nextPath, 'dev', '-p', '3007'], {
  cwd: __dirname,
  stdio: 'inherit'
});

child.on('error', (err) => {
  console.error('Failed to start Next.js:', err);
});

child.on('exit', (code) => {
  console.log('Next.js exited with code:', code);
});
