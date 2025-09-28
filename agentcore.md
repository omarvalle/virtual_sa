Amazon Bedrock AgentCore enables you to deploy and operate highly effective agents securely, at scale using any framework and model. With Amazon Bedrock AgentCore, developers can accelerate AI agents into production with the scale, reliability, and security, critical to real-world deployment. AgentCore provides tools and capabilities to make agents more effective and capable, purpose-built infrastructure to securely scale agents, and controls to operate trustworthy agents. Amazon Bedrock AgentCore services are composable and work with popular open-source frameworks and any model, so you don’t have to choose between open-source flexibility and enterprise-grade security and reliability.

Services in Amazon Bedrock AgentCore

Amazon Bedrock AgentCore includes the following modular Services that you can use together or independently:

Amazon Bedrock AgentCore Runtime
AgentCore Runtime is a secure, serverless runtime purpose-built for deploying and scaling dynamic AI agents and tools using any open-source framework including LangGraph, CrewAI, and Strands Agents, any protocol, and any model. Runtime was built to work for agentic workloads with industry-leading extended runtime support, fast cold starts, true session isolation, built-in identity, and support for multi-modal payloads. Developers can focus on innovation while Amazon Bedrock AgentCore Runtime handles infrastructure and security—accelerating time-to-market

Amazon Bedrock AgentCore Identity
AgentCore Identity provides a secure, scalable agent identity and access management capability accelerating AI agent development. It is compatible with existing identity providers, eliminating needs for user migration or rebuilding authentication flows. AgentCore Identity's helps to minimize consent fatigue with a secure token vault and allows you to build streamlined AI agent experiences. Just-enough access and secure permission delegation allow agents to securely access AWS resources and third-party tools and services.

Amazon Bedrock AgentCore Memory
AgentCore Memory makes it easy for developers to build context aware agents by eliminating complex memory infrastructure management while providing full control over what the AI agent remembers. Memory provides industry-leading accuracy along with support for both short-term memory for multi-turn conversations and long-term memory that can be shared across agents and sessions.

Amazon Bedrock AgentCore Code Interpreter
AgentCore Code Interpreter tool enables agents to securely execute code in isolated sandbox environments. It offers advanced configuration support and seamless integration with popular frameworks. Developers can build powerful agents for complex workflows and data analysis while meeting enterprise security requirements.

Amazon Bedrock AgentCore Browser
AgentCore Browser tool provides a fast, secure, cloud-based browser runtime to enable AI agents to interact with websites at scale. It provides enterprise-grade security, comprehensive observability features, and automatically scales— all without infrastructure management overhead.

Amazon Bedrock AgentCore Gateway
Amazon Bedrock AgentCore Gateway provides a secure way for agents to discover and use tools along with easy transformation of APIs, Lambda functions, and existing services into agent-compatible tools. Gateway eliminates weeks of custom code development, infrastructure provisioning, and security implementation so developers can focus on building innovative agent applications.

Amazon Bedrock AgentCore Observability
AgentCore Observability helps developers trace, debug, and monitor agent performance in production through unified operational dashboards. With support for OpenTelemetry compatible telemetry and detailed visualizations of each step of the agent workflow, AgentCore enables developers to easily gain visibility into agent behavior and maintain quality standards at scale.

Common use cases for Amazon Bedrock AgentCore

Equip agents with built-in tools and capabilities

Leverage built-in tools (browser automation and code interpretation) in your agent. Enable agents to seamlessly integrate with internal and external tools and resources. Create agents that can remember interactions with your agent users.

Deploy securely at scale

Securely deploy and scale dynamic AI agents and tools, regardless of framework, protocol, or model choice without managing any underlying resources with seamless agent identity and access management.

Test and monitor agents

Gain deep operational insights with real-time visibility into agents' usage and operational metrics such as token usage, latency, session duration, and error rates.

Are you a first-time Amazon Bedrock AgentCore user?

If you are a first-time user of Amazon Bedrock AgentCore, we recommend that you begin by reading the following sections:

Host agent or tools with Amazon Bedrock AgentCore Runtime

Add memory to your AI agent

Use Amazon Bedrock AgentCore built-in tools to interact with your applications

Amazon Bedrock AgentCore Gateway: Securely connect tools and other resources to your Gateway

For code examples, see https://github.com/awslabs/amazon-bedrock-agentcore-samples/.

Host agent or tools with Amazon Bedrock AgentCore Runtime
 PDF
 RSS
Focus mode
Amazon Bedrock AgentCore is in preview release and is subject to change.

