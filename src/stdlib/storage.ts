import config from "../config";
import { GoogleStorage } from "../lib/google-storage";

export default (() => {
  const driverName = config().storageDriver;
  switch (driverName) {
    case "google":
      return new GoogleStorage();
    default:
      throw new Error(`Invalid storage: <${driverName}>`);
  }
})();
