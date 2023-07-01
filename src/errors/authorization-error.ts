import { Authorization } from "../types";

export class AuthorizationError extends Error {
  constructor(public requiredAuth: Authorization) {
    super("Authorization Error");

    if (requiredAuth === Authorization.MESSAGE) {
      this.message = `I'm sorry, but I'm not allowed to talk with you.`;
    } else {
      this.message = `I'm sorry, but you're not allowed to perform this action.`;
    }
  }
}
