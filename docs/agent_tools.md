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
- **Function name:** `canvas_request_excalidraw_operations`
- **Description:**
  > Forward complex Excalidraw requests to the dedicated MCP server. Use when you need precise element placement, updates, or batch operations. The tool returns normalized data which the application converts into canvas updates.
- **Parameters:**
  ```json
  {
    "type": "object",
    "properties": {
      "operation": {
        "type": "string",
        "enum": ["create_elements", "update_element", "delete_element", "clear_scene"],
        "description": "MCP operation to invoke"
      },
      "payload": {
        "type": "object",
        "description": "Operation-specific payload forwarded to the MCP server"
      }
    },
    "required": ["operation"],
    "additionalProperties": false
  }
  ```
- **Usage tips:**
  - Always include coordinates, dimensions, and colors when creating elements.
  - Ensure `payload.id` is provided for update or delete operations.
  - Prefer this tool over `canvas_patch_excalidraw` when precise control is required and the MCP server is available.

## 4. AWS Knowledge Tools (MCP-backed)

These definitions are exposed when the hosted AWS Knowledge MCP server is enabled. They allow the agent to retrieve authoritative AWS documentation during the conversation.

- **Function name:** `aws_knowledge_search`
  - **Description:** Search AWS documentation, blogs, and guidance for resources related to the user’s query.
  - **Parameters:**
    ```json
    {
      "type": "object",
      "properties": {
        "search_phrase": {
          "type": "string",
          "description": "Search phrase to submit to the AWS documentation index"
        },
        "limit": {
          "type": "integer",
          "minimum": 1,
          "maximum": 10,
          "description": "Optional cap on returned results"
        }
      },
      "required": ["search_phrase"],
      "additionalProperties": false
    }
    ```

- **Function name:** `aws_knowledge_read`
  - **Description:** Fetch and convert a specific AWS documentation page into markdown so the agent can pull verbatim guidance.
  - **Parameters:**
    ```json
    {
      "type": "object",
      "properties": {
        "url": {
          "type": "string",
          "description": "AWS documentation URL (docs.aws.amazon.com or aws.amazon.com)"
        },
        "start_index": {
          "type": "integer",
          "minimum": 0,
          "description": "Starting character offset for pagination"
        },
        "max_length": {
          "type": "integer",
          "minimum": 500,
          "maximum": 50000,
          "description": "Maximum number of characters to return"
        }
      },
      "required": ["url"],
      "additionalProperties": false
    }
    ```

- **Function name:** `aws_knowledge_recommend`
  - **Description:** Request additional AWS documentation recommendations related to the provided page.
  - **Parameters:**
    ```json
    {
      "type": "object",
      "properties": {
        "url": {
          "type": "string",
          "description": "Seed URL used to generate recommendations"
        }
      },
      "required": ["url"],
      "additionalProperties": false
    }
    ```

- **Usage tips:**
  - Invoke `aws_knowledge_search` before giving detailed answers to confirm up-to-date guidance.
  - Use `aws_knowledge_read` to quote specific sections or obtain code samples.
  - Use `aws_knowledge_recommend` to suggest follow-up reading or discover recent announcements.

## 5. Tavily Web Intelligence (Hosted MCP)

These tools connect to the hosted Tavily MCP server for live web search, extraction, crawling, and site mapping.

- **Function name:** `tavily_search`
  - **Description:** Real-time web search across the public internet.
  - **Parameters:**
    ```json
    {
      "type": "object",
      "properties": {
        "query": {
          "type": "string",
          "description": "Search query to send to Tavily"
        },
        "max_results": {
          "type": "integer",
          "minimum": 1,
          "maximum": 10,
          "description": "Cap the number of results (default 5)"
        },
        "search_depth": {
          "type": "string",
          "enum": ["basic", "advanced"],
          "description": "Use advanced when the user explicitly requests deeper research"
        },
        "topic": {
          "type": "string",
          "enum": ["general", "news", "finance"],
          "description": "Map the request to the relevant Tavily domain agent"
        },
        "time_range": {
          "type": "string",
          "enum": ["day", "week", "month", "year", "d", "w", "m", "y"],
          "description": "Restrict results to a recent window"
        },
        "include_domains": {
          "type": "array",
          "items": { "type": "string" },
          "description": "Domains to prioritise (comma-separated string also accepted)"
        },
        "exclude_domains": {
          "type": "array",
          "items": { "type": "string" },
          "description": "Domains to avoid"
        },
        "include_raw_content": {
          "type": "boolean",
          "description": "Return cleaned HTML for each result"
        }
      },
      "required": ["query"],
      "additionalProperties": false
    }
    ```
- **Usage tips:** Kick off with search whenever the user asks for current information or when the knowledge cutoff might be a concern.

- **Function name:** `tavily_extract`
  - **Parameters:**
    ```json
    {
      "type": "object",
      "properties": {
        "urls": {
          "type": "array",
          "items": { "type": "string" },
          "description": "URLs to summarise or read"
        },
        "extract_depth": {
          "type": "string",
          "enum": ["basic", "advanced"],
          "description": "Advanced handles richer scraping"
        },
        "format": {
          "type": "string",
          "enum": ["markdown", "text"],
          "description": "Return format (markdown recommended)"
        },
        "include_images": {
          "type": "boolean",
          "description": "Include discovered images"
        }
      },
      "required": ["urls"],
      "additionalProperties": false
    }
    ```

- **Function name:** `tavily_crawl`
  - **Description:** Depth-first crawl that returns content from multiple pages under a root.
  - **Key parameters:** `url`, optional `max_depth`, `limit`, `instructions`, `select_paths`, `exclude_paths`, `allow_external`.

- **Function name:** `tavily_map`
  - **Description:** Generates a site map (graph of URLs) without extracting page bodies.
  - **Key parameters:** `url`, `max_depth`, `max_breadth`, `limit`, inclusion/exclusion pattern controls.

- **Usage tips:**
  - Chain `tavily_search` → `tavily_extract` to get citations from top results.
  - Use `tavily_map` to plan a crawl, then `tavily_crawl` for deep-dives.
  - Respect user constraints (domains to include/exclude, desired depth) by wiring them into the arguments.
