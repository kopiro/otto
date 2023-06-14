import { getSessionLanguage } from "../../helpers";
import { AIRuntimeFunction } from "../../types";

export const authorizations = [];

const dateTimeNow: AIRuntimeFunction<{ timezone: string }> = async ({ session, parameters }) => {
  const { timezone } = parameters;
  const result = new Date().toLocaleString(getSessionLanguage(session), {
    timeZone: timezone,
  });

  return {
    functionResult: result,
    analytics: { engine: "action" },
  };
};

export default dateTimeNow;
