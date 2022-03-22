import { 
  aws_codebuild,
  aws_codecommit, 
  aws_codepipeline, 
  aws_codepipeline_actions, 
  aws_iam,
  Stack,
  StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';

// pipeline stack
export class CodePipelineStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props); 

    // codebuild role to push into ecr 
    const codeBuildRole = new aws_iam.Role(
      this,
      'IamRoleForCodeBuildToPushEcr',
      {
        assumedBy: new aws_iam.ServicePrincipal('codebuild.amazonaws.com')
      }
    )

    codeBuildRole.attachInlinePolicy(
      new aws_iam.Policy(
        this,
        'PolicyForCodeBuildToPushEcr',
        {
          statements: [
            new aws_iam.PolicyStatement(
              {
                effect: aws_iam.Effect.ALLOW,
                actions: ['ecr:*'],
                resources:['*']
              }
            ),
            new aws_iam.PolicyStatement(
              {
                effect: aws_iam.Effect.ALLOW,
                actions: ['ssm:*'],
                resources: ['*']
              }
            )
          ]
        }
      )
    )

    // code commit 
    const repo = aws_codecommit.Repository.fromRepositoryName(
      this, 
      'CodeCommitRepository', 
      'arm-codebuild-lambda'
    )

    // cdk build project 
    const cdkBuildProject = new aws_codebuild.PipelineProject(
      this,
      'CdkBuild',
      {
        projectName: 'CdkBuild',
        environment: {
          privileged: true,
          buildImage: aws_codebuild.LinuxBuildImage.STANDARD_5_0,
          computeType: aws_codebuild.ComputeType.MEDIUM
        },
        buildSpec: aws_codebuild.BuildSpec.fromObject({
          version: '0.2',
          phases: {
            pre_build: {
              commands: [
                'npm install -g aws-cdk',
                'npm install',
                'cdk --version'
              ]
            },
            build: {
              commands: [
                'npm run build',
                'npm run cdk synth -- -o dist'
              ]
            }
          },
          artifacts: {
            'base-directory': 'dist',
            files: [
              '*.template.json'
            ]
          }
        })
      }
    )
    // code build x86 lambda image 
    const buildX86EcrProject = new aws_codebuild.PipelineProject(
      this,
      'CodeBuildX86', 
      {
        role: codeBuildRole,
        projectName: 'BuildX86EcrImageForLambda', 
        environmentVariables: {
          ACCOUNT_ID: {
            value: this.account
          },
          ECR_REPO: {
            value: 'x86-image-for-lambda'
          },
          IMAGE_TAG_SSM: {
            value: 'X86BuildLambdaImageId'
          }
        },
        environment: {
          buildImage: aws_codebuild.LinuxBuildImage.STANDARD_5_0,
          privileged: true,
          computeType: aws_codebuild.ComputeType.MEDIUM
        },
        buildSpec: aws_codebuild.BuildSpec.fromObject({
          version: '0.2',
          phases: {
            pre_build: {
              commands: [
                'aws ecr get-login-password --region ap-southeast-1 | docker login --username AWS --password-stdin ${ACCOUNT_ID}.dkr.ecr.ap-southeast-1.amazonaws.com'
              ]
            },
            build: {
              commands: [
                'docker build -t  ${ECR_REPO}:${CODEBUILD_RESOLVED_SOURCE_VERSION} -f ./lib/lambda/Dockerfile ./lib/lambda/',
                'docker tag ${ECR_REPO}:${CODEBUILD_RESOLVED_SOURCE_VERSION} ${ACCOUNT_ID}.dkr.ecr.ap-southeast-1.amazonaws.com/${ECR_REPO}:${CODEBUILD_RESOLVED_SOURCE_VERSION}'
              ]
            },
            post_build: {
              commands: [
                'aws ssm put-parameter --name ${IMAGE_TAG_SSM} --type String --value ${CODEBUILD_RESOLVED_SOURCE_VERSION} --overwrite',
                'docker push ${ACCOUNT_ID}.dkr.ecr.ap-southeast-1.amazonaws.com/${ECR_REPO}:${CODEBUILD_RESOLVED_SOURCE_VERSION}'
              ]
            }
          }
        })
      }
    )


    // code build project 
    const buildProject = new aws_codebuild.PipelineProject(
      this,
      'CodeBuild', 
      {
        role: codeBuildRole,
        projectName: 'BuildArmEcrImageForLambda', 
        environmentVariables: {
          ACCOUNT_ID: {
            value: this.account
          },
          ECR_REPO: {
            value: 'arm-image-for-lambda'
          },
          IMAGE_TAG_SSM: {
            value: 'ArmBuildLambdaImageTagId'
          }
        },
        environment: {
          buildImage: aws_codebuild.LinuxArmBuildImage.AMAZON_LINUX_2_STANDARD_2_0,
          privileged: true,
          computeType: aws_codebuild.ComputeType.SMALL
        },
        buildSpec: aws_codebuild.BuildSpec.fromObject({
          version: '0.2',
          phases: {
            pre_build: {
              commands: [
                'aws ecr get-login-password --region ap-southeast-1 | docker login --username AWS --password-stdin ${ACCOUNT_ID}.dkr.ecr.ap-southeast-1.amazonaws.com'
              ]
            },
            build: {
              commands: [
                'docker build -t  ${ECR_REPO}:${CODEBUILD_RESOLVED_SOURCE_VERSION} -f ./lib/lambda/Dockerfile ./lib/lambda/',
                'docker tag ${ECR_REPO}:${CODEBUILD_RESOLVED_SOURCE_VERSION} ${ACCOUNT_ID}.dkr.ecr.ap-southeast-1.amazonaws.com/${ECR_REPO}:${CODEBUILD_RESOLVED_SOURCE_VERSION}'
              ]
            },
            post_build: {
              commands: [
                'aws ssm put-parameter --name ${IMAGE_TAG_SSM} --type String --value ${CODEBUILD_RESOLVED_SOURCE_VERSION} --overwrite',
                'docker push ${ACCOUNT_ID}.dkr.ecr.ap-southeast-1.amazonaws.com/${ECR_REPO}:${CODEBUILD_RESOLVED_SOURCE_VERSION}'
              ]
            }
          }
        })
      }
    )

    // artifact 
    const sourceOutput = new aws_codepipeline.Artifact('SourceOutput')
    const buildOutput = new aws_codepipeline.Artifact('BuildOutput')
    const buildOutputX86 = new aws_codepipeline.Artifact('BuildOutputX86')
    const cdkBuildOutput = new aws_codepipeline.Artifact('CdkBuildOutput')

    // codepipeline 
    const pipeline = new aws_codepipeline.Pipeline(
      this, 
      'CodePipeline',
      {
        pipelineName: 'build-arm-image-for-lambda',
        stages: [
          {
            stageName: 'Source', 
            actions: [
              new aws_codepipeline_actions.CodeCommitSourceAction(
                {
                  actionName: 'CodeCommit',
                  repository: repo,
                  output: sourceOutput
                }
              )
            ]
          },
          {
            stageName: 'Build',
            actions: [
              new aws_codepipeline_actions.CodeBuildAction(
                {
                  actionName: 'BuildEcrImage',
                  project: buildProject,
                  input: sourceOutput,
                  outputs: [buildOutput]
                }
              )
            ]
          },
          {
            stageName: 'BuildX86EcrImage',
            actions: [
              new aws_codepipeline_actions.CodeBuildAction(
                {
                  actionName: 'BuildX86EcrImage',
                  project: buildX86EcrProject,
                  input: sourceOutput,
                  outputs: [buildOutputX86]
                }
              )
            ]
          },
          {
            stageName: 'CdkBuild',
            actions: [
              new aws_codepipeline_actions.CodeBuildAction(
                {
                  actionName: 'CdkBuild',
                  project: cdkBuildProject,
                  input: sourceOutput, 
                  outputs: [cdkBuildOutput]
                }
              )
            ]
          },
          {
            stageName: 'Deploy',
            actions: [
              new aws_codepipeline_actions.CloudFormationCreateUpdateStackAction({
                actionName: 'DeployArmLambda',
                stackName: 'CdkArmCodebuildLambdaStack',
                templatePath: cdkBuildOutput.atPath('CdkArmCodebuildLambdaStack.template.json'),
                adminPermissions: true,
              })
            ]
          }
        ]
      }
    )

  }
}
