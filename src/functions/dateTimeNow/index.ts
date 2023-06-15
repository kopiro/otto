import { AIRuntimeFunction } from "../../types";

export const authorizations = [];

const dateTimeNow: AIRuntimeFunction<{ timezone: string }> = async ({ session, parameters }) => {
  const { timezone } = parameters;
  const result = new Date().toLocaleString(session.getLanguage(), {
    timeZone: timezone,
  });

  return {
    functionResult: result,
    analytics: { engine: "action" },
  };
};

export default dateTimeNow;
