// Image imports resolve to a data URI (see the "dataurl" loader in build.ts).
declare module "*.png" {
    const dataUri: string;
    export default dataUri;
}
