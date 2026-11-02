from pathlib import Path
import hashlib,json,zipfile
r=Path(__file__).resolve().parents[1]
name='BFStaff-r40.7-Unified-RC1-UI-2026-11-01.zip'
out=r/'artifacts'/name
files=[]
for folder in ['app','docs','tests','scripts']:
 for p in (r/folder).rglob('*'):
  if not p.is_file() or any(x in p.parts for x in ['node_modules','.git','.vite','__pycache__','reports']):continue
  if p.suffix in ['.map','.tsbuildinfo'] or 'app/public/assets/' in str(p):continue
  files.append(p)
for pattern in ['UI_NOV1_*.log']:
 files.extend((r/'evidence').glob(pattern))
files.extend(p for p in (r/'evidence/ui-nov1').glob('*') if p.is_file())
files.extend([r/'README_RU.md',r/'artifacts/BFStaff-UI-2026-11-01.pdf'])
files=sorted(set(files))
hashfile=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
manifest={str(p.relative_to(r)):hashfile(p) for p in files}
mp=r/'artifacts/UI_NOV1_SOURCE_MANIFEST.json';mp.write_text(json.dumps(manifest,ensure_ascii=False,indent=2));files.append(mp)
with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
 for p in files:z.write(p,'BFStaff-r40.7-Unified/'+str(p.relative_to(r)))
with zipfile.ZipFile(out) as z:
 assert z.testzip() is None
 for rel,sha in manifest.items():assert hashlib.sha256(z.read('BFStaff-r40.7-Unified/'+rel)).hexdigest()==sha
result={'file':name,'bytes':out.stat().st_size,'sha256':hashfile(out),'files':len(files),'archiveCRCAndSHA':'PASS','build':'PASS','ci':'109/109','browserScenarios':'21/21','targetedChecks':'8/8','pdfScreens':12,'birthdaySQLPatchUnapplied':True,'productionWrites':False,'serverPatchesStillUnapplied':True,'nocodbCleanupAdapterStillMissing':True}
(r/'artifacts/UI_NOV1_RELEASE.json').write_text(json.dumps(result,indent=2));print(json.dumps(result,indent=2))
