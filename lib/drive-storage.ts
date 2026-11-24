import {createSign} from 'node:crypto';
import {HttpError} from './security';
let cached:{token:string;expires:number}|null=null;
export function driveConfigured(){return Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_JSON&&process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID)}
export async function driveToken(){
 if(cached&&cached.expires>Date.now()+60000)return cached.token;
 if(!driveConfigured())throw new HttpError(503,'Church Drive uploads are not configured. Contact your administrator.');
 const key=JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!),now=Math.floor(Date.now()/1000),encode=(v:unknown)=>Buffer.from(JSON.stringify(v)).toString('base64url');
 const unsigned=encode({alg:'RS256',typ:'JWT'})+'.'+encode({iss:key.client_email,scope:'https://www.googleapis.com/auth/drive.file',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600});
 const assertion=unsigned+'.'+createSign('RSA-SHA256').update(unsigned).sign(key.private_key,'base64url');
 const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion})});
 if(!r.ok)throw new HttpError(503,'Church Drive authorization failed. Ask your administrator to check its service account.');
 const b=await r.json();cached={token:b.access_token,expires:Date.now()+Number(b.expires_in)*1000};return cached.token;
}
export async function saveDriveNotes(bytes:Buffer,mime:string,name:string,year:string){
 const bearer=await driveToken(),headers={Authorization:'Bearer '+bearer},root=process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID!;
 if(!/^[a-zA-Z0-9_-]+$/.test(root))throw new HttpError(503,'Church Drive folder is invalid.');
 const folderName='iNoteCard_'+year,q=`'${root}' in parents and name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
 const listed=await fetch('https://www.googleapis.com/drive/v3/files?'+new URLSearchParams({q,fields:'files(id)',supportsAllDrives:'true',includeItemsFromAllDrives:'true'}),{headers});if(!listed.ok)throw new HttpError(503,'Unable to access the church Drive folder.');
 let folder=(await listed.json()).files?.[0]?.id;
 if(!folder){const made=await fetch('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&fields=id',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({name:folderName,mimeType:'application/vnd.google-apps.folder',parents:[root]})});if(!made.ok)throw new HttpError(503,'Unable to create the yearly notes folder.');folder=(await made.json()).id;}
 const begin=await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true&fields=id,name,webViewLink',{method:'POST',headers:{...headers,'Content-Type':'application/json','X-Upload-Content-Type':mime,'X-Upload-Content-Length':String(bytes.length)},body:JSON.stringify({name,parents:[folder]})});
 const location=begin.headers.get('location');if(!begin.ok||!location||new URL(location).origin!=='https://www.googleapis.com')throw new HttpError(503,'Unable to start the Drive upload.');
 const saved=await fetch(location,{method:'PUT',headers:{...headers,'Content-Type':mime},body:new Uint8Array(bytes)});if(!saved.ok)throw new HttpError(503,'Drive upload failed. Please retry.');return saved.json() as Promise<{id:string;name:string;webViewLink:string}>;
}
