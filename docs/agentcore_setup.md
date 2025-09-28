# AWS AgentCore Deployment Blueprint

This guide captures the infrastructure steps we will automate to run the Virtual Solutions Architect agent on Amazon Bedrock AgentCore.

## 1. Prerequisites
- AWS CLI v2 authenticated as an IAM user with Bedrock, IAM, CloudWatch, CodeBuild, and ECR permissions.
- Region: `us-west-2` (update variables if deploying elsewhere).
- OpenAI realtime credentials configured in `.env.local` for voice session handoff.
- GitHub App/installation for pushing infrastructure code (optional but recommended).

## 2. Identity and IAM
1. **Execution Role** – Create an IAM role `AgentCoreExecutionRole` with:
   - Trust policy for `bedrock.amazonaws.com` and `codebuild.amazonaws.com`.
   - Policies granting access to:
     - Bedrock InvokeAgentRuntime, InvokeModel, and AgentCore APIs.
     - AgentCore Gateway tool invocation Lambdas.
     - Secrets Manager (storing OpenAI and GitHub credentials).
     - ECR (pull Claude container image).
2. **Service Role for CodeBuild** – Role `AgentCoreCodeBuildRole` with permissions to build/push container artifacts and read from GitHub/CodeCommit repositories.
3. **S3 Bucket** – `virtual-sa-agentcore-artifacts` for deployment packages, CloudFormation templates, and diagram snapshots.

## 3. AgentCore Runtime Provisioning
- Use the AgentCore starter toolkit (`agentcore launch`) or CloudFormation wrapper to:
  1. Define the agent with memory and tool configuration YAML (checked into repo).
  2. Deploy runtime via CodeBuild + AgentCore default.
  3. Capture the returned Agent ARN and log group names for observability.
- Store outputs in an infrastructure state file (e.g., `infra/agentcore-outputs.json`) for application consumption.

## 4. AgentCore Gateway Tools
- **Canvas Tool** – Lambda/Lambda URL that accepts structured diagram instructions and updates Excalidraw/Mermaid representations. Persist updates to S3 + AgentCore Memory for replay.
- **Deployment Tool** – Lambda or Step Functions workflow that triggers the Anthropic Claude container, passing architecture context and credentials pulled from Secrets Manager.
- **Knowledge Base Search (optional)** – Integrate Bedrock Knowledge Base or Amazon Kendra to surface reference architectures.

Each tool must be registered with the Gateway via `agentcore gateway register-tool`, providing JSON schema for parameters and IAM roles for execution.

## 5. Memory Strategy
- Enable short-term session memory for conversational continuity.
- Configure long-term shared memory buckets for user-specific architecture preferences and past deployments.
- Periodic pruning/archiving jobs via AgentCore Observability metrics to keep token usage efficient.

## 6. Observability
- Enable AgentCore Observability dashboards.
- Publish custom metrics from canvas/deployment tools (latency, error counts) to CloudWatch.
- Configure log retention and alerts:
  - CloudWatch Alarms for high latency or failure responses.
  - SNS topic `virtual-sa-alerts` subscribed by engineering team.

## 7. Anthropic Claude Deployment Container
- Base image: `amazonlinux:2023` with Python 3.11, Node.js 20, AWS CLI v2, and Anthropic SDK.
- Entry script `/opt/claude/bootstrap.sh` to:
  1. Pull architecture plan and diagram from S3.
  2. Validate against compliance rules (custom Python module).
  3. Execute infrastructure-as-code generation (Terraform/CDK) through Claude API prompts.
  4. Commit artifacts to GitHub and trigger CI/CD if required.
- ECR repository `virtual-sa-claude-deployer` hosting tagged images.

## 8. Automation Roadmap
- Author IaC (CloudFormation, CDK, or Terraform) under `infra/` to provision the entire stack.
- Provide npm scripts for deployments:
  - `npm run infra:plan`
  - `npm run infra:deploy`
  - `npm run infra:destroy`
- Integrate GitHub Actions (self-hosted or AWS CodeBuild) for continuous delivery to AgentCore.

This blueprint will evolve as we implement each module; update the document after each milestone to maintain a single source of truth for AWS resources.
