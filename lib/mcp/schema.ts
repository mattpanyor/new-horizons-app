// Adapter from plain JSON Schema to the Standard Schema shape the MCP SDK's
// registerTool expects.
//
// The SDK is built around validating libraries (Zod, Valibot, ArkType), but the
// tool definitions in ./modules are plain JSON Schema — they are documentation
// for the model as much as validation, and keeping them declarative means a
// module file has no library dependency.
//
// `validate` deliberately passes values through. Argument checking is not
// skipped, it happens one layer down: every handler delegates to a service
// function that validates its own input and returns a typed error. Duplicating
// that here would mean two sources of truth for the same rules.

import type { StandardSchemaWithJSON } from "@modelcontextprotocol/server";

export function jsonSchema(
  schema: Record<string, unknown>
): StandardSchemaWithJSON<Record<string, unknown>, Record<string, unknown>> {
  return {
    "~standard": {
      version: 1,
      vendor: "new-horizons",
      validate: (value: unknown) => ({ value: (value ?? {}) as Record<string, unknown> }),
      jsonSchema: {
        input: () => schema,
        output: () => schema,
      },
    },
  };
}
