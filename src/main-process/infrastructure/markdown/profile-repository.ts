import { readFile, rm } from 'node:fs/promises'; import matter from 'gray-matter';
import { ProfileSchema, type Profile } from '../../../shared/schemas/domain'; import type { SaveProfileInput } from '../../../shared/schemas/ipc';
import { atomicWriteUtf8 } from './atomic-write'; import { resolveInsideRoot } from './path-policy';
const parse=(value:string):Profile=>{const {data,content}=matter(value);return ProfileSchema.parse({schemaVersion:data.schema_version,body:content.trim(),enabledForAi:data.enabled_for_ai,createdAt:data.created_at,updatedAt:data.updated_at});};
export class MarkdownProfileRepository { constructor(private readonly root:string){}
  async get():Promise<Profile|null>{try{return parse(await readFile(await resolveInsideRoot(this.root,'profile','about-me.md'),'utf8'));}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return null;throw error;}}
  async save(input:SaveProfileInput):Promise<Profile>{const old=await this.get();const now=new Date().toISOString();const profile=ProfileSchema.parse({schemaVersion:1,...input,createdAt:old?.createdAt??now,updatedAt:now});const target=await resolveInsideRoot(this.root,'profile','about-me.md');await atomicWriteUtf8(target,matter.stringify(profile.body,{schema_version:1,enabled_for_ai:profile.enabledForAi,created_at:profile.createdAt,updated_at:profile.updatedAt}),parse);return profile;}
  async clear():Promise<void>{await rm(await resolveInsideRoot(this.root,'profile','about-me.md'),{force:true});}
}
