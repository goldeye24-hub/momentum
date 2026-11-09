'use strict';

// Vercel Ignored Build Step. Exit 0 = skip build; exit 1 = build.
// Never skip a production change unless its changed file list is reliable.
// Editing docs/tests/CI/scripts alone should not rebuild serverless functions.
const {execFileSync}=require('node:child_process');
const IGNORE_PREFIXES=['.github/','docs/','tests/','scripts/','artifacts/'];
function affectsDeployment(path){
 const value=String(path||'').replace(/\\/g,'/');
 if(!value)return false;
 return !IGNORE_PREFIXES.some(prefix=>value.startsWith(prefix)) &&
   !/^(?:README|CHANGELOG|CONTRIBUTING)(?:\.[^/]*)?$/i.test(value);
}
function needsBuild(changedFiles){
 return changedFiles.some(affectsDeployment);
}
function chooseAction({branch,previousSha,head='HEAD',changedFiles}){
 if(branch&&branch!=='main')return {build:false,reason:'development_branch'};
 if(!/^[a-f0-9]{40}$/i.test(previousSha||''))return {build:true,reason:'missing_baseline'};
 if(!Array.isArray(changedFiles))return {build:true,reason:'unavailable_diff'};
 return {build:needsBuild(changedFiles),reason:needsBuild(changedFiles)?'site_change':'non_site_change'};
}
module.exports={affectsDeployment,needsBuild,chooseAction};
if(require.main===module){
 const branch=process.env.VERCEL_GIT_COMMIT_REF||'';
 const previousSha=process.env.VERCEL_GIT_PREVIOUS_SHA||'';
 let files;
 if(branch==='main'&&/^[a-f0-9]{40}$/i.test(previousSha)){
  try{
   files=execFileSync('git',['diff','--name-only',previousSha,'HEAD'],{encoding:'utf8',timeout:10000})
     .split(/\r?\n/).filter(Boolean);
  }catch(error){
   console.error('Unable to compare commits; allow deployment rather than risk stale site:',error.message);
  }
 }
 const decision=chooseAction({branch,previousSha,changedFiles:files});
 console.log('Vercel build guard:',decision.reason,decision.build?'build':'skip');
 process.exitCode=decision.build?1:0;
}
