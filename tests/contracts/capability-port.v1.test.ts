import { describe, expect, it } from "vitest";
import { validateExecutionContextV1, type CapabilityPortV1, type ExecutionContextV1, type InputRefV1, type ResourceReceiptRefV1 } from "@/workers/harness/runtime-profile";

describe("CapabilityPortV1", () => {
  it("accepts only the minimal execution context at the stable port seam", async () => {
    const port: CapabilityPortV1<InputRefV1, { ref: string }> = {
      capabilityName: "llm.complete",
      async execute(context) { return { ref: `${context.runId}:${context.input.ref}` }; },
    };
    const context: ExecutionContextV1 = {
      runId: "run-1", stageId: "stage-1", attempt: 1, trigger: "manual", idempotencyKey: "idem-1",
      input: { kind: "product-input", ref: "input:1" },
    };
    if (false) {
      // @ts-expect-error product-input references cannot be artifact references
      const invalidInput: InputRefV1 = { kind: "product-input", ref: "artifact:wrong" };
      // @ts-expect-error an empty input: reference is raw and cannot become a validated InputRefV1
      const emptyInput: InputRefV1 = { kind: "product-input", ref: "input:" };
      // @ts-expect-error receipt refs are parser-branded and cannot carry URL-shaped raw data
      const unsafeReceipt: ResourceReceiptRefV1 = "receipt:https://x";
      // @ts-expect-error a raw ExecutionContextV1 cannot cross the CapabilityPort seam
      void port.execute(context);
      void [invalidInput, emptyInput, unsafeReceipt];
    }
    const parsed = validateExecutionContextV1(context, ["manual"]);
    expect(parsed).toMatchObject({ ok: true });
    if (parsed.ok) await expect(port.execute(parsed.context)).resolves.toEqual({ ref: "run-1:input:1" });
    expect(validateExecutionContextV1({ ...context, credentialRef: "env:API_TOKEN" }, ["manual"])).toEqual({ ok: false, reasonCode: "EXECUTION_CONTEXT_INVALID" });
    expect(validateExecutionContextV1({ ...context, approval: true }, ["manual"])).toEqual({ ok: false, reasonCode: "EXECUTION_CONTEXT_INVALID" });
  });
});
