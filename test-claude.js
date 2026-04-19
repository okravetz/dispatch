#!/usr/bin/env node

import https from 'https';

const data = JSON.stringify({
  model: "claude-3-haiku-20240307",
  max_tokens: 100,
  messages: [
    {
      role: "user",
      content: "Hello, Claude! Please respond with just the word 'test'."
    }
  ]
});

const options = {
  hostname: 'localhost',
  port: 8888,
  path: '/.netlify/functions/claude',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = https.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  console.log(`Headers:`, res.headers);

  res.on('data', (chunk) => {
    console.log('Response:', chunk.toString());
  });
});

req.on('error', (e) => {
  console.error('Error:', e.message);
});

req.write(data);
req.end();