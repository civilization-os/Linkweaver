const http = require('http');

const request = (method, path, data) => {
  return new Promise((resolve, reject) => {
    const postData = data ? JSON.stringify(data) : '';
    const options = {
      hostname: 'localhost',
      port: 8081,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(body ? JSON.parse(body) : null);
        } else {
          reject(new Error(`Request failed with status ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', (e) => reject(e));
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
};

async function main() {
  try {
    // 1. Create a fresh project
    console.log('Creating demo project...');
    const project = await request('POST', '/api/projects', { name: 'E-Commerce Demo System' });
    const projId = project.id;
    console.log(`Created project: ${project.name} (${projId})`);

    // 2. Create User Actor node
    console.log('Adding User Actor node...');
    const userNode = await request('POST', `/api/projects/${projId}/nodes`, {
      type: 'actor',
      label: '前端用户',
      sublabel: 'Actor',
      x: 150,
      y: 250
    });
    console.log(`Added User Actor: ${userNode.id}`);

    // 3. Create Order Service process node
    console.log('Adding Order Service process node...');
    const orderNode = await request('POST', `/api/projects/${projId}/nodes`, {
      type: 'process',
      label: '订单服务',
      sublabel: 'Process',
      x: 450,
      y: 250,
      fields: [
        { name: 'orderId', type: 'string' },
        { name: 'amount', type: 'number' }
      ]
    });
    console.log(`Added Order Service: ${orderNode.id}`);

    // 4. Create Order DB entity node
    console.log('Adding Order DB entity node...');
    const dbNode = await request('POST', `/api/projects/${projId}/nodes`, {
      type: 'entity',
      label: '订单数据库',
      sublabel: 'Entity',
      x: 750,
      y: 250,
      fields: [
        { name: 'id', type: 'string' },
        { name: 'status', type: 'string' }
      ]
    });
    console.log(`Added Order Database: ${dbNode.id}`);

    // 5. Create Flow 1: User -> Order Service
    console.log('Connecting User -> Order Service...');
    await request('POST', `/api/projects/${projId}/edges`, {
      sourceId: userNode.id,
      sourcePort: 'r',
      targetId: orderNode.id,
      targetPort: 'l',
      label: '提交订单',
      dir: 'fwd'
    });

    // 6. Create Flow 2: Order Service -> Order DB
    console.log('Connecting Order Service -> Order Database...');
    await request('POST', `/api/projects/${projId}/edges`, {
      sourceId: orderNode.id,
      sourcePort: 'r',
      targetId: dbNode.id,
      targetPort: 'l',
      label: '写入订单',
      dir: 'fwd'
    });

    console.log('Demo project setup successfully completed!');
  } catch (error) {
    console.error('Error creating demo project:', error);
  }
}

main();
