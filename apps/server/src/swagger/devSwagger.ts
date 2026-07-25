import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import type { FastifyInstance } from 'fastify';

/**
 * 使用 `loggerInstance: pino` 时 Fastify 实例的泛参与 `@fastify/swagger*` 默认声明不完全一致，此处放宽以兼容。
 */
type FastifyForDocs = FastifyInstance<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any
>;

/**
 * OpenAPI + Swagger UI **仅开发态**注册：`NODE_ENV === 'production'` 时不加载；可用 `SERVER_SWAGGER=0` 在本地关闭。
 *
 * - JSON：`GET /documentation/json`
 * - UI：`GET /documentation`（及静态资源子路径）
 */

export function isSwaggerDevEnabled(): boolean {
  if (process.env.NODE_ENV === 'production') {
    return false;
  }
  const v = process.env.SERVER_SWAGGER;
  if (v === '0' || v === 'false') {
    return false;
  }
  return true;
}

/** 须在 **路由注册之前** 调用，以便 `@fastify/swagger` 收集带 `schema` 的路由。 */
export async function registerSwaggerGenerator(
  app: FastifyForDocs
): Promise<void> {
  await app.register(swagger, {
    openapi: {
      openapi: '3.0.3',
      info: {
        title: '@plugin/server',
        description:
          'EVM gateway API。本 OpenAPI 文档仅在非 production 环境生成；生产构建启动时不暴露 /documentation。',
        version: '0.0.0'
      },
      servers: [{ url: '/', description: 'default' }]
    }
  });
}

/** 须在 **全部业务路由注册之后** 调用。 */
export async function registerSwaggerUi(app: FastifyForDocs): Promise<void> {
  await app.register(swaggerUi, {
    routePrefix: '/documentation',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true
    }
  });
}
