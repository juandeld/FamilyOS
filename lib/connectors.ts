// Production adapters must authenticate, authorize by household/person and audit every write.
export interface VoiceConnector { transcribe(audio:Blob):Promise<string> }
export interface WhatsAppConnector { sendApprovedMessage(recipient:string,text:string,approvalId:string):Promise<{id:string}> }
export interface PhotoConnector { suggest(file:File):Promise<{text:string;confidence:number}> }
export interface HouseholdRepository<T> { load():Promise<T>; save(value:T):Promise<void> }
export const integrations={supabase:false,voice:false,whatsapp:false,email:false,calendar:false,supplierSearch:false};
