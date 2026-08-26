import type { Request, Response, NextFunction } from 'express';

const ALLOWED_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

// Vite dev server port: web/vite.config.ts 的 proxy 不改写 Origin 头,
// 开发模式下后端收到的 Origin 仍是 http://localhost:5173,因此必须放行。
const DEV_SERVER_PORT = '5173';

export function isAllowedLocalOrigin(origin: string | undefined, port: number | string): boolean {
  if (!origin) return true;

  try {
    const url = new URL(origin);
    if (!ALLOWED_HOSTS.has(url.hostname)) return false;
    // 要求显式端口匹配,不允许无端口(默认 80)origin 直接通过。
    if (!url.port) return false;
    return url.port === String(port) || url.port === DEV_SERVER_PORT;
  } catch {
    return false;
  }
}

export function getLocalOriginMiddleware(port: number | string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;
    if (!origin) {
      next();
      return;
    }

    // 拒绝路径同样设置 Vary: Origin,避免缓存代理跨 origin 复用 403 响应。
    res.setHeader('Vary', 'Origin');

    if (!isAllowedLocalOrigin(origin, port)) {
      res.status(403).send('Origin not allowed');
      return;
    }

    res.setHeader('Access-Control-Allow-Origin', origin);

    // 处理 CORS 预检(行为与原先 cors 包一致,仅允许本地 origin 通过)。
    if (req.method === 'OPTIONS' && req.headers['access-control-request-method']) {
      res.setHeader('Access-Control-Allow-Methods', String(req.headers['access-control-request-method']));
      res.setHeader('Access-Control-Allow-Headers', String(req.headers['access-control-request-headers'] ?? ''));
      res.setHeader('Access-Control-Max-Age', '86400');
      res.status(204).end();
      return;
    }

    next();
  };
}
