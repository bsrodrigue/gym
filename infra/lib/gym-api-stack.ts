import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigw from "aws-cdk-lib/aws-apigatewayv2";
import * as integrations from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as logs from "aws-cdk-lib/aws-logs";
import type { Construct } from "constructs";

/**
 * Deploys the gym capacity API as a single Lambda behind an HTTP API Gateway.
 *
 * Architecture decisions:
 *
 * 1. **HTTP API (v2) over REST API (v1)**
 *    HTTP APIs are cheaper (~70 % less), have lower latency, and support
 *    everything we need (CORS, JWT auth, etc.). REST APIs only add value
 *    when you need request/response transformations or usage plans.
 *
 * 2. **Monolithic Lambda (all routes in one function)**
 *    For a small API like this, a single Lambda keeps cold-start surface area
 *    small and deploys faster. If individual routes needed independent scaling
 *    or wildly different memory profiles, we'd split into per-route Lambdas.
 *
 * 3. **@fastify/aws-lambda adapter**
 *    Fastify has a first-party Lambda adapter that wraps the framework's
 *    internal request/reply objects around the API Gateway event/context,
 *    so the same codebase runs locally and in Lambda with zero changes.
 *
 * What's NOT included here (would be in a production stack):
 *   - DynamoDB table for bookings (+ IAM policy on the Lambda)
 *   - ElastiCache Redis cluster for capacity caching
 *   - Cognito User Pool for auth
 *   - CloudWatch alarms on 4xx/5xx rates
 *   - WAF for rate limiting
 */
export class GymApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    /* ── Lambda function ─────────────────────────────────────── */

    const handler = new lambda.Function(this, "GymApiHandler", {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "lambda.handler",
      code: lambda.Code.fromAsset("../api/dist"),
      memorySize: 256,
      timeout: cdk.Duration.seconds(10),
      architecture: lambda.Architecture.ARM_64,
      environment: {
        NODE_ENV: "production",
      },
      logRetention: logs.RetentionDays.TWO_WEEKS,
      description: "Gym capacity and booking API (Fastify)",
    });

    /* ── HTTP API Gateway ────────────────────────────────────── */

    const httpApi = new apigw.HttpApi(this, "GymHttpApi", {
      apiName: "GymCapacityApi",
      description: "HTTP API for gym capacity and slot booking",
      corsPreflight: {
        allowOrigins: ["*"],
        allowMethods: [apigw.CorsHttpMethod.GET, apigw.CorsHttpMethod.POST],
        allowHeaders: ["Content-Type", "Authorization"],
      },
    });

    const lambdaIntegration = new integrations.HttpLambdaIntegration(
      "GymLambdaIntegration",
      handler,
    );

    // Catch-all route — Fastify handles internal routing
    httpApi.addRoutes({
      path: "/{proxy+}",
      methods: [apigw.HttpMethod.GET, apigw.HttpMethod.POST],
      integration: lambdaIntegration,
    });

    /* ── Outputs ─────────────────────────────────────────────── */

    new cdk.CfnOutput(this, "ApiUrl", {
      value: httpApi.apiEndpoint,
      description: "Base URL of the gym capacity API",
    });
  }
}
