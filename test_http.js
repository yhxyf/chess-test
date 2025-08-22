// 简单的HTTP客户端测试脚本
const http = require('http');

// 测试主页访问
const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/',
  method: 'GET'
};

const req = http.request(options, (res) => {
  console.log(`状态码: ${res.statusCode}`);
  console.log(`响应头: ${JSON.stringify(res.headers)}`);
  
  res.on('data', (chunk) => {
    console.log(`响应体: ${chunk}`);
  });
  
  res.on('end', () => {
    console.log('响应结束');
  });
});

req.on('error', (error) => {
  console.error(`请求出错: ${error.message}`);
});

req.end();