import {saveAssetDocumentation} from '@/lib/server/asset-documentation';
import {assetErrorResponse} from '@/lib/server/asset-http';
export const runtime='nodejs';
export async function POST(request:Request,context:{params:Promise<{assetId:string}>}){try{return Response.json(await saveAssetDocumentation(request,(await context.params).assetId),{headers:{'Cache-Control':'no-store'}});}catch(e){return assetErrorResponse(e);}}
