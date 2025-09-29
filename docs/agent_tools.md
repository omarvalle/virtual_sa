# Agent Tool Specification

These tool definitions will guide the voice agent when interacting with the canvas services. The same schema is used for both in-app command bridging and AWS AgentCore tool registration.

## 1. Mermaid Diagram Tool

- **Function name:** `canvas_update_mermaid`
- **Description:**
  > Generate or update a Mermaid diagram for the active architecture scenario. Use when the user requests high-level flows, service interactions, or deployment steps that are not AWS icon-specific. Always return the entire diagram, not a diff.
- **Parameters (JSON Schema):**
  ```json
  {
    "type": "object",
    "properties": {
      "title": {
        "type": "string",
        "description": "Human-readable title describing the diagram context"
      },
      "diagram": {
        "type": "string",
        "description": "Complete Mermaid definition (e.g., graph TD ...).",
        "minLength": 10
      },
      "focus": {
        "type": "string",
        "description": "Optional node or flow that should be highlighted in the UI"
      }
    },
    "required": ["diagram"],
    "additionalProperties": false
  }
  ```
- **Usage tips for the agent:**
  - If a diagram already exists, rewrite the full Mermaid code with updates incorporated.
  - Keep indentation consistent for readability.
  - Prefer sequence diagrams for time-ordered flows, and `graph TD`/`graph LR` for topologies.

## 2. Excalidraw Canvas Tool

- **Function name:** `canvas_patch_excalidraw`
- **Description:**
  > Apply incremental updates to the shared Excalidraw canvas. Use for free-form sketches, annotations, or when the user wants to move existing elements.
- **Parameters:**
  ```json
  {
    "type": "object",
    "properties": {
      "operations": {
        "type": "array",
        "description": "Series of operations matching Excalidraw's scene update format",
        "items": {
          "type": "object",
          "oneOf": [
            {
              "type": "object",
              "properties": {
                "kind": {
                  "const": "add_elements"
                },
                "elements": {
                  "type": "array",
                  "items": {
                    "type": "object",
                    "properties": {
                      "type": {
                        "enum": ["rectangle", "ellipse", "diamond", "arrow", "text"]
                      },
                      "x": { "type": "number" },
                      "y": { "type": "number" },
                      "width": { "type": "number" },
                      "height": { "type": "number" },
                      "text": { "type": "string" }
                    },
                    "required": ["type", "x", "y"],
                    "additionalProperties": true
                  },
                  "minItems": 1
                }
              },
              "required": ["kind", "elements"],
              "additionalProperties": false
            },
            {
              "type": "object",
              "properties": {
                "kind": { "const": "update_element" },
                "id": { "type": "string" },
                "props": { "type": "object" }
              },
              "required": ["kind", "id", "props"],
              "additionalProperties": false
            },
            {
              "type": "object",
              "properties": {
                "kind": { "const": "remove_element" },
                "id": { "type": "string" }
              },
              "required": ["kind", "id"],
              "additionalProperties": false
            },
            {
              "type": "object",
              "properties": {
                "kind": { "const": "clear_scene" }
              },
              "required": ["kind"],
              "additionalProperties": false
            }
          ]
        },
        "minItems": 1
      },
      "summary": {
        "type": "string",
        "description": "Short description of what changed for the change log"
      }
    },
    "required": ["operations"],
    "additionalProperties": false
  }
  ```
- **Usage tips:**
  - Prefer Mermaid when changes are purely structural. Use Excalidraw tool for spatial layouts, zones, or when the user explicitly requests sketches.

## 3. AWS Diagram Tool (MCP-backed)

- **Function name:** `canvas_update_aws_diagram`
- **Description:**
  > Request AWS Diagram MCP to render an AWS-specific architecture view. Use when the user wants official AWS icons or is focused on service-specific topology.
- **Parameters:**
  ```json
  {
    "type": "object",
    "properties": {
      "prompt": {
        "type": "string",
        "description": "Detailed description of the AWS architecture to render"
      },
      "layout": {
        "type": "string",
        "enum": ["diagram", "network", "serverless", "custom"],
        "description": "Preferred layout style"
      },
      "output_format": {
        "type": "string",
        "enum": ["svg", "png"],
        "default": "svg"
      }
    },
    "required": ["prompt"],
    "additionalProperties": false
  }
  ```
- **Usage tips:**
  - Include key services, regions, availability zones, and data flows in the prompt.
  - The resulting asset will be stored and referenced in the canvas; ensure subsequent comments acknowledge the AWS diagram.

## Prompt Guidance Snippet

```
You have access to canvas tools that update the shared workspace. Use them proactively when the user asks for diagrams, architecture visuals, or updates.

Mermaid tool (`canvas.update_mermaid`) is best for quick topology sketches, sequence flows, or any non-AWS-specific diagrams.

Excalidraw tool (`canvas.patch_excalidraw`) is for free-form drawings, annotations, or moving existing elements.

AWS Diagram tool (`canvas.update_aws_diagram`) produces official AWS iconography via the AWS Diagram MCP server; prefer it when the user wants AWS service diagrams or icon accuracy.

Each time you call a tool, summarize the change verbally for the user.
```

We'll embed this schema in our server configuration and later in AgentCore's Gateway registration.
