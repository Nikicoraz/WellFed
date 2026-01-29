declare module "qrcode-reader" {
  class QrCode {
      callback: (err: Error | null, value: { result: string }) => void;
      decode(bitmap: unknown): void;
  }
  export = QrCode;
}
