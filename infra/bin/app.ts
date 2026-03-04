#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { GymApiStack } from "../lib/gym-api-stack";

const app = new cdk.App();

new GymApiStack(app, "GymApiStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? "us-east-1",
  },
  description: "Gym capacity API — Lambda + API Gateway",
});
