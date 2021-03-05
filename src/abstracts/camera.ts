export abstract class Camera {
  abstract takePhoto(): Promise<string>;
  abstract takeVideo(): Promise<string>;
}