Amazon Bedrock AgentCore Runtime provides a secure, serverless and purpose-built hosting environment for deploying and running AI agents or tools. It offers the following benefits:

Framework agnostic
Runtime lets you transform any local agent code to cloud-native deployments with a few lines of code no matter the underlying framework. Works seamlessly with popular frameworks like LangGraph, Strands, and CrewAI. You can also leverage it with custom agents that don't use a specific framework.

Model flexibility
Runtime works with any Large Language Model, such as models offered by Amazon Bedrock, Anthropic Claude, Google Gemini, and OpenAI.

Protocol support
Runtime lets agents communicate with other agents and tools via Model Context Protocol (MCP).

Extended execution time
Runtime supports both real-time interactions and long-running workloads up to 8 hours, enabling complex agent reasoning and asynchronous workloads that may involve multi-agent collaboration or extended problem-solving sessions.

Enhanced payload handling
Runtime can process 100MB payloads enabling seamless processing of multiple modalities (text, images, audio, video), with rich media content or large datasets.

Session isolation
In Runtime, each user session runs in a dedicated microVM with isolated CPU, memory, and filesystem resources. This helps create complete separation between user sessions, safeguarding stateful agent reasoning processes and helps prevent cross-session data contamination. After session completion, the entire microVM is terminated and memory is sanitized, delivering deterministic security even when working with non-deterministic AI processes.

Consumption-based pricing model
Runtime implements consumption-based pricing that charges only for resources actually consumed. Unlike allocation-based models that require pre-selecting resources, Runtime dynamically provisions what's needed without requiring right-sizing. The service aligns CPU billing with actual active processing - typically eliminating charges during I/O wait periods when agents are primarily waiting for LLM responses - while continuously maintaining your session state.

Built-in authentication
Runtime, powered by Amazon Bedrock AgentCore Identity, assigns distinct identities to AI agents and seamlessly integrates with your corporate identity provider such as Okta, Microsoft Entra ID, or Amazon Cognito, enabling your end users to authenticate into only the agents they have access to. In addition, Runtime lets outbound authentication flows to securely access third-party services like Slack, Zoom, and GitHub - whether operating on behalf of users or autonomously (using either OAuth or API keys).

Agent-specific observability
Runtime provides specialized built-in tracing that captures agent reasoning steps, tool invocations, and model interactions, providing clear visibility into agent decision-making processes, a critical capability for debugging and auditing AI agent behaviors.

Unified set of agent-specific capabilities
Runtime is delivered through a single, comprehensive SDK that provides streamlined access to the complete Amazon Bedrock AgentCore capabilities including Memory, Tools, and Gateway. This integrated approach eliminates the integration work typically required when building equivalent agent infrastructure from disparate components.

Add memory to your AI agent
 PDF
 RSS
Focus mode
Amazon Bedrock AgentCore is in preview release and is subject to change.

AgentCore Memory lets your AI agents deliver intelligent, context-aware, and personalized interactions by maintaining both immediate and long-term knowledge. AgentCore Memory offers two types of memory:

Short-term memory: Stores conversations to keep track of immediate context.

For example, imagine your coding agent is helping you debug. During the session, you ask it to check variable names, correct syntax errors, and find unused imports. The agent stores the interactions as short term events in AgentCore Memory. Later the agent can retrieve the events so that it can converse without you having to repeat previous information.

Short-term memory captures raw interaction events, maintains immediate context, powers real-time conversations, enriches long-term memory systems, and enables building advanced contextual solutions such as multi-step task completion, in-session knowledge accumulation, and context-aware decision making.

Long-term memory: Stores extracted insights - such as user preferences, semantic facts, and summaries - for knowledge retention across sessions.

User Preferences – Think of your coding agent which uses AgentCore Memory as your long-time coding partner. Over many days, it notices you always write clean code with comments, prefer snake_case naming, use pandas for data analysis, and test functions before finalizing them. Next time, even after many sessions, when you ask it to write a data analysis function, it automatically follows these preferences stored in AgentCore Memory without you telling it again.

Semantic facts – The coding agent also remembers that “Pandas is a Python Library for data analysis and handling tables”. When you ask, “Which library is best for table data?”, it immediately suggests Pandas because it understands what Pandas are from the semantic memory.

Summary – The coding agent generates session summaries such as “During this interaction, you created a data cleaning function, fixed two syntax errors, and tested your linear regression model.” These summaries both track completed work and compress conversation context, enabling efficient reference to past activities while optimizing context window usage.

Memory AgentCore Memory

