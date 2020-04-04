import * as AI from "../stdlib/ai";
import { Session, InputParams } from "../types";

export default function run(params: InputParams, session: Session) {
  return AI.processInput(params, session);
}
