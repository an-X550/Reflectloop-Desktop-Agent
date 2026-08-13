import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os'; import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { MarkdownProfileRepository } from '../../src/main-process/infrastructure/markdown/profile-repository';
const roots:string[]=[]; afterEach(async()=>Promise.all(roots.splice(0).map((root)=>rm(root,{recursive:true,force:true}))));
describe('MarkdownProfileRepository',()=>{
  it('round-trips one explicit profile file and clears it',async()=>{
    const root=await mkdtemp(path.join(os.tmpdir(),'zhiji-profile-')); roots.push(root); const repository=new MarkdownProfileRepository(root);
    const saved=await repository.save({body:'我偏好先验证再扩展。',enabledForAi:false});
    expect(await repository.get()).toEqual(saved);
    expect(await readFile(path.join(root,'profile','about-me.md'),'utf8')).toContain('我偏好先验证再扩展。');
    await repository.clear(); expect(await repository.get()).toBeNull();
  });
});
