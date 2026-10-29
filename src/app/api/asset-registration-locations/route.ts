import {registrationLocations} from '@/lib/server/asset-inventory-reads';
import {assetErrorResponse} from '@/lib/server/asset-http';
export const runtime='nodejs';
export async function GET(request:Request){try{return Response.json(await registrationLocations(request),{headers:{'Cache-Control':'no-store'}});}catch(e){return assetErrorResponse(e);}}
