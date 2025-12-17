declare module "to-ico" {
  function toIco(pngs: Buffer[]): Promise<Buffer>;
  export = toIco;
}

