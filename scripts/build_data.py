#!/usr/bin/env python3
"""Bundle the prepared SVG library for a buildless, offline-capable application."""
from pathlib import Path
import json, shutil, sys
ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT.parent/"illustration-library"
LIB=ROOT/"library"
if SOURCE.exists():
 LIB.mkdir(exist_ok=True)
 for name in ("manifest.json","palettes.json","templates.json"):
  shutil.copy2(SOURCE/name,LIB/name)
 for directory in ("assets","backgrounds","sources","templates"):
  shutil.copytree(SOURCE/directory,LIB/directory,dirs_exist_ok=True)
if not (LIB/"manifest.json").exists():raise SystemExit("Prepared library is missing")
manifest=json.loads((LIB/"manifest.json").read_text())
palettes=json.loads((LIB/"palettes.json").read_text())
svgs={}
for a in manifest["assets"]:
 for roles in a["variants"].values():
  for v in roles.values():svgs[v["path"]]=(LIB/v["path"]).read_text()
for b in manifest["backdrops"]:svgs[b["path"]]=(LIB/b["path"]).read_text()
data={"manifest":manifest,"palettes":palettes,"svgs":svgs}
safe=json.dumps(data,ensure_ascii=False,separators=(",",":")).replace("<","\\u003c")
(ROOT/"dist"/"data.js").write_text("globalThis.STUDIO_DATA="+safe+";\n",encoding="utf-8")
print(json.dumps({"objects":len(manifest["assets"]),"svgVariants":len(svgs),"dataBytes":(ROOT/"dist"/"data.js").stat().st_size}))
