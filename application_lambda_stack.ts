import { 
  aws_apigateway,
  aws_cloudwatch,
  aws_codecommit, 
  aws_ecr,
  aws_lambda,
  aws_ssm,
  Duration,
  Stack,
  StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export class CdkArmCodebuildLambdaStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // x86 lambda 
    const x86_lambda_func = new aws_lambda.Function(
      this,
      'X86LambdaFunction', 
      {
        functionName: 'X86LambdaFunction',
        architecture: aws_lambda.Architecture.X86_64,
        memorySize: 10240,
        timeout: Duration.seconds(10),
        runtime: aws_lambda.Runtime.FROM_IMAGE,
        handler: aws_lambda.Handler.FROM_IMAGE,
        code: aws_lambda.Code.fromEcrImage(
          aws_ecr.Repository.fromRepositoryName(
            this,
            'EcrX86Image',
            'x86-image-for-lambda'
          ),
          {
            tag: aws_ssm.StringParameter.valueForStringParameter(
              this,
              'X86BuildLambdaImageId'
            )
          }
        )
      }
    )

    // arm lambda 
    const arm_lambda_func = new aws_lambda.Function(
      this, 
      'ArmLambdaFunction', 
      {
        functionName: 'ArmLambdaFunction',
        architecture: aws_lambda.Architecture.ARM_64,
        memorySize: 10240,
        timeout: Duration.seconds(10),
        runtime: aws_lambda.Runtime.FROM_IMAGE,
        handler: aws_lambda.Handler.FROM_IMAGE,
        code: aws_lambda.Code.fromEcrImage(
          aws_ecr.Repository.fromRepositoryName(
            this, 
            'EcrArmImage',
            'arm-image-for-lambda'
          ),
          {
            tag: aws_ssm.StringParameter.valueForStringParameter(
              this,
              'ArmBuildLambdaImageTagId'
            )
          }
        )
      }
    )

    // api gateway integration 
    const api_gw = new aws_apigateway.RestApi(
      this,
      'RestApiGatewayArmLambda', 
      {
        restApiName: 'ArmLambdaApi'
      }
    )
    const x86_resource = api_gw.root.addResource('x86-lambda')

    x86_resource.addMethod(
      'GET',
      new aws_apigateway.LambdaIntegration(
        x86_lambda_func
      )
    )

    const arm_resource = api_gw.root.addResource('arm-lambda')

    arm_resource.addMethod(
      'GET',
      new aws_apigateway.LambdaIntegration(
        arm_lambda_func
      )
    )

    // cloudwatch and dashboard 
    const dashboard = new aws_cloudwatch.Dashboard(
      this,
      'ArmAndX86Peformance',
      {
        dashboardName: 'Compare-X86-And-Arm-Lambda'
      }
    )

    dashboard.addWidgets(
      new aws_cloudwatch.TextWidget(
        {
          markdown: 'Dashboard X86 And Arm Lambda',
          height: 1,
          width: 24 
        }
      )
    )

    dashboard.addWidgets(
      new aws_cloudwatch.GraphWidget(
        {
          title: 'Number of Invocation',
          left: [
            x86_lambda_func.metricInvocations(
              {
                statistic: 'sum',
                period: Duration.minutes(1)
              }
            ),
            arm_lambda_func.metricInvocations(
              {
                statistic: 'sum',
                period: Duration.minutes(1)
              }
            )
          ],
          width: 24 
        }
      )
    )

    dashboard.addWidgets(
      new aws_cloudwatch.GraphWidget(
        {
          title: 'Duration Running Time',
          left: [
            x86_lambda_func.metricDuration(
              {
                statistic: 'avg',
                period: Duration.seconds(10)
              }
            ),
            arm_lambda_func.metricDuration(
              {
                statistic: 'avg',
                period: Duration.seconds(10)
              }
            )
          ],
          width: 24
        }
      )
    )

  }
}


//  code commit repository 
export class CodeCommitRepository extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props); 

    const repo  = new aws_codecommit.Repository(
      this, 
      'CodeCommitRepository', 
      {
        repositoryName: 'arm-codebuild-lambda'
      }
    )
  }
}

// ecr repository 
export class EcrRepository extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props); 

    const repo = new aws_ecr.Repository(
      this, 
      'EcrRepository', 
      {
        repositoryName: 'arm-image-for-lambda'
      }
    )
  }
}

//
export class EcrRepositoryX86 extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props); 

    const repo = new aws_ecr.Repository(
      this, 
      'EcrRepositoryX86', 
      {
        repositoryName: 'x86-image-for-lambda'
      }
    )

  }
}
