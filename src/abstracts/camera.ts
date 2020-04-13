export abstract class Camera {
  abstract async takePhoto(): Promise<string>;
  abstract async takeVideo(): Promise<string>;
}
