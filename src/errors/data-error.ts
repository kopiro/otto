export class ErrorWithData extends Error {
  public data: string;

  constructor(message: string, data?: object) {
    super(message);
    this.data = data ? JSON.stringify(data) : null;
  }
}
