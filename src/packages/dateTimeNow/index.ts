import { AIAction } from "../../types";

export const authorizations = [];

const dateTimeNow: AIAction = async () => {
  return { text: new Date().toLocaleDateString(), analytics: { engine: "action" } };
};

export default dateTimeNow;
