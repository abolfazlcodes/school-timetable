export type ActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string[]>;
  data?: unknown;
};

export const initialActionState: ActionState = { status: "idle" };
