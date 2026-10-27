/** 统一的业务异常：带 HTTP 状态码，交给全局错误中间件输出 */
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const badRequest = (msg) => new HttpError(400, msg);
const unauthorized = (msg = '请先登录') => new HttpError(401, msg);
const forbidden = (msg = '没有操作权限') => new HttpError(403, msg);
const notFound = (msg = '资源不存在') => new HttpError(404, msg);
const conflict = (msg) => new HttpError(409, msg);

/** 包装 async 路由，异常自动转交 next()（Express 5 已内置，这里保留以兼容 4.x） */
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = { HttpError, badRequest, unauthorized, forbidden, notFound, conflict, wrap };
