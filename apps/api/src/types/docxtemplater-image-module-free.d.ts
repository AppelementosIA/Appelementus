declare module "docxtemplater-image-module-free" {
  class ImageModule {
    constructor(options: {
      centered?: boolean;
      getImage: (tagValue: unknown, tagName?: string) => Buffer;
      getSize: (image: Buffer, tagValue: unknown, tagName?: string) => [number, number];
    });
  }

  export default ImageModule;
}
