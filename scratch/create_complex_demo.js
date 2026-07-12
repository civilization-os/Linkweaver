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
    console.log('Creating complex demo project...');
    const project = await request('POST', '/api/projects', { name: '淘宝级微服务电商系统' });
    const projId = project.id;
    console.log(`Created project: ${project.name} (${projId})`);

    // 1. Create Regions
    console.log('Creating Regions...');
    const regUser = await request('POST', `/api/projects/${projId}/regions`, {
      title: '用户与安全服务区',
      x: 100, y: 100, w: 360, h: 500,
      color: '#e3f2fd'
    });
    const regCatalog = await request('POST', `/api/projects/${projId}/regions`, {
      title: '商品与库存服务区',
      x: 500, y: 100, w: 360, h: 500,
      color: '#efebe9'
    });
    const regOrder = await request('POST', `/api/projects/${projId}/regions`, {
      title: '订单与交易服务区',
      x: 900, y: 100, w: 360, h: 500,
      color: '#fff3e0'
    });
    const regPayment = await request('POST', `/api/projects/${projId}/regions`, {
      title: '支付与结算服务区',
      x: 1300, y: 100, w: 360, h: 500,
      color: '#e8f5e9'
    });

    // 2. Create Actors (outside regions or on edge)
    console.log('Creating Actors...');
    const actorUser = await request('POST', `/api/projects/${projId}/nodes`, {
      type: 'actor',
      label: 'C端消费者',
      sublabel: 'Customer Client',
      x: 150, y: 20
    });
    const actorMerchant = await request('POST', `/api/projects/${projId}/nodes`, {
      type: 'actor',
      label: '商家后台',
      sublabel: 'Merchant Portal',
      x: 900, y: 20
    });

    // 3. Create Nodes in User & Security Region
    console.log('Creating User Service Nodes...');
    const processAuth = await request('POST', `/api/projects/${projId}/nodes`, {
      type: 'process',
      label: 'OAuth 认证中心',
      sublabel: 'JWT & Token Process',
      regionId: regUser.id,
      x: 150, y: 160
    });
    const entityUser = await request('POST', `/api/projects/${projId}/nodes`, {
      type: 'entity',
      label: '会员主表',
      sublabel: 'tb_user',
      regionId: regUser.id,
      x: 150, y: 320,
      fields: [
        { name: 'uid', type: 'bigint', required: true, description: '唯一标识' },
        { name: 'username', type: 'varchar(64)', required: true },
        { name: 'phone', type: 'varchar(20)' },
        { name: 'status', type: 'tinyint', description: '账户状态(冻结/激活)' }
      ]
    });

    // 4. Create Nodes in Catalog & Inventory Region
    console.log('Creating Catalog Service Nodes...');
    const entityProduct = await request('POST', `/api/projects/${projId}/nodes`, {
      type: 'entity',
      label: '商品Spu/Sku表',
      sublabel: 'tb_product',
      regionId: regCatalog.id,
      x: 550, y: 160,
      fields: [
        { name: 'sku_id', type: 'bigint', required: true },
        { name: 'title', type: 'varchar(256)', required: true },
        { name: 'price', type: 'decimal(10,2)' },
        { name: 'stock', type: 'int', description: '可用库存' }
      ]
    });
    const processStock = await request('POST', `/api/projects/${projId}/nodes`, {
      type: 'process',
      label: '库存扣减引擎',
      sublabel: 'Redis & DB Stock Lock',
      regionId: regCatalog.id,
      x: 550, y: 320
    });

    // 5. Create Nodes in Order & Transaction Region
    console.log('Creating Order Service Nodes...');
    const processOrder = await request('POST', `/api/projects/${projId}/nodes`, {
      type: 'process',
      label: '下单核心服务',
      sublabel: 'Order Create Pipe',
      regionId: regOrder.id,
      x: 950, y: 160
    });
    const entityOrder = await request('POST', `/api/projects/${projId}/nodes`, {
      type: 'entity',
      label: '订单明细主表',
      sublabel: 'tb_order',
      regionId: regOrder.id,
      x: 950, y: 320,
      fields: [
        { name: 'order_no', type: 'varchar(64)', required: true },
        { name: 'buyer_id', type: 'bigint', required: true },
        { name: 'payment_amount', type: 'decimal(10,2)' },
        { name: 'order_status', type: 'tinyint', description: '待支付/已支付/已取消' }
      ]
    });

    // 6. Create Nodes in Payment & Settlement Region
    console.log('Creating Payment Service Nodes...');
    const processPayment = await request('POST', `/api/projects/${projId}/nodes`, {
      type: 'process',
      label: '支付路由中心',
      sublabel: 'WeChat/Alipay Route',
      regionId: regPayment.id,
      x: 1350, y: 160
    });
    const entityPayment = await request('POST', `/api/projects/${projId}/nodes`, {
      type: 'entity',
      label: '交易流水账单',
      sublabel: 'tb_payment_record',
      regionId: regPayment.id,
      x: 1350, y: 320,
      fields: [
        { name: 'pay_no', type: 'varchar(64)', required: true },
        { name: 'order_no', type: 'varchar(64)', required: true },
        { name: 'channel', type: 'varchar(20)', description: 'wx_pay / ali_pay' },
        { name: 'pay_status', type: 'tinyint' }
      ]
    });

    // 7. Create Edges
    console.log('Connecting Data Flows...');
    
    // User login flow
    await request('POST', `/api/projects/${projId}/edges`, {
      sourceId: actorUser.id, sourcePort: 'b',
      targetId: processAuth.id, targetPort: 't',
      label: '登录(账号密码)', dir: 'fwd'
    });
    await request('POST', `/api/projects/${projId}/edges`, {
      sourceId: processAuth.id, sourcePort: 'b',
      targetId: entityUser.id, targetPort: 't',
      label: '校验账号及权限', dir: 'both'
    });

    // Product search / view
    await request('POST', `/api/projects/${projId}/edges`, {
      sourceId: actorUser.id, sourcePort: 'b',
      targetId: entityProduct.id, targetPort: 't',
      label: '浏览/搜索商品', dir: 'fwd'
    });

    // Create Order Pipe
    await request('POST', `/api/projects/${projId}/edges`, {
      sourceId: actorUser.id, sourcePort: 'b',
      targetId: processOrder.id, targetPort: 't',
      label: '提交购物车结算', dir: 'fwd'
    });
    await request('POST', `/api/projects/${projId}/edges`, {
      sourceId: processOrder.id, sourcePort: 'l',
      targetId: processStock.id, targetPort: 'r',
      label: '扣减/预占库存', dir: 'both'
    });
    await request('POST', `/api/projects/${projId}/edges`, {
      sourceId: processOrder.id, sourcePort: 'b',
      targetId: entityOrder.id, targetPort: 't',
      label: '落库持久化', dir: 'fwd'
    });

    // Payment route & callback
    await request('POST', `/api/projects/${projId}/edges`, {
      sourceId: entityOrder.id, sourcePort: 'r',
      targetId: processPayment.id, targetPort: 'l',
      label: '调起支付收银台', dir: 'fwd'
    });
    await request('POST', `/api/projects/${projId}/edges`, {
      sourceId: processPayment.id, sourcePort: 'b',
      targetId: entityPayment.id, targetPort: 't',
      label: '生成支付流水账单', dir: 'fwd'
    });
    await request('POST', `/api/projects/${projId}/edges`, {
      sourceId: processPayment.id, sourcePort: 'l',
      targetId: entityOrder.id, targetPort: 'r',
      label: '支付状态回调更新', dir: 'fwd'
    });

    // Merchant managing products
    await request('POST', `/api/projects/${projId}/edges`, {
      sourceId: actorMerchant.id, sourcePort: 'b',
      targetId: entityProduct.id, targetPort: 't',
      label: '发布新商品/更新价格', dir: 'fwd'
    });

    console.log('Complex Demo project setup successfully completed!');
  } catch (error) {
    console.error('Error creating complex demo project:', error);
  }
}

main();
