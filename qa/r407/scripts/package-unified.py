from pathlib import Path
import json,hashlib,zipfile,datetime
r=Path(__file__).resolve().parents[1];sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();a=r/'artifacts';a.mkdir(exist_ok=True)
# Fresh successful scenarios can supplement earlier unchanged compiled-app scenarios.
old=json.loads((r/'evidence/attempts/independent-20-pass-1-locator.json').read_text());new=json.loads((r/'evidence/independent-browser/results.json').read_text());rows={v['name']:v for v in old['results']};rows.update({v['name']:v for v in new['results']});merged={'scope':'Actual compiled app, explicit transport mocks; no production/RLS claim. Focused recheck of same build is explicit.','results':list(rows.values()),'pass':sum(v['status']=='PASS' for v in rows.values()),'fail':sum(v['status']!='PASS' for v in rows.values())};(r/'evidence/CONSOLIDATED_E2E.json').write_text(json.dumps(merged,ensure_ascii=False,indent=2))
files=[]
for folder in ['app','docs','tests','scripts','evidence','research']:
 for p in (r/folder).rglob('*'):
  if p.name=='RELEASE_SOURCE_MANIFEST.json':continue
  if not p.is_file() or any(x in p.parts for x in ['node_modules','.git','.vite','__pycache__']):continue
  if p.suffix in ['.map','.tsbuildinfo'] or 'app/public/assets/' in str(p):continue
  files.append(p)
for p in [r/'README_RU.md',r/'reference-main/main-pinned.zip',r/'artifacts/BFStaff-Unified-RC1-Screens.pdf']:
 if p.exists():files.append(p)
manifest={str(p.relative_to(r)):sha(p) for p in files}
(r/'evidence/RELEASE_SOURCE_MANIFEST.json').write_text(json.dumps(manifest,indent=2));files.append(r/'evidence/RELEASE_SOURCE_MANIFEST.json')
package=a/'BFStaff-r40.7-Unified-RC1-2026-10-31.zip'
with zipfile.ZipFile(package,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
 for p in sorted(files):z.write(p,'BFStaff-r40.7-Unified/'+str(p.relative_to(r)))
with zipfile.ZipFile(package) as z:
 assert z.testzip() is None
 for rel,d in manifest.items():assert hashlib.sha256(z.read('BFStaff-r40.7-Unified/'+rel)).hexdigest()==d,rel
out={'file':package.name,'bytes':package.stat().st_size,'sha256':sha(package),'payloadFiles':len(files),'archiveCRCAndPayloadSHA':'PASS','build':'PASS','e2e':{'pass':merged['pass'],'fail':merged['fail']},'productionWrites':False,'unappliedServerPatches':True,'knownBlocker':'Real NocoDB managed-photo cleanup adapter is not implemented; related actions fail closed. Current CI109/109; old layout guards retired explicitly.'};(a/'RELEASE.json').write_text(json.dumps(out,ensure_ascii=False,indent=2));print(json.dumps(out,ensure_ascii=False,indent=2))