You can use AgentCore Memory with the AWS SDK or with any popular agent framework, such as Strands Agents. For code examples, see https://github.com/awslabs/amazon-bedrock-agentcore-samples/tree/main/01-tutorials/04-AgentCore-memory.

Use Amazon Bedrock AgentCore built-in tools to interact with your applications
 PDF
 RSS
Focus mode
Amazon Bedrock AgentCore is in preview release and is subject to change.

Amazon Bedrock AgentCore provides several built-in tools to enhance your development and testing experience. These tools are designed to help you interact with your application in various ways, providing capabilities for code execution and web browsing within the Amazon Bedrock AgentCore environment.

Built-in tools are a key component of Amazon Bedrock AgentCore, allowing you to enhance agents by adding hosted capabilities such as browser use and code execution. You can execute your code in a secure environment. This is critical in Agentic AI applications where the agents may execute arbitrary code that can lead to data compromise or security risks.

These tools are fully managed by Amazon Bedrock AgentCore, eliminating the need to set up and maintain your own tool infrastructure.

Built-in Tools Overview

Amazon Bedrock AgentCore offers the following built-in tools:

Code Interpreter
A secure environment for executing code and analyzing data. The Amazon Bedrock AgentCore Code Interpreter supports multiple programming languages including Python, TypeScript, and JavaScript, allowing you to process data and perform calculations within the AgentCore environment.

Browser Tool
A secure, isolated browser environment that allows you to interact with and test web applications while minimizing potential risks to your system, access online resources, and perform web-based tasks.

These built-in tools are part of AgentCore's build phase, alongside other components such as Memory, Gateways, and Identity. They provide secure, managed capabilities that can be integrated into your agents without requiring additional infrastructure setup.

Security and Access Control
Built-in tools in Amazon Bedrock AgentCore are designed with security in mind. They provide:

Isolated execution environments to help prevent cross-contamination

Configurable session timeouts to limit resource usage

Integration with IAM for access control

Network security controls to help restrict external access

Key components
The built-in tools are designed with a secure, scalable architecture that integrates with the broader AgentCore services. Each tool operates within its own isolated environment to support security and resource management.

Tool Resources
The base configuration for a tool, including network settings, permissions, and feature configuration. Tool resources are created once and can be used for multiple sessions.

Sessions
Temporary runtime environments created from tool resources. Sessions have a defined lifecycle and timeout period, and they maintain state during their lifetime.

APIs
Each tool provides APIs for creating and managing tool resources, starting and stopping sessions, and interacting with the tool's functionality.

Integrating built-in tools with Agents
Built-in tools can be integrated with your agents to enhance their capabilities. The integration process involves:

Creating a tool resource (Code Interpreter or Browser Tool) or using a system resource

Creating a session to interact with the tool

Using the tool's API to perform operations

Terminating the session when finished

Amazon Bedrock AgentCore Gateway: Securely connect tools and other resources to your Gateway
 PDF
 RSS
Focus mode
Amazon Bedrock AgentCore is in preview release and is subject to change.

Amazon Bedrock AgentCore Gateway provides an easy and secure way for developers to build, deploy, discover, and connect to tools at scale. AI agents need tools to perform real-world tasks—from querying databases to sending messages to analyzing documents. With Gateway, developers can convert APIs, Lambda functions, and existing services into Model Context Protocol (MCP)-compatible tools and make them available to agents through Gateway endpoints with just a few lines of code. Gateway supports OpenAPI, Smithy, and Lambda as input types, and is the only solution that provides both comprehensive ingress authentication and egress authentication in a fully-managed service. Gateway also provides 1-click integration with several popular tools such as Salesforce, Slack, Jira, Asana, and Zendesk. Gateway eliminates weeks of custom code development, infrastructure provisioning, and security implementation so developers can focus on building innovative agent applications.

Key benefits

Simplify tool development and integration
Transform existing enterprise resources into agent-ready tools in just a few lines of code. Instead of spending months writing custom integration code and managing infrastructure, developers can focus on building differentiated agent capabilities while Gateway handles the undifferentiated heavy lifting of tool management and security at enterprise scale. Gateway also provides 1-click integration with several popular tools such as Salesforce, Slack, Jira, Asana, and Zendesk.

Accelerate agent development through unified access
Enable your agents to discover and use tools through a single, secure endpoint. By combining multiple tool sources—from APIs to Lambda functions—into one unified interface, developers can build and scale agent workflows faster without managing multiple tool connections or reimplementing integrations.

Scale with confidence through intelligent tool discovery
As your tool collection grows, help your agents find and use the right tools through contextual search. Built-in semantic search capabilities help agents effectively utilize available tools based on their task context, improving agent performance and reducing development complexity at scale.

