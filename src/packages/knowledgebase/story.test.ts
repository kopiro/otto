import main from "./story";
import { Session } from "../../data";

describe("Package: knowledgebase.story", () => {
  test("it works", async () => {
    const result = await main({}, new Session());
    expect(result).toBeDefined();
  });
});
