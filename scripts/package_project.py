from pathlib import Path
import zipfile,json
r=Path(__file__).resolve().parents[1]
out=r.parent/"svg-composition-studio.zip"
with zipfile.ZipFile(out,"w",zipfile.ZIP_DEFLATED,compresslevel=9) as z:
 for f in sorted(r.rglob("*")):
  if not f.is_file() or any(n in f.relative_to(r).parts for n in [".git","node_modules","__pycache__"]):continue
  if f.name in [".DS_Store","manage_project.py"] or f.suffix in [".zip",".gz"]:continue
  if f.name.startswith(".env") and f.name!=".env.example":continue
  z.write(f,Path(r.name)/f.relative_to(r))
with zipfile.ZipFile(out) as z:
 assert z.testzip() is None
 print(json.dumps({"archive":str(out),"files":len(z.namelist()),"bytes":out.stat().st_size}))
