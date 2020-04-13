export abstract class Camera {
  abstract async takePhoto(): Promise<string>;
}
