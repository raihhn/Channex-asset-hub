import {assetHistory} from '@/lib/server/asset-inventory-reads';
import {assetErrorResponse} from '@/lib/server/asset-http';
export const runtime='nodejs';
export async function GET(request:Request,context:{params:Promise<{assetId:string}>}){try{return Response.json(await assetHistory(request,(await context.params).assetId),{headers:{'Cache-Control':'no-store'}});}catch(e){return assetErrorResponse(e);}}