Comprehensive authentication
Manage both inbound authentication (verifying agent identity) and outbound authentication (connecting to tools) in a single service. Handle OAuth flows, token refresh, and secure credential storage for third-party services.

Framework compatibility
Work with popular open-source frameworks including CrewAI, LangGraph, LlamaIndex, and Strands Agents. Integrate with any model while maintaining enterprise-grade security and reliability.

Serverless infrastructure
Eliminate infrastructure management with a fully managed service that automatically scales based on demand. Built-in observability and auditing capabilities simplify monitoring and troubleshooting.

Key capabilities

Gateway provides the following key capabilities:

Security Guard - Manages OAuth authorization to ensure only valid users and agents can access tools and resources.

Translation - Converts agent requests using protocols like Model Context Protocol (MCP) into API requests and Lambda invocations, eliminating the need to manage protocol integration or version support.

Composition - Combines multiple APIs, functions, and tools into a single MCP endpoint for streamlined agent access.

Secure Credential Exchange - Handles credential injection for each tool, enabling agents to use tools with different authentication requirements seamlessly.

Semantic Tool Selection - Enables agents to search across available tools to find the most appropriate ones for specific contexts, allowing agents to leverage thousands of tools while minimizing prompt size and reducing latency.

Infrastructure Manager - Provides a serverless solution with built-in observability and auditing, eliminating infrastructure management overhead.
Get started with the Amazon Bedrock AgentCore starter toolkit
 PDF
 RSS
Focus mode
Amazon Bedrock AgentCore is in preview release and is subject to change.

This tutorial shows you how to use the Amazon Bedrock AgentCore starter toolkit to deploy an agent to an AgentCore Runtime.

The starter toolkit is a Command Line Interface (CLI) toolkit that you can use to deploy AI agents to an AgentCore Runtime. You can use the toolkit with popular Python agent frameworks, such as LangGraph or Strands Agents. This tutorial uses Strands Agents.

Topics
Prerequisites

Step 1: Enable observability for your agent

Step 2: Install and create your agent

Step 3: Test locally

Step 4: Deploy to AgentCore Runtime

Step 5: Invoke your agent

Step 6: Clean up

Common issues

Advanced options (optional)

Prerequisites

Before you start, make sure you have:

AWS Account with credentials configured. To configure your AWS credentials, see Configuration and credential file settings in the AWS CLI.

Python 3.10+ installed

Boto3 installed

AWS Permissions: To create and deploy an agent with the starter toolkit, you must have appropriate permissions. For information, see Use the starter toolkit.

Model access: Anthropic Claude Sonnet 4.0 enabled in the Amazon Bedrock console. For information about using a different model with the Strands Agents see the Model Providers section in the Strands Agents SDK documentation.

Step 1: Enable observability for your agent

Amazon Bedrock AgentCore Observability helps you trace, debug, and monitor agents that you host in AgentCore Runtime. First enable CloudWatch Transaction Search by following the instructions at Enabling AgentCore runtime observability. To observe your agent, see View observability data for your Amazon Bedrock AgentCore agents.

Step 2: Install and create your agent

Upgrade pip to the latest version:


pip install --upgrade pip
Install the following required packages:

bedrock-agentcore - The Amazon Bedrock AgentCore SDK for building AI agents

strands-agents - The Strands Agents SDK

bedrock-agentcore-starter-toolkit - The Amazon Bedrock AgentCore starter toolkit



pip install bedrock-agentcore strands-agents bedrock-agentcore-starter-toolkit
        
Create a source file for your agent code named my_agent.py. Add the following code:



from bedrock_agentcore import BedrockAgentCoreApp
from strands import Agent

app = BedrockAgentCoreApp()
agent = Agent()

@app.entrypoint
def invoke(payload):
    """Your AI agent function"""
    user_message = payload.get("prompt", "Hello! How can I help you today?")
    result = agent(user_message)
    return {"result": result.message}

if __name__ == "__main__":
    app.run()
        
Create requirements.txt and add the following:



bedrock-agentcore
strands-agents
        
Step 3: Test locally

Open a terminal window and start your agent with the following command:


python my_agent.py
Test your agent by opening another terminal window and enter the following command:


curl -X POST http://localhost:8080/invocations \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Hello!"}'
Success: You should see a response like {"result": "Hello! I'm here to help..."}

In the terminal window that's running the agent, enter Ctrl+c to stop the agent.

Step 4: Deploy to AgentCore Runtime

