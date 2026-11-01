import { zValidator } from "@hono/zod-validator";
import type { ZodTypeAny } from "zod";

/**
 * JSON body validator that returns errors in the API's standard
 * `{ error: { message } }` shape (first issue as the message).
 */
export function validateJson<T extends ZodTypeAny>(schema: T) {
  return zValidator("json", schema as any, (result, c) => {
    if (!result.success) {
      const issue = result.error.issues[0];
      const field = issue?.path?.length ? `${issue.path.join(".")}: ` : "";
      return c.json(
        {
          error: {
            message: issue ? `${field}${issue.message}` : "Invalid request body",
            issues: result.error.issues,
          },
        },
        400
      );
    }
  });
}
