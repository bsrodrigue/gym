/**
 * Lambda entry point.
 *
 * Wraps the Fastify app with the official @fastify/aws-lambda adapter
 * so the exact same route handlers run both locally (via `npm run dev`)
 * and inside a Lambda function.
 *
 * Keeping this as a separate file (not server.ts) means the local dev
 * server doesn't pull in Lambda-specific code.
 */
import awsLambdaFastify, { type PromiseHandler } from "@fastify/aws-lambda";
import { buildApp } from "./server.js";

let proxy: PromiseHandler | null = null;

export const handler: PromiseHandler = async (event, context) => {
  if (!proxy) {
    const app = await buildApp();
    proxy = awsLambdaFastify(app);
  }
  return proxy(event, context);
};