Configure and deploy your agent to AWS using the starter toolkit. The toolkit automatically creates the IAM execution role, container image, and Amazon Elastic Container Registry repository needed to host the agent in AgentCore Runtime. By default the toolkit hosts the agent in an AgentCore Runtime that is in the us-west-2 AWS Region.

Configure the agent. Use the default values:


agentcore configure -e my_agent.py
The configuration information is stored in a hidden file named bedrock_agentcore.yaml.

Host your agent in AgentCore Runtime:


agentcore launch
In the output from agentcore launch note the following:

The Amazon Resource Name (ARN) of the agent. You need it to invoke the agent with the InvokeAgentRuntime operation.

The location of the logs in Amazon CloudWatch Logs

If the deployment fails check for Common issues.

Test your deployed agent:


agentcore invoke '{"prompt": "tell me a joke"}'
If you see a joke in the response, your agent is now running in an AgentCore Runtime and can be invoked. If not, check for Common issues.

For other deployment options, see Deployment modes.

Step 5: Invoke your agent

You can invoke the agent using the AWS SDK InvokeAgentRuntime operation. To call InvokeAgentRuntime, you need the ARN of the agent that you noted in Step 4: Deploy to AgentCore Runtime. You can also get the ARN from the bedrock_agentcore: section of the bedrock_agentcore.yaml (hidden) file that the toolkit creates.

Use the following boto3 (AWS SDK) code to invoke your agent. Replace Agent ARN with the ARN of your agent. Make sure that you have bedrock-agentcore:InvokeAgentRuntime permissions.

Create a file named invoke_agent.py and add the following code:


import json
import uuid
import boto3
  
agent_arn = "Agent ARN"
prompt = "Tell me a joke"

# Initialize the AgentCore client
agent_core_client = boto3.client('bedrock-agentcore')
  
# Prepare the payload
payload = json.dumps({"prompt": prompt}).encode()
  
# Invoke the agent
response = agent_core_client.invoke_agent_runtime(
    agentRuntimeArn=agent_arn,
    payload=payload
)

content = []
for chunk in response.get("response", []):
    content.append(chunk.decode('utf-8'))
print(json.loads(''.join(content)))
Open a terminal window and run the code with the following command:


python invoke_agent.py
If succesful, you should see a joke in the response. If the call fails, check the logs that you noted in Step 4: Deploy to AgentCore Runtime.

If you plan on integrating your agent with OAuth, you can't use the AWS SDK to call InvokeAgentRuntime. Instead, make a HTTPS request to InvokeAgentRuntime. For more information, see Authenticate and authorize with Inbound Auth and Outbound Auth.

Step 6: Clean up

If you no longer want to host the agent in the AgentCore Runtime, use the AgentCore console or the DeleteAgentRuntime AWS SDK operation to delete the AgentCore Runtime.

Common issues

Common issues and solutions when getting started with the Amazon Bedrock AgentCore starter toolkit. For more troubleshooting information, see Troubleshoot AgentCore Runtime.

Permission denied errors
Verify your AWS credentials and permissions:

Verify AWS credentials: aws sts get-caller-identity

Check you have the required policies attached

Review caller permissions policy for detailed requirements

Docker not found warnings
You can ignore this warning:

Ignore this! Default deployment uses CodeBuild (no Docker needed)

Only install Docker/Finch/Podman if you want to use --local or --local-build flags

Model access denied
Enable model access in the Bedrock console:

Enable Anthropic Claude 4.0 in the Bedrock console

Make sure you're in the correct AWS region (us-west-2 by default)

CodeBuild build error
Check build logs and permissions:

Check CodeBuild project logs in AWS console

Verify your caller permissions include CodeBuild access

Advanced options (optional)

The starter toolkit has advanced configuration options for different deployment modes and custom IAM roles. For more information, see Runtime commands for the starter toolkit.

Deployment modes
Choose the right deployment approach for your needs:

Default: CodeBuild + Cloud Runtime (RECOMMENDED)
Suitable for production, managed environments, teams without Docker:



agentcore launch  # Uses CodeBuild (no Docker needed)
            
Local Development
Suitable for development, rapid iteration, debugging:



agentcore launch --local  # Build and run locally (requires Docker/Finch/Podman)
            
Hybrid: Local Build + Cloud Runtime
Suitable for teams with Docker expertise needing build customization:



agentcore launch --local-build  # Build locally, deploy to cloud (requires Docker/Finch/Podman)
            
Custom execution role
Use an existing IAM role:



agentcore configure -e my_agent.py --execution-role arn:aws:iam::111122223333:role/MyRole
            