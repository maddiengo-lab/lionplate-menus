import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {DINING_SOURCES,parseMenuPage} from './menu-source.ts';
const exec=promisify(execFile);
const destination=fileURLToPath(new URL('./data/menus.json',import.meta.url));

export async function refreshSources(previous,download,now=()=>new Date().toISOString()){
  const prior=previous?.schemaVersion===1&&Array.isArray(previous.sources)?previous.sources:[];
  const results=new Map();const errors=[];let cursor=0;
  async function worker(){
    while(cursor<DINING_SOURCES.length){
      const source=DINING_SOURCES[cursor++];
      try{
        const data=parseMenuPage(await download(source),source.id);
        results.set(source.id,{...data,hallId:source.id,url:source.url,updatedAt:now()});
      }catch(error){
        const message=error instanceof Error?error.message:'Download failed';
        errors.push({hallId:source.id,url:source.url,error:message});
        const old=prior.find(s=>s.hallId===source.id&&s.url===source.url);
        if(old)results.set(source.id,{...old,lastError:message});
      }
    }
  }
  await Promise.all(Array.from({length:3},worker));
  if(results.size!==DINING_SOURCES.length)throw new Error('Incomplete initial feed. Keep the provided starter menus.json and retry.');
  return {schemaVersion:1,generatedAt:now(),sources:DINING_SOURCES.map(s=>results.get(s.id)),errors};
}
async function main(){
  let previous;try{previous=JSON.parse(await readFile(destination,'utf8'));}catch{}
  const feed=await refreshSources(previous,async source=>{
    try{
      const {stdout}=await exec('curl',['--silent','--show-error','--fail','--location','--retry','2','--retry-delay','2','--max-time','25','--user-agent','LionPlate menu updater',source.url],{maxBuffer:5000000,timeout:90000});
      return stdout;
    }catch{throw new Error('Official page download failed');}
  });
  await mkdir(fileURLToPath(new URL('./data/',import.meta.url)),{recursive:true});
  await writeFile(destination+'.tmp',JSON.stringify(feed)+'\n');
  await rename(destination+'.tmp',destination);
  for(const source of feed.sources)console.log(`${source.hallId}: ${source.lastError?'retained previous menus':'refreshed'} · ${source.menus.length} dated menus`);
  console.log(`${feed.sources.length-feed.errors.length}/11 sources refreshed. Output contains official menus only.`);
  if(feed.errors.length)process.exitCode=1;
}
if(process.argv[1]===fileURLToPath(import.meta.url))main().catch(error=>{console.error(error.message);process.exitCode=1;});
